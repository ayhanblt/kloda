export type IntervalHours = 12 | 24;
export type SourceKind = 'directory' | 'photos';
export type JobStatus =
  | 'queued'
  | 'running'
  | 'waiting-access'
  | 'waiting-os'
  | 'blocked'
  | 'completed';

export interface SyncSchedule {
  intervalHours: IntervalHours;
  localTime: `${number}${number}:${number}${number}`;
}

export interface BackupSource {
  id: string;
  kind: SourceKind;
  displayName: string;
}

export interface SyncJobSnapshot {
  id: string;
  sourceId: string;
  status: JobStatus;
  bytesTransferred: number;
  bytesTotal: number;
}

export interface ScheduledRunSnapshot {
  id: string;
  updated: 0 | 1;
  accessAttempts: number;
  osAttempts: number;
  jobIds: readonly string[];
}

export interface SourceAccessPort {
  selectSources(): Promise<readonly BackupSource[]>;
}

export interface CredentialVaultPort {
  save(reference: string, secret: string): Promise<void>;
  load(reference: string): Promise<string | null>;
}

export interface SyncJournalPort {
  getActiveJob(sourceId: string): Promise<SyncJobSnapshot | null>;
}

export interface WebDavPort {
  testConnection(): Promise<void>;
}

export interface SchedulerPort {
  schedule(schedule: SyncSchedule): Promise<void>;
  cancel(): Promise<void>;
}

export interface SyncRuntimePort {
  getSnapshot(): Promise<readonly SyncJobSnapshot[]>;
  startNow(): Promise<readonly SyncJobSnapshot[]>;
}
