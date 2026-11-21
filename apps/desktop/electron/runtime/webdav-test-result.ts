import { failureCode, WebDavFailure } from './webdav-errors.js';
import type { WebDavDiagnostic, WebDavDiagnosticStage, WebDavFailureCode } from './webdav-errors.js';

export type StorageTestReply = { ok: true } | { ok: false; code: WebDavFailureCode; diagnostic?: WebDavDiagnostic };

const stages: readonly WebDavDiagnosticStage[] = ['propfind', 'mkcol', 'put', 'move', 'get', 'delete_file', 'delete_directory'];

// Rebuilds the diagnostic from allowlisted fields only; anything else is dropped before IPC.
function safeDiagnostic(value: unknown): WebDavDiagnostic | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const { stage, kind, status } = value as { stage?: unknown; kind?: unknown; status?: unknown };
  if (!stages.includes(stage as WebDavDiagnosticStage)) return undefined;
  const safeStage = stage as WebDavDiagnosticStage;
  if (kind === 'transport_unknown' || kind === 'readback_mismatch') return { stage: safeStage, kind };
  if (kind === 'http' && Number.isInteger(status) && (status as number) >= 100 && (status as number) <= 599) {
    return { stage: safeStage, kind, status: status as number };
  }
  return undefined;
}

export async function storageTestReply(test: () => Promise<void>): Promise<StorageTestReply> {
  try {
    await test();
    return { ok: true };
  } catch (error) {
    const diagnostic = safeDiagnostic(error instanceof WebDavFailure ? error.diagnostic : undefined);
    return diagnostic ? { ok: false, code: failureCode(error), diagnostic } : { ok: false, code: failureCode(error) };
  }
}
