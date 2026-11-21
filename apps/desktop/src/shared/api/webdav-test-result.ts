// Renderer-side allowlist for the kloda:test-storage reply; IPC data is treated as untrusted.
export const storageTestCodes = [
  'connection_unavailable', 'access_denied', 'storage_full', 'source_changed', 'review_required',
  'configuration_required', 'settings_changed', 'interrupted', 'retry_exhausted', 'backup_busy', 'unknown',
] as const;
export type StorageTestCode = (typeof storageTestCodes)[number];

const stages = ['propfind', 'mkcol', 'put', 'move', 'get', 'delete_file', 'delete_directory'] as const;
export type StorageTestStage = (typeof stages)[number];
export type StorageTestDiagnostic =
  | { stage: StorageTestStage; kind: 'http'; status: number }
  | { stage: StorageTestStage; kind: 'transport_unknown' | 'readback_mismatch' };
export type StorageTestResult = { ok: true } | { ok: false; code: StorageTestCode; diagnostic?: StorageTestDiagnostic };

function parseDiagnostic(value: unknown): StorageTestDiagnostic | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const { stage, kind, status } = value as Record<string, unknown>;
  if (!stages.includes(stage as StorageTestStage)) return undefined;
  const safeStage = stage as StorageTestStage;
  if (kind === 'transport_unknown' || kind === 'readback_mismatch') return { stage: safeStage, kind };
  if (kind === 'http' && Number.isInteger(status) && (status as number) >= 100 && (status as number) <= 599) {
    return { stage: safeStage, kind, status: status as number };
  }
  return undefined;
}

// Only an explicit ok=true is success; void, malformed or unknown replies are a generic failure.
export function parseStorageTestResult(value: unknown): StorageTestResult {
  if (!value || typeof value !== 'object') return { ok: false, code: 'unknown' };
  const reply = value as Record<string, unknown>;
  if (reply.ok === true) return { ok: true };
  const code = storageTestCodes.includes(reply.code as StorageTestCode) ? reply.code as StorageTestCode : 'unknown';
  const diagnostic = parseDiagnostic(reply.diagnostic);
  return diagnostic ? { ok: false, code, diagnostic } : { ok: false, code };
}

export function diagnosticReasonKey(diagnostic: StorageTestDiagnostic): string {
  if (diagnostic.kind !== 'http') return diagnostic.kind;
  if (diagnostic.status === 401 || diagnostic.status === 403) return 'access_denied';
  if (diagnostic.status === 404) return 'not_found';
  if (diagnostic.status === 405) return 'method_rejected';
  return 'http_other';
}
