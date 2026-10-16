import { requireOptionalNativeModule } from 'expo';

import { PairingError, pairingErrorCode, type PairingErrorCode } from './pairing-errors';

export { PairingError, pairingErrorCode } from './pairing-errors';
export type { PairingErrorCode } from './pairing-errors';

const phases = ['idle', 'open', 'connecting', 'reserved', 'consumed_pending_ack', 'complete', 'pending', 'invalid', 'revoked'] as const;
export type PairingPhase = typeof phases[number];
const hardwareClasses: Record<NonNullable<PairingStatus['hardwareClass']>, true> = {
  secure_enclave: true, strongbox: true, hardware_tee: true, secure_hardware: true, windows_tpm: true,
};
export interface PairingStatus {
  phase: PairingPhase;
  operationId?: string;
  candidateGeneration?: string;
  peerFingerprint?: string;
  qr?: string;
  remainingMs?: number;
  recordId?: string;
  repairRequired?: boolean;
  errorCode?: PairingErrorCode;
  hardwareClass?: 'secure_enclave' | 'strongbox' | 'hardware_tee' | 'secure_hardware' | 'windows_tpm';
  unpairResult?: { state: 'pc_confirmed' | 'pc_unconfirmed' | 'local_only'; errorCode?: PairingErrorCode };
}

export interface PairingApi {
  status(): Promise<PairingStatus>;
  scan(qr: string): Promise<PairingStatus>;
  approve(operationId: string, candidateGeneration: string): Promise<PairingStatus>;
  deny(operationId: string, candidateGeneration: string): Promise<PairingStatus>;
  cancel(operationId: string): Promise<PairingStatus>;
  resume(recordId: string): Promise<PairingStatus>;
  removePairing(recordId: string, online: boolean): Promise<PairingStatus>;
  close(): Promise<void>;
}

interface NativePairingModule {
  status(): Promise<unknown>;
  scan(qr: string): Promise<unknown>;
  approve(operationId: string, candidateGeneration: string): Promise<unknown>;
  deny(operationId: string, candidateGeneration: string): Promise<unknown>;
  cancel(operationId: string): Promise<unknown>;
  resume(recordId: string): Promise<unknown>;
  removePairing(recordId: string, online: boolean): Promise<unknown>;
  close(): Promise<void>;
}

function module(): NativePairingModule {
  const native = requireOptionalNativeModule<NativePairingModule>('KlodaPairing');
  if (!native) throw new PairingError('native_unsupported');
  return native;
}

function optionalText(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string') throw new PairingError('outcome_unknown');
  return value;
}

function statusFromNative(value: unknown): PairingStatus {
  if (typeof value !== 'object' || value === null || !('phase' in value)) throw new PairingError('outcome_unknown');
  const phase = phases.find((known) => known === value.phase);
  if (!phase) throw new PairingError('outcome_unknown');
  const repairRequired = 'repairRequired' in value ? value.repairRequired : undefined;
  if (repairRequired != null && typeof repairRequired !== 'boolean') throw new PairingError('outcome_unknown');
  const remainingMs = 'remainingMs' in value ? value.remainingMs : undefined;
  if (remainingMs != null && (typeof remainingMs !== 'number' || !Number.isFinite(remainingMs) || remainingMs < 0)) {
    throw new PairingError('outcome_unknown');
  }
  const hardwareClass = 'hardwareClass' in value ? value.hardwareClass : undefined;
  const unpairResult = 'unpairResult' in value ? value.unpairResult : undefined;
  let unpair: PairingStatus['unpairResult'];
  if (unpairResult != null) {
    if (typeof unpairResult !== 'object' || !('state' in unpairResult)) throw new PairingError('outcome_unknown');
    const state = unpairResult.state;
    if (state !== 'pc_confirmed' && state !== 'pc_unconfirmed' && state !== 'local_only') throw new PairingError('outcome_unknown');
    if (state === 'pc_unconfirmed' ? phase !== 'complete' : phase !== 'revoked') throw new PairingError('outcome_unknown');
    unpair = { state, errorCode: 'errorCode' in unpairResult ? pairingErrorCode({ code: unpairResult.errorCode }) : undefined };
  }
  return {
    phase,
    operationId: optionalText('operationId' in value ? value.operationId : undefined),
    candidateGeneration: optionalText('candidateGeneration' in value ? value.candidateGeneration : undefined),
    peerFingerprint: optionalText('peerFingerprint' in value ? value.peerFingerprint : undefined),
    recordId: optionalText('recordId' in value ? value.recordId : undefined),
    remainingMs: typeof remainingMs === 'number' ? remainingMs : undefined,
    repairRequired: typeof repairRequired === 'boolean' ? repairRequired : undefined,
    errorCode: 'errorCode' in value ? pairingErrorCode({ code: value.errorCode }) : undefined,
    hardwareClass: typeof hardwareClass === 'string' && Object.prototype.hasOwnProperty.call(hardwareClasses, hardwareClass)
      ? hardwareClass as PairingStatus['hardwareClass'] : undefined,
    unpairResult: unpair,
  };
}

async function invoke(action: (native: NativePairingModule) => Promise<unknown>): Promise<PairingStatus> {
  try {
    return statusFromNative(await action(module()));
  } catch (error) {
    throw new PairingError(pairingErrorCode(error));
  }
}

// Only the native runtime parses QR, authenticates TLS/proof, and writes trust.
export const pairing: PairingApi = {
  status: () => invoke((native) => native.status()),
  scan: (qr) => invoke((native) => native.scan(qr)),
  approve: (operationId, generation) => invoke((native) => native.approve(operationId, generation)),
  deny: (operationId, generation) => invoke((native) => native.deny(operationId, generation)),
  cancel: (operationId) => invoke((native) => native.cancel(operationId)),
  resume: (recordId) => invoke((native) => native.resume(recordId)),
  removePairing: (recordId, online) => invoke((native) => native.removePairing(recordId, online)),
  close: async () => {
    try { await module().close(); }
    catch (error) { throw new PairingError(pairingErrorCode(error)); }
  },
};
