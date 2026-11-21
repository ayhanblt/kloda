// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';

import { WebDavFailure } from './webdav-errors.js';
import { storageTestReply } from './webdav-test-result.js';
import { NodeWebDavClient } from './webdav.js';

const secret = 'public-secret-sentinel';
const storage = { endpoint: 'https://fixture.invalid:8083/dav/', username: 'sentinel-user', password: secret, targetPath: 'sentinel-path' };
const probe = () => storageTestReply(() => new NodeWebDavClient(storage).verifyWriteAccess());
const leak = /sentinel|fixture\.invalid|dav|Basic|8083/;
afterEach(() => vi.unstubAllGlobals());

function serve(fail: (method: string, nth: number) => Response | Error | undefined, body = 'kloda-webdav-probe') {
  const seen = new Map<string, number>();
  vi.stubGlobal('fetch', vi.fn(async (_input: unknown, init: RequestInit) => {
    const method = init.method!; const nth = (seen.get(method) ?? 0) + 1; seen.set(method, nth);
    const outcome = fail(method, nth);
    if (outcome instanceof Error) throw outcome;
    return outcome ?? new Response(method === 'GET' ? body : null, { status: method === 'PROPFIND' ? 207 : method === 'DELETE' ? 204 : 201 });
  }));
}

describe('connection test reply projection', () => {
  it('G24-04/06: PROPFIND 404 becomes a plain envelope with only code/stage/status and no secret', async () => {
    serve((method) => method === 'PROPFIND' ? new Response(`denied ${secret}`, { status: 404 }) : undefined);
    const reply = await probe();
    expect(reply).toEqual({ ok: false, code: 'unknown', diagnostic: { stage: 'propfind', kind: 'http', status: 404 } });
    expect(JSON.stringify(reply)).not.toMatch(leak);
  });

  it.each([
    ['MKCOL', 1, 'mkcol', 'unknown'], ['PUT', 1, 'put', 'unknown'], ['MOVE', 1, 'move', 'unknown'], ['GET', 1, 'get', 'unknown'],
    ['DELETE', 1, 'delete_file', 'review_required'], ['DELETE', 2, 'delete_directory', 'review_required'],
  ] as const)('G24-04: HTTP failure at %s #%i reports %s with the unchanged failure code', async (target, count, stage, code) => {
    serve((method, nth) => method === target && nth === count ? new Response(null, { status: 400 }) : undefined);
    expect(await probe()).toEqual({ ok: false, code, diagnostic: { stage, kind: 'http', status: 400 } });
  });

  it.each([
    ['PROPFIND', 'propfind', 'connection_unavailable'], ['MKCOL', 'mkcol', 'review_required'], ['PUT', 'put', 'review_required'],
    ['MOVE', 'move', 'review_required'], ['GET', 'get', 'connection_unavailable'], ['DELETE', 'delete_file', 'review_required'],
  ] as const)('G24-04/06: transport failure at %s is transport_unknown without its raw message', async (target, stage, code) => {
    serve((method) => method === target ? new TypeError(`fetch failed ${secret} https://fixture.invalid:8083/dav/`) : undefined);
    const reply = await probe();
    expect(reply).toEqual({ ok: false, code, diagnostic: { stage, kind: 'transport_unknown' } });
    expect(JSON.stringify(reply)).not.toMatch(leak);
  });

  it('G24-04: readback mismatch is distinct and keeps review_required', async () => {
    serve(() => undefined, 'other');
    expect(await probe()).toEqual({ ok: false, code: 'review_required', diagnostic: { stage: 'get', kind: 'readback_mismatch' } });
  });

  it('G24-06: success is only ok=true; foreign errors and forged diagnostics are reduced to the allowlist', async () => {
    expect(await storageTestReply(async () => undefined)).toEqual({ ok: true });
    expect(await storageTestReply(async () => { throw new Error(secret); })).toEqual({ ok: false, code: 'unknown' });
    const forged = new WebDavFailure('access_denied', secret, { diagnostic: { stage: 'put', kind: 'http', status: 401 } });
    Object.assign(forged.diagnostic!, { host: secret });
    expect(await storageTestReply(async () => { throw forged; })).toEqual({ ok: false, code: 'access_denied', diagnostic: { stage: 'put', kind: 'http', status: 401 } });
    const malformed = new WebDavFailure('unknown', secret, { diagnostic: { stage: secret, kind: 'http', status: 404 } as never });
    expect(await storageTestReply(async () => { throw malformed; })).toEqual({ ok: false, code: 'unknown' });
  });
});
