import type { DesktopPairingBridge } from './pairing';

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
  status: 'idle' | 'running' | 'completed' | 'failed';
  totalFiles: number;
}

declare global {
  interface Window {
    kloda?: {
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
