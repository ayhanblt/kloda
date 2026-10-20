import { randomUUID } from 'node:crypto';
import { basename } from 'node:path';
import { dialog, type BrowserWindow } from 'electron';

import { DesktopSyncJournal } from './journal.js';
import { getNextScheduleOccurrence, nextAccessRetry } from '@kloda/sync-core';
import { testConnection } from './webdav-connection-test.js';
import { listWebDavIssues, reviewWebDavUpload } from './webdav-management.js';
import { runWebDavFiles } from './webdav-run-files.js';
import { failureCode, WebDavFailure } from './webdav-errors.js';
import type { BackupDraft, DesktopBridge, DesktopSource, StorageForm, SyncProgress } from './types.js';
import { ElectronCredentialVault } from './vault.js';
import { NodeWebDavClient } from './webdav.js';

export class DesktopSyncRuntime implements DesktopBridge {
  private readonly vault: ElectronCredentialVault;
  private activeSync: Promise<SyncProgress> | undefined;
  private activeProgressId: string | undefined;
  private storageGeneration = 0;
  private stopping = false;
  private activeContext: string | undefined;
  private wakeRetry: (() => void) | undefined;
  private lastFailure = false;
  private activeStorageTest: Promise<void> | undefined;
  private testGeneration: number | undefined;
  private wakeTest: (() => void) | undefined;
  private reviewing = false;

  constructor(
    private readonly journal: DesktopSyncJournal,
    private readonly parentWindow: () => BrowserWindow | null,
  ) {
    this.vault = new ElectronCredentialVault(journal);
  }

  getDraft(): Promise<BackupDraft> { return Promise.resolve(this.journal.getDraft()); }
  getProgress(): Promise<SyncProgress | null> {
    const progress = this.journal.getLatestProgress();
    // Node transfers cannot survive their owning process.
    return Promise.resolve(progress?.status === 'running' && progress.id !== this.activeProgressId
      ? { ...progress, status: 'failed', errorCode: 'interrupted' } : progress);
  }
  getBackgroundState(): { active: boolean; failed: boolean } {
    const progress = this.journal.getLatestProgress();
    const interrupted = progress?.status === 'running' && progress.id !== this.activeProgressId;
    return { active: Boolean(this.activeSync) && progress?.status !== 'waiting_retry', failed: this.lastFailure || interrupted || progress?.status === 'failed' || (progress?.status === 'needs_review' && this.journal.getReviewUploads(true).length > 0) };
  }
  prepareToQuit(): void {
    this.stopping = true;
    this.wakeRetry?.(); this.wakeTest?.();
    const progress = this.journal.getLatestProgress();
    if (this.activeSync && progress?.status === 'running') this.journal.saveProgress({ ...progress, status: 'failed', errorCode: 'interrupted' });
  }
  getSchedule(): Promise<{ intervalHours: 12 | 24; localTime: `${number}${number}:${number}${number}` }> {
    const { intervalHours, localTime } = this.journal.getDraft();
    return Promise.resolve({ intervalHours, localTime: localTime as `${number}${number}:${number}${number}` });
  }


  async pickSources(): Promise<readonly DesktopSource[]> {
    const options = {
      properties: ['openDirectory', 'multiSelections'] as ('openDirectory' | 'multiSelections')[],
      title: 'Select folders to back up',
    };
    const parent = this.parentWindow();
    const result = parent ? await dialog.showOpenDialog(parent, options) : await dialog.showOpenDialog(options);
    if (result.canceled || result.filePaths.length === 0) return this.journal.getDraft().sources;
    const sources = result.filePaths.map((path) => ({ displayName: basename(path), path }));
    this.journal.replaceSources(sources);
    this.wakeRetry?.(); this.wakeTest?.();
    return this.journal.getDraft().sources;
  }

  saveSchedule(intervalHours: 12 | 24, localTime: string): Promise<void> {
    if (intervalHours !== 12 && intervalHours !== 24) return Promise.reject(new Error('Sync interval must be 12 or 24 hours.'));
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(localTime)) return Promise.reject(new Error('Schedule time must use HH:mm.'));
    this.journal.saveSchedule(intervalHours, localTime);
    return Promise.resolve();
  }

  saveStorage(storage: StorageForm): Promise<void> {
    this.validateStorage(storage);
    this.storageGeneration += 1;
    const previous = this.journal.getDraft().storage;
    let secret: string | null = null;
    try { secret = this.vault.load(); } catch { /* Unreadable old credentials cannot validate the new tuple. */ }
    const changed = !previous || previous.endpoint !== storage.endpoint || previous.targetPath !== storage.targetPath ||
      previous.username !== storage.username || secret !== storage.password;
    this.journal.database.transaction(() => {
      this.vault.save(storage.password);
      this.journal.saveStorage({ endpoint: storage.endpoint, targetPath: storage.targetPath, username: storage.username }, changed);
    })();
    this.wakeRetry?.(); this.wakeTest?.();
    return Promise.resolve();
  }

  testStorage(): Promise<void> {
    const generation = this.storageGeneration;
    if (this.activeStorageTest && this.testGeneration === generation) return this.activeStorageTest;
    if (this.activeStorageTest) return this.activeStorageTest.catch(() => undefined).then(() => this.testStorage());
    const check = () => {
      if (this.stopping || generation !== this.storageGeneration) throw new WebDavFailure('settings_changed', 'Storage settings changed during the connection test.');
    };
    this.testGeneration = generation;
    const testing = testConnection(this.journal, this.journal.getWorkRevision(),
      () => new NodeWebDavClient(this.getStorage()).verifyWriteAccess(), check, async deadline => {
        while (Date.now() < deadline) {
          check();
          await new Promise<void>(resolve => {
            const finish = () => { clearTimeout(timer); this.wakeTest = undefined; resolve(); };
            const timer = setTimeout(finish, Math.min(1000, deadline - Date.now())); this.wakeTest = finish;
          });
        }
      });
    this.activeStorageTest = testing;
    const finish = () => { if (this.activeStorageTest === testing) this.activeStorageTest = undefined; };
    void testing.then(finish, finish);
    return testing;
  }

  getWebDavIssues() { return Promise.resolve(listWebDavIssues(this.journal)); }

  async reviewWebDavIssue(id: string, action: 'recheck' | 'keep_both' | 'skip', foreground: () => void): Promise<void> {
    if (this.activeSync || this.reviewing) throw new WebDavFailure('backup_busy');
    this.reviewing = true;
    const context = this.journal.getWorkRevision();
    const check = () => {
      foreground();
      if (this.stopping) throw new WebDavFailure('interrupted');
      if (context !== this.journal.getWorkRevision()) throw new WebDavFailure('settings_changed');
    };
    try {
      check();
      if (action !== 'skip' && !this.journal.getDraft().storageTested) throw new WebDavFailure('configuration_required');
      await reviewWebDavUpload(this.journal, action === 'skip' ? null : new NodeWebDavClient(this.getStorage()), id, action, check);
    } finally { this.reviewing = false; }
  }

  resumeRetries(): void {
    const previous = this.journal.getLatestProgress();
    if (previous?.status === 'waiting_retry' && previous.contextId === this.journal.getWorkRevision()) {
      void this.startSync().catch(() => undefined);
    }
  }

  async startScheduledSync(): Promise<void> {
    const draft = this.journal.getDraft();
    if (!draft.storageTested || !draft.sources.length) throw new WebDavFailure('configuration_required');
    const context = this.journal.getWorkRevision();
    const previous = this.journal.getLatestProgress();
    if (previous?.contextId === context && previous.status === 'failed' &&
      previous.retryScheduleId === JSON.stringify([draft.intervalHours, draft.localTime]) &&
      previous.nextOpportunityAt && Date.now() < previous.nextOpportunityAt) throw new WebDavFailure('retry_exhausted');
    const result = await this.startSync(context);
    if (context !== this.journal.getWorkRevision() || result.contextId !== context) throw new WebDavFailure('settings_changed');
    if (result.status !== 'completed') throw new WebDavFailure('review_required');
  }

  startSync(context = this.journal.getWorkRevision()): Promise<SyncProgress> {
    if (this.reviewing) return Promise.reject(new WebDavFailure('backup_busy'));
    if (this.stopping) return Promise.reject(new WebDavFailure('interrupted', 'Kloda is shutting down; backup remains incomplete.'));
    if (context !== this.journal.getWorkRevision()) return Promise.reject(new WebDavFailure('settings_changed'));
    if (this.activeSync) {
      if (this.activeContext === context) return this.activeSync;
      return this.activeSync.catch(() => undefined).then(() => this.startSync(context));
    }
    this.activeContext = context;
    this.lastFailure = false;
    const sync = this.runSync(context);
    this.activeSync = sync;
    const finish = () => {
      if (this.activeSync === sync) {
        this.activeSync = undefined; this.activeProgressId = undefined; this.activeContext = undefined;
      }
    };
    void sync.then(finish, error => { this.lastFailure = failureCode(error) !== 'settings_changed'; finish(); });
    return sync;
  }

  private async runSync(context: string): Promise<SyncProgress> {
    const draft = this.journal.getDraft();
    const sources = this.journal.getSourcePaths();
    const old = this.journal.getLatestProgress();
    const progress: SyncProgress = old?.contextId === context && (old.status === 'waiting_retry' || old.status === 'running' || old.errorCode === 'interrupted') ? old : {
      id: randomUUID(), status: 'running', bytesTransferred: 0, bytesTotal: 0, completedFiles: 0, totalFiles: 0,
      contextId: context, sourceIds: sources.map(source => source.id),
      targetId: draft.storage ? JSON.stringify([draft.storage.endpoint, draft.storage.targetPath, draft.storage.username]) : undefined,
      startedAt: new Date().toISOString(), attempts: 0,
    };
    this.activeProgressId = progress.id;
    this.journal.saveProgress(progress);
    for (;;) {
      try {
        this.checkRunning();
        if (progress.retryAt) await this.waitForRetry(progress.retryAt);
        this.checkRunning();
        if (!Number.isInteger(progress.attempts ?? 0) || (progress.attempts ?? 0) < 0 || (progress.attempts ?? 0) > 5) throw new WebDavFailure('unknown');
        if ((progress.attempts ?? 0) >= 5) throw new WebDavFailure('retry_exhausted');
        progress.attempts = (progress.attempts ?? 0) + 1;
        progress.status = 'running'; delete progress.retryAt; delete progress.errorCode;
        this.journal.saveProgress(progress);
        if (!draft.storageTested || !sources.length) throw new WebDavFailure('configuration_required');
        const client = new NodeWebDavClient(this.getStorage());
        await runWebDavFiles(this.journal, client, sources, progress, () => this.checkRunning());
        this.checkRunning();
        return progress;
      } catch (error) {
        const code = failureCode(error);
        // Quit during a retry wait preserves its deadline/budget for the next process.
        if (this.stopping && progress.status === 'waiting_retry') throw error;
        if (code === 'connection_unavailable') {
          const next = nextAccessRetry(new Date(), progress.attempts ?? 1);
          if (!next.exhausted) {
            progress.status = 'waiting_retry'; progress.errorCode = code; progress.retryAt = next.retryAt!.getTime();
            this.journal.saveProgress(progress); continue;
          }
        }
        progress.status = code === 'settings_changed' ? 'stopped' : 'failed';
        progress.errorCode = code === 'connection_unavailable' ? 'retry_exhausted' : code;
        delete progress.retryAt;
        const schedule = { intervalHours: draft.intervalHours, localTime: draft.localTime as `${number}${number}:${number}${number}` };
        progress.retryScheduleId = JSON.stringify([draft.intervalHours, draft.localTime]);
        progress.nextOpportunityAt = getNextScheduleOccurrence(schedule, new Date()).getTime();
        this.journal.saveProgress(progress);
        throw error;
      }
    }
  }

  private async waitForRetry(deadline: number): Promise<void> {
    while (Date.now() < deadline) {
      this.checkRunning();
      await new Promise<void>(resolve => {
        const finish = () => { clearTimeout(timer); this.wakeRetry = undefined; resolve(); };
        const timer = setTimeout(finish, Math.min(1000, deadline - Date.now()));
        this.wakeRetry = finish;
      });
    }
  }

  private getStorage(): StorageForm {
    const draft = this.journal.getDraft();
    const password = this.vault.load();
    if (!draft.storage || !password) throw new WebDavFailure('configuration_required');
    return { ...draft.storage, password };
  }

  private checkRunning(): void {
    if (this.stopping) throw new WebDavFailure('interrupted', 'Kloda is shutting down; backup remains incomplete.');
    if (this.activeContext !== this.journal.getWorkRevision()) throw new WebDavFailure('settings_changed');
  }

  private validateStorage(storage: StorageForm): void {
    if (!storage.username || !storage.password || !storage.targetPath) throw new Error('Storage fields are required.');
    const endpoint = new URL(storage.endpoint);
    if (endpoint.username || endpoint.password || endpoint.protocol !== 'https:') throw new Error('Use an HTTPS endpoint without embedded credentials.');
  }
}
