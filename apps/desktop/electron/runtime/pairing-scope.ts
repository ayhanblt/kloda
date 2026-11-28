import type { NativePairingOwner } from './native-pairing-owner.js';

export function scopeSnapshot(
  native: unknown,
  record: string,
): { fingerprint: string; peerName?: string; revision?: string } {
  if (!native || typeof native !== 'object') throw new Error('candidate_stale');
  const status = native as {
    phase?: unknown;
    recordId?: unknown;
    peerFingerprint?: unknown;
    peerName?: unknown;
    backupScope?: { revision?: unknown };
  };
  if (
    status.phase !== 'complete' ||
    status.recordId !== record ||
    typeof status.peerFingerprint !== 'string' ||
    !/^[A-Za-z0-9_-]{43}$/.test(status.peerFingerprint)
  ) {
    throw new Error('candidate_stale');
  }
  const peerName =
    typeof status.peerName === 'string' && status.peerName.trim().length > 0
      ? status.peerName.trim()
      : undefined;
  const revision = status.backupScope?.revision;
  if (revision !== undefined && (typeof revision !== 'string' || !/^[1-9][0-9]{0,18}$/.test(revision))) {
    throw new Error('candidate_stale');
  }
  return { fingerprint: status.peerFingerprint, peerName, revision };
}

export async function deviceScope(native: NativePairingOwner, record: string) {
  const row = JSON.parse(await native.pairedDevice(record)) as {
    trust?: string;
    recordId?: string;
    peerFingerprint?: string;
    peerName?: string;
    backupScope?: unknown;
  };
  return scopeSnapshot({ ...row, phase: row.trust }, record);
}
