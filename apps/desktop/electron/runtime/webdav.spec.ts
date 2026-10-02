import { afterEach, describe, expect, it, vi } from 'vitest';

import { NodeWebDavClient } from './webdav.js';

describe('NodeWebDavClient uploadFile', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('uploads to the journalled temporary path before moving without overwrite', async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 201 }))
      .mockResolvedValueOnce(new Response(null, { status: 201 }));
    vi.stubGlobal('fetch', fetch);
    const client = new NodeWebDavClient({ endpoint: 'https://dav.example.test', password: 'secret', targetPath: 'Kloda', username: 'user' });

    await client.uploadFile('source/a photo.jpg', 'source/a photo.jpg.kloda-upload-transaction', new Blob(['photo']));

    expect(fetch).toHaveBeenCalledTimes(2);
    const [temporaryUrl, temporaryRequest] = fetch.mock.calls[0] as [URL, RequestInit];
    const [moveSource, moveRequest] = fetch.mock.calls[1] as [URL, RequestInit];
    expect(temporaryRequest.method).toBe('PUT');
    expect(temporaryRequest.headers).toMatchObject({ 'If-None-Match': '*' });
    expect(temporaryUrl.pathname).toBe('/Kloda/source/a%20photo.jpg.kloda-upload-transaction');
    expect(moveSource).toEqual(temporaryUrl);
    expect(moveRequest).toMatchObject({ method: 'MOVE' });
    expect(moveRequest.headers).toMatchObject({ Destination: 'https://dav.example.test/Kloda/source/a%20photo.jpg', Overwrite: 'F' });
  });

  it('cleans up its temporary file when finalization fails', async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 201 }))
      .mockResolvedValueOnce(new Response(null, { status: 507 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetch);
    const client = new NodeWebDavClient({ endpoint: 'https://dav.example.test', password: 'secret', targetPath: 'Kloda', username: 'user' });

    await expect(client.uploadFile('source/photo.jpg', 'source/photo.jpg.kloda-upload-transaction', new Blob(['photo']))).rejects.toThrow('WebDAV finalize failed (507).');

    const [temporaryUrl] = fetch.mock.calls[0] as [URL, RequestInit];
    const [cleanupUrl, cleanupRequest] = fetch.mock.calls[2] as [URL, RequestInit];
    expect(cleanupUrl).toEqual(temporaryUrl);
    expect(cleanupRequest).toMatchObject({ method: 'DELETE' });
  });

  it('does not delete a temporary upload after an uncertain finalization result', async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 201 }))
      .mockRejectedValueOnce(new TypeError('connection reset'));
    vi.stubGlobal('fetch', fetch);
    const client = new NodeWebDavClient({ endpoint: 'https://dav.example.test', password: 'secret', targetPath: 'Kloda', username: 'user' });

    await expect(client.uploadFile('source/photo.jpg', 'source/photo.jpg.kloda-upload-transaction', new Blob(['photo']))).rejects.toThrow('connection reset');

    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
