import type { DesktopPairingBridge, PairingStatus } from './pairing';
import type { PairingErrorCode } from './pairing';

export interface PairedDevice {
  recordId: string;
  peerFingerprint: string;
  trust: 'complete' | 'consumed_pending_ack' | 'revoked';
  backupScope: PairingStatus['backupScope'];
}

export interface PairedDevicesPage {
  items: readonly PairedDevice[];
  nextCursor?: string;
}

export interface IncomingTransfer {
  id: string;
  deviceFingerprint: string;
  name: string;
  receivedBytes: string;
  totalBytes: string;
  state: 'receiving' | 'validating' | 'publishing' | 'completed';
}

export interface IncomingActivityPage {
  receiverAvailable: boolean;
  errorCode?: PairingErrorCode;
  items: readonly IncomingTransfer[];
  nextCursor?: string;
}

export interface BackupVersion {
  id: string;
  deviceFingerprint: string;
  name: string;
  size: string;
  sourceRevision: string;
  kind: 'files' | 'photos';
  state: 'active' | 'trash' | 'unavailable';
  deletedAt?: string;
  expiresAt?: string;
  errorCode?: string;
}

export interface BackupVersionPage {
  items: readonly BackupVersion[];
  nextCursor?: string;
}

export interface BackupMutationResult {
  items: readonly { id: string; success: boolean; errorCode?: string }[];
}

export interface BackgroundStatus {
  receiver: { available: boolean; activeTransfers: number; errorCode?: PairingErrorCode };
  backup: { active: boolean; failed: boolean };
  autostart: { enabled: boolean; supported: boolean; reason?: string };
  autostartChoice: boolean | null;
  canHide: boolean;
  environmentLimited: boolean;
  shutdownError: boolean;
}

export interface DesktopSource {
  displayName: string;
  id: string;
}

export interface BackupDraft {
  intervalHours: 12 | 24;
  localTime: string;
  sources: readonly DesktopSource[];
  storage: { endpoint: string; targetPath: string; username: string } | null;
  storageTested: boolean;
}

export interface SyncProgress {
  bytesTransferred: number;
  bytesTotal: number;
  completedFiles: number;
  id: string;
  status: 'idle' | 'running' | 'completed' | 'failed' | 'stopped' | 'waiting_retry' | 'needs_review';
  contextId?: string;
  targetId?: string;
  sourceIds?: readonly string[];
  errorCode?: string;
  startedAt?: string;
  attempts?: number;
  retryAt?: number;
  nextOpportunityAt?: number;
  reviewCount?: number;
  totalFiles: number;
}

export interface WebDavIssue {
  id: string;
  targetId: string;
  sourceId: string;
  relativePath: string;
  revision: string;
  phase: string;
  errorCode: string;
  skipped: boolean;
  canKeepBoth: boolean;
  publishedPath?: string;
}

declare global {
  interface Window {
    kloda?: {
      webdav?: {
        issues(): Promise<readonly WebDavIssue[]>;
        review(id: string, action: 'recheck' | 'keep_both' | 'skip', language: 'tr' | 'en' | 'de'): Promise<void>;
      };
      backups?: {
        list(after?: string, trash?: boolean): Promise<BackupVersionPage>;
        trash(ids: string[], language: 'tr' | 'en' | 'de'): Promise<BackupMutationResult>;
        restore(ids: string[], language: 'tr' | 'en' | 'de'): Promise<BackupMutationResult>;
      };
      background?: {
        activity?(after?: string): Promise<IncomingActivityPage>;
        status(): Promise<BackgroundStatus>;
        setAutostart(enabled: boolean): Promise<BackgroundStatus>;
        quit(): Promise<void>;
      };
      devices?: {
        list(after?: string): Promise<PairedDevicesPage>;
        approveBackup(recordId: string): Promise<unknown>;
        revokeBackup(recordId: string): Promise<unknown>;
        removeDevice?(recordId: string, language: 'tr' | 'en' | 'de'): Promise<unknown>;
      };
      pairing?: DesktopPairingBridge;
      getDraft(): Promise<BackupDraft>;
      getProgress(): Promise<SyncProgress | null>;
      pickSources(): Promise<readonly DesktopSource[]>;
      saveSchedule(intervalHours: 12 | 24, localTime: string): Promise<void>;
      saveStorage(storage: { endpoint: string; password: string; targetPath: string; username: string }): Promise<void>;
      startSync(): Promise<SyncProgress>;
      testStorage(): Promise<void>;
    };
  }
}

export function getDesktopBridge(): NonNullable<Window['kloda']> {
  if (!window.kloda) throw new Error('Kloda desktop services are unavailable.');
  return window.kloda;
}
