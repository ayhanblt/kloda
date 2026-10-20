import { randomUUID } from 'node:crypto';
import { readdir } from 'node:fs/promises';
import { relative, sep } from 'node:path';
import type { DesktopSyncJournal } from './journal.js';
import type { SyncProgress } from './types.js';
import type { NodeWebDavClient } from './webdav.js';
import { openSourceSnapshot } from './source-snapshot.js';
import { finalizePendingUpload, reconcilePendingUploads } from './webdav-pending.js';
import { failureCode } from './webdav-errors.js';

export async function runWebDavFiles(journal: DesktopSyncJournal, client: NodeWebDavClient,
  sources: ReturnType<DesktopSyncJournal['getSourcePaths']>, progress: SyncProgress, check: () => void): Promise<void> {
  const targetId = progress.targetId!;
  await reconcilePendingUploads(journal, client, targetId, sources.map(source => source.id), check);
  const groups = await Promise.all(sources.map(async source => ({ source, files: await listFiles(source.path, check) })));
  check();
  Object.assign(progress, { bytesTransferred: 0, bytesTotal: 0, completedFiles: 0, totalFiles: 0 });
  for (const { source, files } of groups) for (const file of files) {
    check();
    const relativePath = relative(source.path, file).split(sep).join('/');
    // An unresolved path is dependent work, even if its source bytes changed meanwhile.
    if ([...journal.getPendingUploads(targetId), ...journal.getPendingUploads('')].some(pending =>
      pending.sourceId === source.id && pending.relativePath === relativePath)) continue;
    const snapshot = await openSourceSnapshot(file);
    try {
      check();
      const { body, revision } = snapshot;
      progress.bytesTotal += body.size; progress.totalFiles += 1;
      journal.saveProgress(progress);
      const remotePath = `${source.id}/${relativePath}`;
      const receiptPath = journal.getUploadReceiptPath(targetId, source.id, relativePath, revision);
      if (receiptPath && await client.inspectFile(receiptPath, revision) === 'match') {
        check(); progress.completedFiles += 1; progress.bytesTransferred += body.size;
        journal.saveProgress(progress); continue;
      }
      check();
      const temporaryPath = `${remotePath}.kloda-upload-${randomUUID()}`;
      journal.savePendingUpload(targetId, source.id, relativePath, revision, temporaryPath);
      const pending = journal.getPendingUploads(targetId).find(item => item.temporaryPath === temporaryPath)!;
      try {
        await client.uploadTemporary(temporaryPath, body);
        journal.advancePendingUpload(targetId, pending, 'uploaded');
        check();
        await finalizePendingUpload(journal, client, pending, check);
        check(); progress.bytesTransferred += body.size; progress.completedFiles += 1;
      } catch (error) {
        const code = failureCode(error);
        if (['connection_unavailable', 'settings_changed', 'interrupted'].includes(code)) throw error;
        journal.setPendingIssue(targetId, pending, code);
      }
      journal.saveProgress(progress);
    } finally { await snapshot.dispose(); }
  }
  check();
  progress.reviewCount = journal.getReviewUploads(true).length;
  progress.status = progress.reviewCount ? 'needs_review' : 'completed';
  journal.saveProgress(progress);
}
async function listFiles(rootPath: string, check: () => void): Promise<string[]> {
  check();
  const files: string[] = [];
  for (const entry of await readdir(rootPath, { withFileTypes: true })) {
    check();
    const path = `${rootPath}/${entry.name}`;
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) files.push(...await listFiles(path, check));
    if (entry.isFile()) files.push(path);
  }
  return files;
}
