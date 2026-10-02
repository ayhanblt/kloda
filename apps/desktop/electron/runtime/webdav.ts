import { randomUUID } from 'node:crypto';

import type { StorageForm } from './types.js';

export class NodeWebDavClient {
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
    if (!directory.ok && directory.status !== 207) throw new Error(`WebDAV directory access failed (${directory.status}).`);

    const createProbeDirectory = await this.request(probeDirectoryUrl, 'MKCOL');
    if (!createProbeDirectory.ok) throw new Error(`WebDAV probe directory creation failed (${createProbeDirectory.status}).`);
    try {
      const upload = await this.request(uploadUrl, 'PUT', { 'Content-Type': 'text/plain' }, probePayload);
      if (!upload.ok) throw new Error(`WebDAV write failed (${upload.status}).`);
      uploaded = true;

      const move = await this.request(uploadUrl, 'MOVE', { Destination: finalUrl.toString(), Overwrite: 'F' });
      if (!move.ok) throw new Error(`WebDAV finalize failed (${move.status}).`);
      finalized = true;

      const read = await this.request(finalUrl, 'GET');
      if (!read.ok || await read.text() !== probePayload) throw new Error('WebDAV read-back verification failed.');
    } catch (reason) {
      operationFailure = reason;
    }

    const cleanupFailure = await this.cleanupProbe(finalized ? finalUrl : uploaded ? uploadUrl : undefined, probeDirectoryUrl);
    if (cleanupFailure) throw cleanupFailure;
    if (operationFailure) throw operationFailure;
  }

  async uploadFile(remotePath: string, temporaryRemotePath: string, file: Blob): Promise<void> {
    const target = new URL(remotePath.split('/').map(encodeURIComponent).join('/'), this.getBaseUrl());
    const temporary = new URL(temporaryRemotePath.split('/').map(encodeURIComponent).join('/'), this.getBaseUrl());
    const upload = await this.request(temporary, 'PUT', { 'If-None-Match': '*' }, file);
    if (!upload.ok) throw new Error(`WebDAV upload failed (${upload.status}).`);
    const finalize = await this.request(temporary, 'MOVE', { Destination: target.toString(), Overwrite: 'F' });
    if (!finalize.ok) {
      await this.cleanupTemporaryUpload(temporary);
      throw new Error(`WebDAV finalize failed (${finalize.status}).`);
    }
  }

  async removeTemporaryUpload(temporaryRemotePath: string): Promise<void> {
    const temporary = new URL(temporaryRemotePath.split('/').map(encodeURIComponent).join('/'), this.getBaseUrl());
    await this.cleanupTemporaryUpload(temporary);
  }

  private async cleanupProbe(fileUrl: URL | undefined, directoryUrl: URL): Promise<Error | undefined> {
    try {
      if (fileUrl) {
        const cleanupFile = await this.request(fileUrl, 'DELETE');
        if (!cleanupFile.ok && cleanupFile.status !== 404) return new Error(`WebDAV probe file cleanup failed (${cleanupFile.status}).`);
      }
      const cleanupDirectory = await this.request(directoryUrl, 'DELETE');
      if (!cleanupDirectory.ok && cleanupDirectory.status !== 404) return new Error(`WebDAV probe directory cleanup failed (${cleanupDirectory.status}).`);
    } catch (reason) {
      return reason instanceof Error ? reason : new Error('WebDAV probe cleanup failed.');
    }
    return undefined;
  }

  private async cleanupTemporaryUpload(url: URL): Promise<void> {
    const response = await this.request(url, 'DELETE');
    if (!response.ok && response.status !== 404) throw new Error(`WebDAV temporary upload cleanup failed (${response.status}).`);
  }

  private getBaseUrl(): URL {
    const endpoint = new URL(this.storage.endpoint);
    if (endpoint.protocol !== 'https:') throw new Error('WebDAV endpoint must use HTTPS.');
    endpoint.pathname = `${endpoint.pathname.replace(/\/$/, '')}/${this.storage.targetPath.replace(/^\/+|\/+$/g, '')}/`;
    return endpoint;
  }

  private request(url: URL, method: string, headers: HeadersInit = {}, body?: BodyInit): Promise<Response> {
    const credentials = Buffer.from(`${this.storage.username}:${this.storage.password}`).toString('base64');
    return fetch(url, { body, headers: { Authorization: `Basic ${credentials}`, ...headers }, method, redirect: 'error' });
  }
}
