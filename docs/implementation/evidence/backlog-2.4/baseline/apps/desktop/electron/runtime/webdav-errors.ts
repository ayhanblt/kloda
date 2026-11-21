export type WebDavFailureCode =
  | 'connection_unavailable' | 'access_denied' | 'storage_full' | 'source_changed' | 'review_required'
  | 'configuration_required' | 'settings_changed' | 'interrupted' | 'retry_exhausted' | 'backup_busy' | 'unknown';

export class WebDavFailure extends Error {
  constructor(readonly code: WebDavFailureCode, message: string = code, options?: ErrorOptions) {
    super(message, options);
    this.name = 'WebDavFailure';
  }
}

export function failureCode(error: unknown): WebDavFailureCode {
  const visited = new Set<unknown>();
  let current = error;
  while (current && typeof current === 'object' && !visited.has(current)) {
    visited.add(current);
    if (current instanceof WebDavFailure) return current.code;
    const { code, cause } = current as { code?: unknown; cause?: unknown };
    if (typeof code === 'string') {
      if (code === 'ENOSPC') return 'storage_full';
      if (code === 'ENOENT') return 'source_changed';
      if (code === 'EACCES' || code === 'EPERM' || code.startsWith('CERT_') || code.startsWith('ERR_TLS_') ||
        ['DEPTH_ZERO_SELF_SIGNED_CERT', 'SELF_SIGNED_CERT_IN_CHAIN', 'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
          'UNABLE_TO_GET_ISSUER_CERT', 'UNABLE_TO_GET_ISSUER_CERT_LOCALLY'].includes(code)) return 'access_denied';
    }
    current = cause;
  }
  return 'unknown';
}

export function httpFailure(status: number, message = `WebDAV request failed (${status}).`): WebDavFailure {
  const code = status === 401 || status === 403 ? 'access_denied' : status === 507 ? 'storage_full' :
    status === 408 || status === 423 || status === 429 || status >= 500 && status <= 599 ? 'connection_unavailable' :
    status === 409 || status === 412 ? 'review_required' : 'unknown';
  return new WebDavFailure(code, message);
}

// Only errors caught at the actual network boundary receive a transient classification.
export function networkFailure(error: unknown): WebDavFailure {
  if (error instanceof WebDavFailure) return error;
  return new WebDavFailure(failureCode(error) === 'access_denied' ? 'access_denied' : 'connection_unavailable',
    error instanceof Error ? error.message : 'WebDAV connection failed.', { cause: error });
}
