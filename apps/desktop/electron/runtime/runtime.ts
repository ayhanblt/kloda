import { randomUUID } from 'node:crypto';
import { readdir } from 'node:fs/promises';
import { basename, relative, sep } from 'node:path';
import { dialog, type BrowserWindow } from 'electron';

import { DesktopSyncJournal, type PendingUpload } from './journal.js';
import { openSourceSnapshot } from './source-snapshot.js';
import type { BackupDraft, DesktopBridge, DesktopSource, StorageForm, SyncProgress } from './types.js';
import { ElectronCredentialVault } from './vault.js';
import { NodeWebDavClient } from './webdav.js';

export class DesktopSyncRuntime implements DesktopBridge {
  private readonly vault: ElectronCredentialVault;
  private activeSync: Promise<SyncProgress> | undefined;
  private activeProgressId: string | undefined;
  private storageGeneration = 0;

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
      ? { ...progress, status: 'failed' } : progress);
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
    this.vault.save(storage.password);
    this.journal.saveStorage({ endpoint: storage.endpoint, targetPath: storage.targetPath, username: storage.username });
    return Promise.resolve();
  }

  async testStorage(): Promise<void> {
    const generation = this.storageGeneration;
    const storage = this.getStorage();
    await new NodeWebDavClient(storage).verifyWriteAccess();
    if (generation !== this.storageGeneration) throw new Error('Storage settings changed during the connection test.');
    this.journal.setStorageTested();
  }

  startSync(): Promise<SyncProgress> {
    if (this.activeSync) return this.activeSync;
    const sync = this.runSync();
    this.activeSync = sync;
    const finish = () => {
      if (this.activeSync === sync) {
        this.activeSync = undefined;
        this.activeProgressId = undefined;
      }
    };
    void sync.then(finish, () => {
      try {
        const progress = this.activeProgressId ? this.journal.getLatestProgress() : null;
        if (progress?.id === this.activeProgressId && progress?.status === 'running') {
          this.journal.saveProgress({ ...progress, status: 'failed' });
        }
      } catch {
        console.error('Kloda backup failure progress could not be persisted.');
      } finally { finish(); }
    });
    return sync;
  }

  private async runSync(): Promise<SyncProgress> {
    const storage = this.getStorage();
    const draft = this.journal.getDraft();
    if (!draft.storageTested) throw new Error('Test WebDAV access before starting backup.');
    const sources = this.journal.getSourcePaths();
    if (sources.length === 0) throw new Error('Select at least one source folder.');
    if (this.journal.hasUnscopedPendingUploads()) throw new Error('Cannot resume unscoped pending uploads without verified target reconciliation.');
    const targetId = JSON.stringify([storage.endpoint, storage.targetPath, storage.username]);
    const client = new NodeWebDavClient(storage);
    await this.reconcilePendingUploads(client, targetId);
    const sourceFiles = await Promise.all(sources.map(async (source) => ({ source, files: await this.listFiles(source.path) })));
    const files = sourceFiles
      .flatMap(({ source, files }) => files.map((file) => ({
        file,
        relativePath: relative(source.path, file).split(sep).join('/'),
        source,
      })));
    const progress: SyncProgress = { bytesTransferred: 0, bytesTotal: 0, completedFiles: 0, id: randomUUID(), status: 'running', totalFiles: 0 };
    this.activeProgressId = progress.id;
    this.journal.saveProgress(progress);
    for (const { file, relativePath, source } of files) {
      const snapshot = await openSourceSnapshot(file);
      try {
        const { body, revision } = snapshot;
        const remotePath = `${source.id}/${relativePath}`;
        if (this.journal.hasUploadReceipt(targetId, source.id, relativePath, revision) &&
          await client.inspectFile(remotePath, revision) === 'match') continue;
        progress.bytesTotal += body.size;
        progress.totalFiles += 1;
        this.journal.saveProgress(progress);
        const temporaryPath = `${remotePath}.kloda-upload-${randomUUID()}`;
        const pending: PendingUpload = { targetId, sourceId: source.id, relativePath, revision, temporaryPath, phase: 'prepared' };
        this.journal.savePendingUpload(targetId, source.id, relativePath, revision, temporaryPath);
        await client.uploadTemporary(temporaryPath, body);
        this.journal.advancePendingUpload(targetId, pending, 'uploaded');
        await this.finalizePendingUpload(client, targetId, pending);
        progress.bytesTransferred += body.size;
        progress.completedFiles += 1;
        this.journal.saveProgress(progress);
      } finally {
        await snapshot.dispose();
      }
    }
    progress.status = 'completed';
    this.journal.saveProgress(progress);
    return progress;
  }

  private async reconcilePendingUploads(client: NodeWebDavClient, targetId: string): Promise<void> {
    const uploads = this.journal.getPendingUploads(targetId);
    for (const pending of uploads) {
      if (pending.phase !== 'prepared' && pending.phase !== 'uploaded' && pending.phase !== 'moving' &&
        pending.phase !== 'moved' && pending.phase !== 'conflict') {
        throw new Error('Cannot reconcile a pending upload without a known operation phase.');
      }
    }
    for (const pending of uploads) {
      if (pending.phase === 'prepared') {
        if (await client.inspectFile(pending.temporaryPath, pending.revision) !== 'missing') {
          throw new Error('Unacknowledged temporary file cannot be adopted or deleted.');
        }
        this.journal.clearPendingUpload(targetId, pending);
      } else {
        await this.finalizePendingUpload(client, targetId, pending);
      }
    }
  }

  private async finalizePendingUpload(client: NodeWebDavClient, targetId: string, pending: PendingUpload): Promise<void> {
    const remotePath = `${pending.sourceId}/${pending.relativePath}`;
    if (pending.phase !== 'moved') {
      if (await client.inspectFile(pending.temporaryPath, pending.revision) !== 'match') {
        throw new Error('Owned temporary bytes are unavailable or changed; the final cannot be adopted.');
      }
      if (await client.inspectFile(remotePath, pending.revision) !== 'missing') {
        if (pending.phase !== 'conflict') this.journal.advancePendingUpload(targetId, pending, 'conflict');
        throw new Error('Existing final cannot be adopted or overwritten.');
      }
      this.journal.advancePendingUpload(targetId, pending, 'moving');
      if (await client.finalizeUpload(remotePath, pending.temporaryPath) === 'conflict') {
        this.journal.advancePendingUpload(targetId, pending, 'conflict');
        throw new Error('WebDAV finalization conflicted without overwrite.');
      }
      this.journal.advancePendingUpload(targetId, pending, 'moved');
    }
    if (await client.inspectFile(remotePath, pending.revision) !== 'match') {
      throw new Error('Acknowledged final byte verification failed.');
    }
    this.journal.completePendingUpload(targetId, pending);
  }

  private getStorage(): StorageForm {
    const draft = this.journal.getDraft();
    const password = this.vault.load();
    if (!draft.storage || !password) throw new Error('Storage credentials are unavailable.');
    return { ...draft.storage, password };
  }

  private async listFiles(rootPath: string): Promise<string[]> {
    const files: string[] = [];
    for (const entry of await readdir(rootPath, { withFileTypes: true })) {
      const path = `${rootPath}/${entry.name}`;
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) files.push(...await this.listFiles(path));
      if (entry.isFile()) files.push(path);
    }
    return files;
  }

  private validateStorage(storage: StorageForm): void {
    if (!storage.username || !storage.password || !storage.targetPath) throw new Error('Storage fields are required.');
    const endpoint = new URL(storage.endpoint);
    if (endpoint.username || endpoint.password || endpoint.protocol !== 'https:') throw new Error('Use an HTTPS endpoint without embedded credentials.');
  }
}
