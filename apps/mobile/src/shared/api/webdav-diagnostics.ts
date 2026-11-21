export const webDavDiagnosticStages = ['propfind', 'mkcol', 'put', 'move', 'get', 'delete_file', 'delete_directory'] as const;
export type WebDavDiagnosticStage = typeof webDavDiagnosticStages[number];
export type WebDavDiagnostic =
  | { stage: WebDavDiagnosticStage; kind: 'http'; status: number }
  | { stage: WebDavDiagnosticStage; kind: 'transport_unknown' | 'readback_mismatch' };

// RAM-only presentation metadata for the current test result; never persisted, logged or serialized with the Error.
const observed = new WeakMap<object, WebDavDiagnostic>();

export function webDavFailure(message: string, diagnostic?: WebDavDiagnostic): Error {
  const error = new Error(message);
  const safe = diagnostic && safeWebDavDiagnostic(diagnostic);
  if (safe) observed.set(error, safe);
  return error;
}

export function webDavDiagnostic(error: unknown): WebDavDiagnostic | undefined {
  return error && typeof error === 'object' ? observed.get(error) : undefined;
}

// Allowlist projection: only a fixed stage/kind and an observed HTTP status integer survive.
export function safeWebDavDiagnostic(value: unknown): WebDavDiagnostic | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const { stage, kind, status } = value as Record<string, unknown>;
  if (!webDavDiagnosticStages.includes(stage as WebDavDiagnosticStage)) return undefined;
  const safeStage = stage as WebDavDiagnosticStage;
  if (kind === 'http') {
    return typeof status === 'number' && Number.isInteger(status) && status >= 100 && status <= 599
      ? { stage: safeStage, kind, status } : undefined;
  }
  return kind === 'transport_unknown' || kind === 'readback_mismatch' ? { stage: safeStage, kind } : undefined;
}
