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
  status: 'idle' | 'running' | 'completed' | 'failed' | 'stopped' | 'waiting_retry' | 'needs_review';
  contextId?: string;
  targetId?: string;
  sourceIds?: readonly string[];
  errorCode?: string;
  startedAt?: string;
  attempts?: number;
  retryAt?: number;
  nextOpportunityAt?: number;
  retryScheduleId?: string;
  reviewCount?: number;
  totalFiles: number;
}

export interface DesktopBridge {
  getDraft(): Promise<BackupDraft>;
  getProgress(): Promise<SyncProgress | null>;
  pickSources(): Promise<readonly DesktopSource[]>;
  saveSchedule(intervalHours: 12 | 24, localTime: string): Promise<void>;
  saveStorage(storage: StorageForm): Promise<void>;
  startSync(): Promise<SyncProgress>;
  testStorage(): Promise<void>;
}
