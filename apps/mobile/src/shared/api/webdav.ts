import * as SecureStore from 'expo-secure-store';

export interface MobileStorageForm {
  endpoint: string;
  password: string;
  targetPath: string;
  username: string;
}

const credentialKey = 'kloda.webdav.password';

export async function saveWebDavCredentials(storage: MobileStorageForm): Promise<void> {
  await SecureStore.setItemAsync(credentialKey, storage.password);
}

export async function testWebDavWriteAccess(storage: MobileStorageForm): Promise<void> {
  const endpoint = normalizeEndpoint(storage.endpoint);
  const targetUrl = new URL(normalizePath(storage.targetPath), ensureTrailingSlash(endpoint));
  const headers = { Authorization: basicAuthorization(storage.username, storage.password) };
  await request(targetUrl, { headers: { ...headers, Depth: '0' }, method: 'PROPFIND' });

  const probeDirectoryUrl = new URL(`.kloda-connection-test-${crypto.randomUUID()}/`, ensureTrailingSlash(targetUrl));
  const uploadUrl = new URL('upload', probeDirectoryUrl);
  const finalUrl = new URL('final', probeDirectoryUrl);
  let uploaded = false;
  let finalized = false;
  await request(probeDirectoryUrl, { headers, method: 'MKCOL' });
  try {
    await request(uploadUrl, {
      body: 'kloda-connection-test',
      headers: { ...headers, 'Content-Type': 'text/plain; charset=utf-8' },
      method: 'PUT',
    });
    uploaded = true;
    await request(uploadUrl, { headers: { ...headers, Destination: finalUrl.toString(), Overwrite: 'F' }, method: 'MOVE' });
    finalized = true;
    const read = await request(finalUrl, { headers, method: 'GET' });
    if (await read.text() !== 'kloda-connection-test') throw new Error('WebDAV read-back verification failed.');
  } finally {
    const fileToDelete = finalized ? finalUrl : uploaded ? uploadUrl : undefined;
    if (fileToDelete) await request(fileToDelete, { headers, method: 'DELETE' });
    await request(probeDirectoryUrl, { headers, method: 'DELETE' });
  }
}

function basicAuthorization(username: string, password: string): string {
  return `Basic ${btoa(unescape(encodeURIComponent(`${username}:${password}`)))}`;
}

function ensureTrailingSlash(url: URL): URL {
  return new URL(`${url.pathname.endsWith('/') ? url.pathname : `${url.pathname}/`}${url.search}`, url);
}

function normalizeEndpoint(value: string): URL {
  const endpoint = new URL(value);
  if (endpoint.protocol !== 'https:' || endpoint.username || endpoint.password) {
    throw new Error('WebDAV endpoint must use HTTPS without embedded credentials.');
  }
  return endpoint;
}

function normalizePath(value: string): string {
  const segments = value.split('/').filter(Boolean);
  if (segments.some((segment) => segment === '.' || segment === '..')) {
    throw new Error('WebDAV target path is invalid.');
  }
  return `${segments.map(encodeURIComponent).join('/')}/`;
}

async function request(url: URL, init: RequestInit): Promise<Response> {
  const response = await fetch(url, { ...init, redirect: 'error' });
  if (!response.ok && response.status !== 207) {
    throw new Error(`WebDAV request failed with status ${response.status}.`);
  }
  return response;
}
