export type PairingPhase =
  | 'idle' | 'open' | 'reserved' | 'consumed_pending_ack'
  | 'complete' | 'connecting' | 'pending' | 'invalid' | 'revoked';

export interface PairingStatus {
  phase: PairingPhase;
  operationId?: string;
  candidateGeneration?: string;
  peerFingerprint?: string;
  peerName?: string;
  qr?: string;
  remainingMs?: number;
  recordId?: string;
  repairRequired?: boolean;
  errorCode?: PairingErrorCode;
  backupScope?: {
    state: 'not_approved' | 'approved' | 'revoked' | 'unavailable';
    folder?: string;
    peerFolder?: string;
    revision?: string;
    errorCode?: PairingErrorCode;
  };
  hardwareClass?: 'secure_enclave' | 'strongbox' | 'hardware_tee' | 'secure_hardware' | 'windows_tpm';
}

export function formatBackupFolder(folder?: string, peerFolder?: string): string | undefined {
  if (!folder) return undefined;
  if (!peerFolder) return folder;
  const sep = folder.includes('\\') && !folder.includes('/') ? '\\' : '/';
  const rootOnly = folder === '/' || /^[A-Za-z]:[\\/]$/.test(folder);
  const trimmed = rootOnly ? folder : folder.replace(/[\\/]+$/, '');
  return trimmed.endsWith(sep) ? `${trimmed}${peerFolder}` : `${trimmed}${sep}${peerFolder}`;
}

export interface DesktopPairingBridge {
  status(): Promise<PairingStatus>;
  createInvitation(): Promise<PairingStatus>;
  approve(operationId: string, candidateGeneration: string): Promise<PairingStatus>;
  deny(operationId: string, candidateGeneration: string): Promise<PairingStatus>;
  cancel(operationId: string): Promise<PairingStatus>;
  resume(recordId: string): Promise<PairingStatus>;
  approveBackup(recordId: string, language?: 'tr' | 'en' | 'de', theme?: 'dark' | 'light'): Promise<PairingStatus>;
  revokeBackup(recordId: string): Promise<PairingStatus>;
  close(): Promise<void>;
}

export const pairingErrorCodes = [
  'invalid_qr', 'unsupported_version', 'lan_unavailable', 'native_unsupported',
  'identity_unavailable', 'continuity_lost', 'tls_rejected', 'proof_rejected',
  'invitation_expired', 'candidate_stale', 'already_paired', 'storage_failure',
  'connection_closed', 'outcome_unknown', 'cancelled', 'revoked',
  'acl_busy', 'acl_unavailable', 'backup_unavailable', 'backup_permission_denied',
  'backup_path_rejected', 'backup_scope_changed',
  'backup_full', 'backup_busy',
] as const;

export type PairingErrorCode = typeof pairingErrorCodes[number];

export class PairingError extends Error {
  constructor(readonly code: PairingErrorCode) {
    super(code);
    this.name = 'PairingError';
  }
}

export function pairingErrorCode(reason: unknown): PairingErrorCode {
  const code = typeof reason === 'string' ? reason
    : reason !== null && typeof reason === 'object' && 'code' in reason ? reason.code : undefined;
  return typeof code === 'string' && pairingErrorCodes.includes(code as PairingErrorCode)
    ? code as PairingErrorCode : 'outcome_unknown';
}

export function getPairingBridge(): DesktopPairingBridge {
  const bridge = window.kloda?.pairing;
  if (!bridge || ['status', 'createInvitation', 'approve', 'deny', 'cancel', 'resume', 'approveBackup', 'revokeBackup', 'close']
    .some((method) => typeof bridge[method as keyof DesktopPairingBridge] !== 'function')) {
    throw new PairingError('native_unsupported');
  }
  return bridge;
}
