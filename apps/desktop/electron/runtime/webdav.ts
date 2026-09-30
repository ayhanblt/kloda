import { randomUUID } from 'node:crypto';

import type { StorageForm } from './types.js';

export class NodeWebDavClient {
  constructor(private readonly storage: StorageForm) {}

  async verifyWriteAccess(): Promise<void> {
    const baseUrl = this.getBaseUrl();
    const probePath = `.kloda-probe-${randomUUID()}`;
    const probeUrl = new URL(probePath, baseUrl);
    const probePayload = 'kloda-webdav-probe';

    const directory = await this.request(baseUrl, 'PROPFIND', { Depth: '0' });
    if (!directory.ok && directory.status !== 207) throw new Error(`WebDAV directory access failed (${directory.status}).`);

    const upload = await this.request(probeUrl, 'PUT', { 'Content-Type': 'text/plain' }, probePayload);
    if (!upload.ok) throw new Error(`WebDAV write failed (${upload.status}).`);

    const read = await this.request(probeUrl, 'GET');
    if (!read.ok || await read.text() !== probePayload) throw new Error('WebDAV read-back verification failed.');

    const cleanup = await this.request(probeUrl, 'DELETE');
    if (!cleanup.ok && cleanup.status !== 404) throw new Error(`WebDAV probe cleanup failed (${cleanup.status}).`);
  }

  async uploadFile(remotePath: string, file: Blob): Promise<void> {
    const target = new URL(remotePath.split('/').map(encodeURIComponent).join('/'), this.getBaseUrl());
    const response = await this.request(target, 'PUT', { 'If-None-Match': '*' }, file);
    if (!response.ok) throw new Error(`WebDAV upload failed (${response.status}).`);
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
