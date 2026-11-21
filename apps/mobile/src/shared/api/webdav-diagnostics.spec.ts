import { safeWebDavDiagnostic, webDavDiagnostic, webDavFailure } from './webdav-diagnostics';

it('G24-06: projection copies only allowlisted stage/kind/status and rejects malformed payloads', () => {
  const secret = 'Authorization: Basic c2VjcmV0 https://user@fixture.example/dav?token=x';
  expect(safeWebDavDiagnostic({ stage: 'put', kind: 'http', status: 404, message: secret, host: secret }))
    .toEqual({ stage: 'put', kind: 'http', status: 404 });
  expect(safeWebDavDiagnostic({ stage: 'get', kind: 'readback_mismatch', status: 200, cause: secret }))
    .toEqual({ stage: 'get', kind: 'readback_mismatch' });
  for (const malformed of [null, 'propfind', { stage: secret, kind: 'http', status: 404 }, { stage: 'put', kind: secret },
    { stage: 'put', kind: 'http' }, { stage: 'put', kind: 'http', status: 99 }, { stage: 'put', kind: 'http', status: 600 },
    { stage: 'put', kind: 'http', status: 404.5 }, { stage: 'put', kind: 'http', status: '404' }]) {
    expect(safeWebDavDiagnostic(malformed)).toBeUndefined();
  }
});

it('G24-06: metadata stays off the Error object and is absent for foreign errors', () => {
  const error = webDavFailure('webdav_connection', { stage: 'propfind', kind: 'http', status: 401 });
  expect(Object.keys(error)).toEqual([]);
  expect(JSON.stringify(error)).toBe('{}');
  expect(error.message).toBe('webdav_connection');
  expect(webDavDiagnostic(error)).toEqual({ stage: 'propfind', kind: 'http', status: 401 });
  expect(webDavDiagnostic(Object.assign(new Error('webdav_connection'), { stage: 'propfind', kind: 'http', status: 401 }))).toBeUndefined();
  expect(webDavDiagnostic('webdav_connection')).toBeUndefined();
});
