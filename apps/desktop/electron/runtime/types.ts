export interface DesktopSource {
  id: string;
  displayName: string;
}

export interface StorageForm {
  endpoint: string;
  password: string;
  targetPath: string;
  username: string;
}

export interface BackupDraft {
  intervalHours: 12 | 24;
  localTime: string;
  sources: readonly DesktopSource[];
  storage: Omit<StorageForm, 'password'> | null;
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

export interface DesktopBridge {
  getDraft(): Promise<BackupDraft>;
  pickSources(): Promise<readonly DesktopSource[]>;
  saveSchedule(intervalHours: 12 | 24, localTime: string): Promise<void>;
  saveStorage(storage: StorageForm): Promise<void>;
  startSync(): Promise<SyncProgress>;
  testStorage(): Promise<void>;
}
