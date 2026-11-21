import { describe, expect, it } from 'vitest';

import { diagnosticReasonKey, parseStorageTestResult } from './webdav-test-result';

const secret = 'public-secret-sentinel';

describe('storage test reply parser', () => {
  it('G24-06: only an explicit ok=true is success; void and malformed replies are generic failures', () => {
    expect(parseStorageTestResult({ ok: true, extra: secret })).toEqual({ ok: true });
    for (const reply of [undefined, null, 'ok', true, {}, { ok: 'true' }, { ok: 1 }]) {
      expect(parseStorageTestResult(reply)).toEqual({ ok: false, code: 'unknown' });
    }
  });

  it('G24-04/06: keeps allowlisted code and diagnostic fields and drops everything else', () => {
    const reply = parseStorageTestResult({ ok: false, code: 'access_denied', message: secret,
      diagnostic: { stage: 'put', kind: 'http', status: 401, host: secret } });
    expect(reply).toEqual({ ok: false, code: 'access_denied', diagnostic: { stage: 'put', kind: 'http', status: 401 } });
    expect(parseStorageTestResult({ ok: false, code: 'review_required', diagnostic: { stage: 'get', kind: 'readback_mismatch', status: 200 } }))
      .toEqual({ ok: false, code: 'review_required', diagnostic: { stage: 'get', kind: 'readback_mismatch' } });
    expect(JSON.stringify(reply)).not.toContain(secret);
  });

  it.each([
    { code: secret }, { code: 'unknown', diagnostic: { stage: secret, kind: 'http', status: 404 } },
    { code: 'unknown', diagnostic: { stage: 'put', kind: 'http', status: 404.5 } },
    { code: 'unknown', diagnostic: { stage: 'put', kind: 'http', status: 600 } },
    { code: 'unknown', diagnostic: { stage: 'put', kind: 'http' } },
    { code: 'unknown', diagnostic: { stage: 'put', kind: secret } },
  ])('G24-06: rejects forged code/diagnostic %#', (reply) => {
    expect(parseStorageTestResult({ ok: false, ...reply })).toEqual({ ok: false, code: 'unknown' });
  });

  it('maps HTTP statuses to stable reason keys', () => {
    const key = (status: number) => diagnosticReasonKey({ stage: 'propfind', kind: 'http', status });
    expect([401, 403, 404, 405, 500].map(key)).toEqual(['access_denied', 'access_denied', 'not_found', 'method_rejected', 'http_other']);
    expect(diagnosticReasonKey({ stage: 'get', kind: 'transport_unknown' })).toBe('transport_unknown');
  });
});
