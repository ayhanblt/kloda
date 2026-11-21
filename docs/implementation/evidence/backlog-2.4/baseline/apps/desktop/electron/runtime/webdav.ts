import { createHash, randomUUID } from 'node:crypto';

import type { StorageForm } from './types.js';
import { httpFailure, networkFailure, WebDavFailure } from './webdav-errors.js';

export class NodeWebDavClient {
  private readonly preparedDirectories = new Set<string>();
  constructor(private readonly storage: StorageForm) {}

  async verifyWriteAccess(): Promise<void> {
    const baseUrl = this.getBaseUrl();
    const probeDirectoryUrl = new URL(`.kloda-probe-${randomUUID()}/`, baseUrl);
    const uploadUrl = new URL('upload', probeDirectoryUrl);
    const finalUrl = new URL('final', probeDirectoryUrl);
    const probePayload = 'kloda-webdav-probe';
    let uploaded = false;
    let finalized = false;
    let operationFailure: unknown;

    const directory = await this.request(baseUrl, 'PROPFIND', { Depth: '0' });
    if (!directory.ok && directory.status !== 207) throw httpFailure(directory.status, `WebDAV directory access failed (${directory.status}).`);

    let createProbeDirectory: Response;
    try { createProbeDirectory = await this.request(probeDirectoryUrl, 'MKCOL'); }
    catch (cause) { throw new WebDavFailure('review_required', 'WebDAV probe directory creation result is uncertain.', { cause }); }
    if (!createProbeDirectory.ok) throw httpFailure(createProbeDirectory.status, `WebDAV probe directory creation failed (${createProbeDirectory.status}).`);
    try {
      const upload = await this.probeMutation(uploadUrl, 'PUT', { 'Content-Type': 'text/plain' }, probePayload);
      if (!upload.ok) throw httpFailure(upload.status, `WebDAV write failed (${upload.status}).`);
      uploaded = true;

      const move = await this.probeMutation(uploadUrl, 'MOVE', { Destination: finalUrl.toString(), Overwrite: 'F' });
      if (!move.ok) throw httpFailure(move.status, `WebDAV finalize failed (${move.status}).`);
      finalized = true;

      const read = await this.request(finalUrl, 'GET');
      if (!read.ok) throw httpFailure(read.status, 'WebDAV read-back verification failed.');
      let text: string;
      try { text = await read.text(); } catch (cause) { throw networkFailure(cause); }
      if (text !== probePayload) throw new WebDavFailure('review_required', 'WebDAV read-back verification failed.');
    } catch (reason) {
      operationFailure = reason;
    }

    const cleanupFailure = await this.cleanupProbe(finalized ? finalUrl : uploaded ? uploadUrl : undefined, probeDirectoryUrl);
    if (cleanupFailure) throw cleanupFailure;
    if (operationFailure) throw operationFailure;
  }

  async uploadTemporary(temporaryRemotePath: string, file: Blob): Promise<void> {
    await this.prepareParentDirectories(temporaryRemotePath);
    const temporary = new URL(temporaryRemotePath.split('/').map(encodeURIComponent).join('/'), this.getBaseUrl());
    const upload = await this.request(temporary, 'PUT', { 'If-None-Match': '*' }, file);
    await this.cancelBody(upload);
    if (upload.status !== 201) throw httpFailure(upload.status, `WebDAV upload failed (${upload.status}).`);
  }

  async finalizeUpload(remotePath: string, temporaryRemotePath: string): Promise<'moved' | 'conflict'> {
    const target = new URL(remotePath.split('/').map(encodeURIComponent).join('/'), this.getBaseUrl());
    const temporary = new URL(temporaryRemotePath.split('/').map(encodeURIComponent).join('/'), this.getBaseUrl());
    const finalize = await this.request(temporary, 'MOVE', { Destination: target.toString(), Overwrite: 'F' });
    await this.cancelBody(finalize);
    if (finalize.status === 412) return 'conflict';
    if (finalize.status !== 201) throw httpFailure(finalize.status, `WebDAV finalize failed (${finalize.status}).`);
    return 'moved';
  }

  async inspectFile(remotePath: string, revision: string): Promise<'missing' | 'match' | 'mismatch'> {
    const target = new URL(remotePath.split('/').map(encodeURIComponent).join('/'), this.getBaseUrl());
    const response = await this.request(target, 'GET');
    if (response.status !== 200) {
      await this.cancelBody(response);
      if (response.status === 404) return 'missing';
      throw httpFailure(response.status, `WebDAV read verification failed (${response.status}).`);
    }
    const hash = createHash('sha256');
    const reader = response.body?.getReader();
    if (reader) {
      try {
        while (true) {
          const chunk = await reader.read();
          if (chunk.done) break;
          hash.update(chunk.value);
        }
      } catch (cause) {
        throw networkFailure(cause);
      } finally {
        reader.releaseLock();
      }
    }
    return revision === `sha256:${hash.digest('hex')}` ? 'match' : 'mismatch';
  }

  private async prepareParentDirectories(remotePath: string): Promise<void> {
    const separator = remotePath.lastIndexOf('/');
    if (separator < 0) return;
    const parentPath = remotePath.slice(0, separator);
    if (!parentPath || this.preparedDirectories.has(parentPath)) return;
    const parts = parentPath.split('/');
    const baseUrl = this.getBaseUrl();
    let path = '';
    let encodedPath = '';
    for (const part of parts) {
      path = path ? `${path}/${part}` : part;
      encodedPath += `${encodeURIComponent(part)}/`;
      if (this.preparedDirectories.has(path)) continue;
      const directory = new URL(encodedPath, baseUrl);
      const response = await this.request(directory, 'MKCOL');
      await this.cancelBody(response);
      if (response.status !== 201 && response.status !== 405) {
        throw httpFailure(response.status, `WebDAV parent directory creation failed (${response.status}).`);
      }
      this.preparedDirectories.add(path);
    }
  }

  private async cleanupProbe(fileUrl: URL | undefined, directoryUrl: URL): Promise<Error | undefined> {
    try {
      if (fileUrl) {
        const cleanupFile = await this.request(fileUrl, 'DELETE');
        if (!cleanupFile.ok && cleanupFile.status !== 404) return new WebDavFailure('review_required', `WebDAV probe file cleanup failed (${cleanupFile.status}).`);
      }
      const cleanupDirectory = await this.request(directoryUrl, 'DELETE');
      if (!cleanupDirectory.ok && cleanupDirectory.status !== 404) return new WebDavFailure('review_required', `WebDAV probe directory cleanup failed (${cleanupDirectory.status}).`);
    } catch (reason) {
      return new WebDavFailure('review_required', 'WebDAV probe cleanup result is uncertain.', { cause: reason });
    }
    return undefined;
  }

  private getBaseUrl(): URL {
    let endpoint: URL;
    try { endpoint = new URL(this.storage.endpoint); }
    catch (cause) { throw new WebDavFailure('configuration_required', 'Invalid WebDAV endpoint.', { cause }); }
    if (endpoint.protocol !== 'https:') throw new WebDavFailure('configuration_required', 'WebDAV endpoint must use HTTPS.');
    endpoint.pathname = `${endpoint.pathname.replace(/\/$/, '')}/${this.storage.targetPath.replace(/^\/+|\/+$/g, '')}/`;
    return endpoint;
  }

  private async cancelBody(response: Response): Promise<void> {
    try { await response.body?.cancel(); } catch (cause) { throw networkFailure(cause); }
  }

  private async probeMutation(url: URL, method: string, headers: HeadersInit, body?: BodyInit): Promise<Response> {
    try { return await this.request(url, method, headers, body); }
    catch (cause) { throw new WebDavFailure('review_required', `WebDAV probe ${method} result is uncertain.`, { cause }); }
  }

  private async request(url: URL, method: string, headers: HeadersInit = {}, body?: BodyInit): Promise<Response> {
    const credentials = Buffer.from(`${this.storage.username}:${this.storage.password}`).toString('base64');
    try { return await fetch(url, { body, headers: { Authorization: `Basic ${credentials}`, ...headers }, method, redirect: 'error' }); }
    catch (cause) { throw networkFailure(cause); }
  }
}
