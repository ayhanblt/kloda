import { fetch as nativeFetch } from 'expo/fetch';
import { uuid } from 'expo-modules-core';
import { webDavFailure, type WebDavDiagnostic, type WebDavDiagnosticStage } from './webdav-diagnostics';

export interface MobileStorageForm {
  endpoint: string;
  password: string;
  targetPath: string;
  username: string;
}

export function validateWebDavForm(storage: MobileStorageForm): URL {
  try {
    const endpoint = new URL(storage.endpoint);
    if (endpoint.protocol !== 'https:' || !endpoint.hostname || endpoint.username || endpoint.password
      || endpoint.search || endpoint.hash || !storage.username.trim() || storage.username.includes(':')
      || !storage.password || !storage.targetPath.split('/').some((segment) => segment.trim().length > 0)
      || Object.values(storage).some((value) => typeof value !== 'string' || value.includes('\0'))
      || storage.targetPath.split('/').some((segment) => segment === '.' || segment === '..')) throw new Error();
    return new URL(`${storage.targetPath.split('/').filter(Boolean).map(encodeURIComponent).join('/')}/`,
      new URL(endpoint.pathname.endsWith('/') ? endpoint.pathname : `${endpoint.pathname}/`, endpoint));
  } catch { throw new Error('webdav_fields'); }
}

export async function testWebDavWriteAccess(storage: MobileStorageForm, signal?: AbortSignal, beforeMutation?: () => Promise<void>): Promise<void> {
  const target = validateWebDavForm(storage);
  const headers = { Authorization: `Basic ${btoa(unescape(encodeURIComponent(`${storage.username}:${storage.password}`)))}` };
  // Last observed failing boundary; only fixed stage/kind and the Response status are recorded.
  let observed: WebDavDiagnostic | undefined;
  const fail = (message: string) => signal?.aborted
    ? webDavFailure(message === 'webdav_connection' ? 'webdav_cancelled' : 'webdav_cancelled_probe')
    : webDavFailure(message, observed);
  const request = async (url: URL, method: string, stage: WebDavDiagnosticStage, statuses: number[], extra: RequestInit = {}) => {
    if (signal?.aborted) throw new Error('webdav_cancelled');
    observed = undefined;
    try {
      const response = await nativeFetch(url.toString(), { ...extra, method, headers: { ...headers, ...extra.headers },
        credentials: 'omit', redirect: 'error', signal });
      if (!statuses.includes(response.status)) {
        observed = { stage, kind: 'http', status: response.status };
        await response.body?.cancel(); throw new Error('webdav_response');
      }
      if (method !== 'GET') await response.body?.cancel();
      return response;
    } catch (error) { observed ??= { stage, kind: 'transport_unknown' }; throw error; }
  };
  try { await request(target, 'PROPFIND', 'propfind', [207], { headers: { Depth: '0' } }); }
  catch { throw fail('webdav_connection'); }
  const directory = new URL(`.kloda-connection-test-${uuid.v4()}/`, target);
  const upload = new URL('upload', directory), final = new URL('final', directory);
  const marker = 'kloda-connection-test';
  await beforeMutation?.();
  try {
    // Only a newly created collection permits subsequent probe writes.
    await request(directory, 'MKCOL', 'mkcol', [201]);
    await request(upload, 'PUT', 'put', [201], { body: marker, headers: { 'If-None-Match': '*', 'Content-Type': 'text/plain; charset=utf-8' } });
    await request(upload, 'MOVE', 'move', [201], { headers: { Destination: final.toString(), Overwrite: 'F' } });
    const response = await request(final, 'GET', 'get', [200]);
    const mismatch = () => { observed = { stage: 'get', kind: 'readback_mismatch' }; return new Error('webdav_response'); };
    const reader = response.body?.getReader();
    if (!reader) throw mismatch();
    let offset = 0;
    try {
      for (;;) {
        observed = { stage: 'get', kind: 'transport_unknown' };
        const { done, value } = await reader.read();
        if (done) break;
        for (const byte of value) if (offset >= marker.length || byte !== marker.charCodeAt(offset++)) throw mismatch();
      }
      if (offset !== marker.length) throw mismatch();
    } finally { await reader.cancel(); reader.releaseLock(); }
    await request(final, 'DELETE', 'delete_file', [200, 204]);
    await request(directory, 'DELETE', 'delete_directory', [200, 204]);
  } catch {
    // A lost write/MOVE reply is not permission to adopt or recursively clean unknown content.
    throw fail('webdav_probe_incomplete');
  }
}
