// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';

import { NodeWebDavClient } from './webdav.js';

afterEach(() => vi.unstubAllGlobals());

const client = new NodeWebDavClient({
  endpoint: 'https://dav.example.test',
  password: 'secret',
  targetPath: 'Kloda',
  username: 'user',
});

const abcRevision = 'sha256:ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';
const emptyRevision = 'sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

function stubRemoteResponse(response: Response): void {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response));
}

describe('NodeWebDavClient.inspectFile', () => {
  it('matches remote bytes against the receipt SHA-256', async () => {
    stubRemoteResponse(new Response('abc', { status: 200 }));
    await expect(client.inspectFile('photos/item.jpg', abcRevision)).resolves.toBe('match');
  });

  it('reports same-length changed bytes as a mismatch, ignoring ETag', async () => {
    stubRemoteResponse(new Response('abd', {
      headers: { ETag: '"ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"' },
      status: 200,
    }));
    await expect(client.inspectFile('photos/item.jpg', abcRevision)).resolves.toBe('mismatch');
  });

  it('matches an empty remote body against the empty SHA-256', async () => {
    stubRemoteResponse(new Response(null, { status: 200 }));
    await expect(client.inspectFile('photos/empty.jpg', emptyRevision)).resolves.toBe('match');
  });

  it('reports a missing remote path', async () => {
    stubRemoteResponse(new Response(null, { status: 404 }));
    await expect(client.inspectFile('photos/missing.jpg', abcRevision)).resolves.toBe('missing');
  });

  it.each([206, 401, 403, 500])('throws for HTTP %i instead of inspecting a partial/failed response', async status => {
    stubRemoteResponse(new Response(null, { status }));
    await expect(client.inspectFile('photos/item.jpg', abcRevision)).rejects.toThrow();
  });

  it('rejects a failed response stream rather than inspecting partial bytes', async () => {
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('ab'));
        controller.error(new Error('stream interrupted'));
      },
    });
    stubRemoteResponse(new Response(body, { status: 200 }));
    await expect(client.inspectFile('photos/item.jpg', abcRevision)).rejects.toThrow();
  });
});
