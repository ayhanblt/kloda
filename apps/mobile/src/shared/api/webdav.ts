import { fetch as nativeFetch } from 'expo/fetch';
import { uuid } from 'expo-modules-core';
import { webDavFailure, type WebDavDiagnostic, type WebDavDiagnosticStage } from './webdav-diagnostics';

export interface MobileStorageForm {
  endpoint: string;
  password: string;
  targetPath: string;
  username: string;
}

function hasControlChars(value: string): boolean {
  return Array.from(value).some((char) => {
    const code = char.charCodeAt(0);
    return code < 32 || (code >= 127 && code <= 159);
  });
}

function parseWebDavTarget(storage: MobileStorageForm): { base: URL; target: URL; segments: string[] } {
  try {
    const endpoint = new URL(storage.endpoint);
    if (endpoint.protocol !== 'https:' || !endpoint.hostname || endpoint.username || endpoint.password
      || endpoint.search || endpoint.hash || !storage.username.trim() || storage.username.includes(':')
      || !storage.password || Object.values(storage).some((value) => typeof value !== 'string' || value.includes('\0'))
      || storage.targetPath.includes('\\') || hasControlChars(storage.targetPath)) throw new Error();
    const trimmed = storage.targetPath.trim();
    const segments = trimmed === '' || trimmed === '/' ? [] : storage.targetPath.split('/').filter((segment) => segment.length > 0);
    if (segments.some((segment) => segment.trim().length === 0 || segment === '.' || segment === '..' || new TextEncoder().encode(segment).length > 255)) {
      throw new Error();
    }
    const base = new URL(endpoint.pathname.endsWith('/') ? endpoint.pathname : `${endpoint.pathname}/`, endpoint);
    const target = segments.length === 0 ? base : new URL(`${segments.map(encodeURIComponent).join('/')}/`, base);
    return { base, target, segments };
  } catch { throw new Error('webdav_fields'); }
}

export function validateWebDavForm(storage: MobileStorageForm): URL {
  return parseWebDavTarget(storage).target;
}

export async function testWebDavWriteAccess(storage: MobileStorageForm, signal?: AbortSignal, beforeMutation?: () => Promise<void>): Promise<void> {
  const { base, target, segments } = parseWebDavTarget(storage);
  const headers = { Authorization: `Basic ${btoa(unescape(encodeURIComponent(`${storage.username}:${storage.password}`)))}` };
  let observed: WebDavDiagnostic | undefined;
  let mutated = false;
  const fail = (message: string) => signal?.aborted
    ? webDavFailure(message === 'webdav_connection' ? 'webdav_cancelled' : 'webdav_cancelled_probe')
    : webDavFailure(message, observed);
  const mutateOnce = async () => {
    if (mutated) return;
    mutated = true;
    await beforeMutation?.();
  };
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
  catch {
    if (observed?.stage !== 'propfind' || observed.kind !== 'http' || observed.status !== 404 || segments.length === 0) {
      throw fail('webdav_connection');
    }
    try { await request(base, 'PROPFIND', 'propfind', [207], { headers: { Depth: '0' } }); }
    catch { throw fail('webdav_connection'); }
    await mutateOnce();
    let current = base;
    for (let index = 0; index < segments.length; index += 1) {
      current = new URL(`${encodeURIComponent(segments[index])}/`, current);
      let exists = false;
      if (index < segments.length - 1) {
        try { await request(current, 'PROPFIND', 'propfind', [207], { headers: { Depth: '0' } }); exists = true; }
        catch {
          if (observed?.kind !== 'http' || observed.status !== 404) throw fail('webdav_connection');
        }
      }
      if (!exists) {
        try { await request(current, 'MKCOL', 'mkcol', [201]); }
        catch { throw fail('webdav_connection'); }
      }
    }
  }
  const directory = new URL(`.kloda-connection-test-${uuid.v4()}/`, target);
  const upload = new URL('upload', directory), final = new URL('final', directory);
  const marker = 'kloda-connection-test';
  await mutateOnce();
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
