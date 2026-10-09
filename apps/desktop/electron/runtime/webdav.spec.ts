// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';

import { NodeWebDavClient } from './webdav.js';

describe('NodeWebDavClient pending upload boundary', () => {
  afterEach(() => vi.unstubAllGlobals());

  function remoteFixture() {
    const files = new Map<string, string>();
    let moveStatus: number | undefined;
    let moveFailure: Error | undefined;
    const fetch = vi.fn(async (input: URL | RequestInfo, init?: RequestInit) => {
      const url = new URL(input instanceof URL ? input.toString() : input instanceof Request ? input.url : input);
      const method = init?.method ?? 'GET';
      const headers = new Headers(init?.headers);
      if (method === 'MKCOL') return new Response(null, { status: 405 });
      if (method === 'PUT') {
        if (files.has(url.pathname) && headers.get('If-None-Match') === '*') return new Response(null, { status: 412 });
        files.set(url.pathname, await new Response(init?.body).text());
        return new Response(null, { status: 201 });
      }
      if (method === 'MOVE') {
        if (moveFailure) throw moveFailure;
        if (moveStatus !== undefined) return new Response(null, { status: moveStatus });
        const destination = new URL((init?.headers as Record<string, string>).Destination).pathname;
        if (files.has(destination) && headers.get('Overwrite') === 'F') return new Response(null, { status: 412 });
        const bytes = files.get(url.pathname);
        if (bytes === undefined) return new Response(null, { status: 404 });
        files.set(destination, bytes);
        files.delete(url.pathname);
        return new Response(null, { status: 201 });
      }
      if (method === 'DELETE') {
        files.delete(url.pathname);
        return new Response(null, { status: 204 });
      }
      return new Response(null, { status: 404 });
    });
    vi.stubGlobal('fetch', fetch);
    const client = new NodeWebDavClient({ endpoint: 'https://dav.example.test', password: 'secret', targetPath: 'Kloda', username: 'user' });
    return {
      client,
      files,
      setMoveStatus(status: number) { moveStatus = status; },
      setMoveFailure(error: Error) { moveFailure = error; },
    };
  }

  it('does not overwrite an occupied temporary path', async () => {
    const { client, files } = remoteFixture();
    const temp = '/Kloda/source/photo.jpg.kloda-upload-transaction';
    files.set(temp, 'pre-existing');
    await expect(client.uploadTemporary('source/photo.jpg.kloda-upload-transaction', new Blob(['new bytes']))).rejects.toThrow();
    expect(files.get(temp)).toBe('pre-existing');
  });

  it('preserves occupied final and temporary paths on conflict, even for identical bytes', async () => {
    const { client, files } = remoteFixture();
    const final = '/Kloda/source/photo.jpg';
    const temp = `${final}.kloda-upload-transaction`;
    files.set(final, 'same bytes');
    await client.uploadTemporary('source/photo.jpg.kloda-upload-transaction', new Blob(['same bytes']));
    await expect(client.finalizeUpload('source/photo.jpg', 'source/photo.jpg.kloda-upload-transaction')).resolves.toBe('conflict');
    expect(files.get(final)).toBe('same bytes');
    expect(files.get(temp)).toBe('same bytes');
  });

  it.each([507, 207])('preserves temporary upload when MOVE returns HTTP %i', async status => {
    const { client, files, setMoveStatus } = remoteFixture();
    const final = '/Kloda/source/photo.jpg';
    const temp = `${final}.kloda-upload-transaction`;
    await client.uploadTemporary('source/photo.jpg.kloda-upload-transaction', new Blob(['pending bytes']));
    setMoveStatus(status);
    await expect(client.finalizeUpload('source/photo.jpg', 'source/photo.jpg.kloda-upload-transaction')).rejects.toThrow();
    expect(files.get(temp)).toBe('pending bytes');
    expect(files.has(final)).toBe(false);
  });

  it('preserves temporary upload when MOVE has a network failure', async () => {
    const { client, files, setMoveFailure } = remoteFixture();
    const temp = '/Kloda/source/photo.jpg.kloda-upload-transaction';
    await client.uploadTemporary('source/photo.jpg.kloda-upload-transaction', new Blob(['pending bytes']));
    setMoveFailure(new TypeError('connection reset'));
    await expect(client.finalizeUpload('source/photo.jpg', 'source/photo.jpg.kloda-upload-transaction')).rejects.toBeInstanceOf(TypeError);
    expect(files.get(temp)).toBe('pending bytes');
  });
});
