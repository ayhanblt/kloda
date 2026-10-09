export const PAIRING_VERSION = 1;
export const QR_PREFIX = 'KLODA-PAIR:';
export const MAX_QR_WIRE_BYTES = 512;
export const MAX_QR_JSON_BYTES = 375;
export const INVITATION_LIFETIME_MS = 120_000;
export const CHANNEL_DEADLINE_MS = 10_000;
export const PAIRING_ALPN = 'kloda-pair/1';
export const EXPORTER_LABEL = 'EXPORTER-KLODA-QR-PAIR-V1';
export const CONTEXT_DOMAIN = 'KLODA-QR-PAIR-V1';
export const PROOF_DOMAIN = 'KLODA-QR-PAIR-V1-PROOF';

export type PairingErrorCode =
  | 'invalid_qr' | 'unsupported_version' | 'lan_unavailable'
  | 'native_unsupported' | 'identity_unavailable' | 'continuity_lost'
  | 'tls_rejected' | 'proof_rejected' | 'invitation_expired'
  | 'candidate_stale' | 'already_paired' | 'storage_failure'
  | 'connection_closed' | 'outcome_unknown' | 'cancelled' | 'revoked';

export class PairingProtocolError extends Error {
  constructor(readonly code: PairingErrorCode) {
    super(code);
    this.name = 'PairingProtocolError';
  }
}
