export const pairingErrorCodes = [
  'invalid_qr', 'unsupported_version', 'lan_unavailable', 'native_unsupported',
  'identity_unavailable', 'continuity_lost', 'tls_rejected', 'proof_rejected',
  'invitation_expired', 'candidate_stale', 'already_paired', 'storage_failure',
  'connection_closed', 'outcome_unknown', 'cancelled', 'revoked',
] as const;

export type PairingErrorCode = typeof pairingErrorCodes[number];

export class PairingError extends Error {
  constructor(readonly code: PairingErrorCode) {
    super(code);
    this.name = 'PairingError';
  }
}

export function pairingErrorCode(error: unknown): PairingErrorCode {
  if (error instanceof PairingError) return error.code;
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = error.code;
    if (pairingErrorCodes.some((known) => known === code)) return code as PairingErrorCode;
  }
  return 'outcome_unknown';
}
