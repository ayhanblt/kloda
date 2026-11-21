// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';

import { failureCode, httpFailure, networkFailure, WebDavFailure } from './webdav-errors.js';
import { NodeWebDavClient } from './webdav.js';

const storage = { endpoint: 'https://fixture.invalid', username: 'user', password: 'fixture', targetPath: 'backups' };
const client = () => new NodeWebDavClient(storage);
afterEach(() => vi.unstubAllGlobals());

describe('closed WebDAV failure classification', () => {
  it.each([
    [401, 'access_denied'], [403, 'access_denied'], [507, 'storage_full'], [408, 'connection_unavailable'],
    [423, 'connection_unavailable'], [429, 'connection_unavailable'], [500, 'connection_unavailable'],
    [503, 'connection_unavailable'], [409, 'review_required'], [412, 'review_required'], [400, 'unknown'], [207, 'unknown'],
  ])('classifies HTTP %s as %s', (status, code) => expect(failureCode(httpFailure(Number(status)))).toBe(code));

  it('does not infer transient status from arbitrary errors, strings or unwrapped OS network errors', () => {
    for (const error of [new Error('connection reset'), 'offline', { code: 'ECONNRESET' }, undefined]) {
      expect(failureCode(error)).toBe('unknown');
    }
    expect(failureCode(new WebDavFailure('settings_changed'))).toBe('settings_changed');
    expect(failureCode(networkFailure(new Error('socket failed')))).toBe('connection_unavailable');
  });

  it.each([
    ['EACCES', 'access_denied'], ['EPERM', 'access_denied'], ['ENOENT', 'source_changed'], ['ENOSPC', 'storage_full'],
    ['CERT_HAS_EXPIRED', 'access_denied'], ['ERR_TLS_CERT_ALTNAME_INVALID', 'access_denied'],
    ['DEPTH_ZERO_SELF_SIGNED_CERT', 'access_denied'], ['UNABLE_TO_VERIFY_LEAF_SIGNATURE', 'access_denied'],
  ])('preserves OS/certificate failure %s as %s through causes', (code, expected) => {
    const error = new TypeError('fetch failed', { cause: Object.assign(new Error('cause'), { code }) });
    expect(failureCode(error)).toBe(expected);
    if (expected === 'access_denied') expect(failureCode(networkFailure(error))).toBe(expected);
  });

  it('handles a cyclic cause without guessing', () => {
    const error: { cause?: unknown } = {};
    error.cause = error;
    expect(failureCode(error)).toBe('unknown');
  });
});

describe('actual client failure boundaries', () => {
  it('wraps network transport errors but retains certificate denial', async () => {
    const fetch = vi.fn().mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockRejectedValueOnce(new TypeError('fetch failed', { cause: { code: 'CERT_HAS_EXPIRED' } }));
    vi.stubGlobal('fetch', fetch);
    await expect(client().inspectFile('source/item', 'hash')).rejects.toMatchObject({ code: 'connection_unavailable' });
    await expect(client().inspectFile('source/item', 'hash')).rejects.toMatchObject({ code: 'access_denied' });
  });

  it('marks failed verification streams transient without reporting a partial hash match', async () => {
    const stream = new ReadableStream<Uint8Array>({ start(controller) { controller.error(new Error('read interrupted')); } });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(stream)));
    await expect(client().inspectFile('source/item', 'hash')).rejects.toMatchObject({ code: 'connection_unavailable' });
  });

  it.each(['PUT', 'MOVE', 'MKCOL'])('keeps uncertain probe %s out of automatic retry', async method => {
    const calls: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (_input: unknown, init: RequestInit) => {
      calls.push(init.method!);
      if (init.method === method) throw new TypeError('lost mutation response');
      return new Response(init.method === 'GET' ? 'kloda-webdav-probe' : null,
        { status: init.method === 'PROPFIND' ? 207 : init.method === 'DELETE' ? 204 : 201 });
    }));
    await expect(client().verifyWriteAccess()).rejects.toMatchObject({ code: 'review_required' });
    expect(calls.filter(call => call === method)).toHaveLength(1);
    if (method === 'MKCOL') expect(calls).not.toContain('DELETE');
  });

  it('marks failed cleanup as review required even when the probe bytes were verified', async () => {
    vi.stubGlobal('fetch', vi.fn(async (_input: unknown, init: RequestInit) => new Response(
      init.method === 'GET' ? 'kloda-webdav-probe' : null,
      { status: init.method === 'PROPFIND' ? 207 : init.method === 'DELETE' ? 503 : 201 },
    )));
    await expect(client().verifyWriteAccess()).rejects.toMatchObject({ code: 'review_required' });
  });

  it('classifies invalid configuration before any request', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    for (const endpoint of ['not a URL', 'http://fixture.invalid']) {
      await expect(new NodeWebDavClient({ ...storage, endpoint }).inspectFile('file', 'hash'))
        .rejects.toMatchObject({ code: 'configuration_required' });
    }
    expect(fetch).not.toHaveBeenCalled();
  });
});
