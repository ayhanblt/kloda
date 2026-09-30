import { randomUUID } from 'node:crypto';
import { openAsBlob } from 'node:fs';
import { readdir, stat } from 'node:fs/promises';
import { basename, relative } from 'node:path';
import { dialog, type BrowserWindow } from 'electron';

import { DesktopSyncJournal } from './journal.js';
import type { BackupDraft, DesktopBridge, DesktopSource, StorageForm, SyncProgress } from './types.js';
import { ElectronCredentialVault } from './vault.js';
import { NodeWebDavClient } from './webdav.js';

export class DesktopSyncRuntime implements DesktopBridge {
  private readonly vault: ElectronCredentialVault;

  constructor(
    private readonly journal: DesktopSyncJournal,
    private readonly parentWindow: () => BrowserWindow | null,
  ) {
    this.vault = new ElectronCredentialVault(journal);
  }

  getDraft(): Promise<BackupDraft> { return Promise.resolve(this.journal.getDraft()); }
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
    const sources = result.filePaths.map((path) => ({ displayName: basename(path), id: randomUUID(), path }));
    this.journal.replaceSources(sources);
    return sources.map(({ id, displayName }) => ({ id, displayName }));
  }

  saveSchedule(intervalHours: 12 | 24, localTime: string): Promise<void> {
    if (intervalHours !== 12 && intervalHours !== 24) return Promise.reject(new Error('Sync interval must be 12 or 24 hours.'));
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(localTime)) return Promise.reject(new Error('Schedule time must use HH:mm.'));
    this.journal.saveSchedule(intervalHours, localTime);
    return Promise.resolve();
  }

  saveStorage(storage: StorageForm): Promise<void> {
    this.validateStorage(storage);
    this.vault.save(storage.password);
    this.journal.saveStorage({ endpoint: storage.endpoint, targetPath: storage.targetPath, username: storage.username });
    return Promise.resolve();
  }

  async testStorage(): Promise<void> {
    const storage = this.getStorage();
    await new NodeWebDavClient(storage).verifyWriteAccess();
    this.journal.setStorageTested();
  }

  async startSync(): Promise<SyncProgress> {
    const storage = this.getStorage();
    const draft = this.journal.getDraft();
    if (!draft.storageTested) throw new Error('Test WebDAV access before starting backup.');
    const source = this.journal.getSourcePaths()[0];
    if (!source) throw new Error('Select at least one source folder.');
    const files = await this.listFiles(source.path);
    const progress: SyncProgress = { bytesTransferred: 0, bytesTotal: files.reduce((total, file) => total + file.size, 0), completedFiles: 0, id: randomUUID(), status: 'running', totalFiles: files.length };
    this.journal.saveProgress(progress);
    const client = new NodeWebDavClient(storage);
    for (const file of files) {
      await client.uploadFile(`${encodeURIComponent(source.id)}/${relative(source.path, file.path)}`, await openAsBlob(file.path));
      progress.bytesTransferred += file.size;
      progress.completedFiles += 1;
      this.journal.saveProgress(progress);
    }
    progress.status = 'completed';
    this.journal.saveProgress(progress);
    return progress;
  }

  private getStorage(): StorageForm {
    const draft = this.journal.getDraft();
    const password = this.vault.load();
    if (!draft.storage || !password) throw new Error('Storage credentials are unavailable.');
    return { ...draft.storage, password };
  }

  private async listFiles(rootPath: string): Promise<{ path: string; size: number }[]> {
    const files: { path: string; size: number }[] = [];
    for (const entry of await readdir(rootPath, { withFileTypes: true })) {
      const path = `${rootPath}/${entry.name}`;
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) files.push(...await this.listFiles(path));
      if (entry.isFile()) files.push({ path, size: (await stat(path)).size });
    }
    return files;
  }

  private validateStorage(storage: StorageForm): void {
    if (!storage.username || !storage.password || !storage.targetPath) throw new Error('Storage fields are required.');
    const endpoint = new URL(storage.endpoint);
    if (endpoint.username || endpoint.password || endpoint.protocol !== 'https:') throw new Error('Use an HTTPS endpoint without embedded credentials.');
  }
}
