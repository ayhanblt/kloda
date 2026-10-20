import { createHash } from 'node:crypto';
import type { DesktopSyncJournal, PendingUpload } from './journal.js';
import type { NodeWebDavClient } from './webdav.js';
import { failureCode, WebDavFailure } from './webdav-errors.js';

export function pendingId(pending: PendingUpload): string {
  return createHash('sha256').update(JSON.stringify([pending.targetId, pending.sourceId, pending.relativePath, pending.revision, pending.temporaryPath])).digest('base64url');
}
export async function finalizePendingUpload(journal: DesktopSyncJournal, client: NodeWebDavClient, pending: PendingUpload, check: () => void): Promise<void> {
  check();
  const targetId = pending.targetId;
  const remotePath = pending.publishedPath ?? `${pending.sourceId}/${pending.relativePath}`;
  if (pending.phase !== 'moved') {
    if (!['uploaded', 'moving', 'conflict'].includes(pending.phase)) throw new WebDavFailure('review_required');
    const temporary = await client.inspectFile(pending.temporaryPath, pending.revision);
    check();
    if (temporary !== 'match') throw new WebDavFailure('review_required');
    const final = await client.inspectFile(remotePath, pending.revision);
    check();
    if (final !== 'missing') {
      if (pending.phase !== 'conflict') journal.advancePendingUpload(targetId, pending, 'conflict');
      throw new WebDavFailure('review_required');
    }
    journal.advancePendingUpload(targetId, pending, 'moving');
    if (await client.finalizeUpload(remotePath, pending.temporaryPath) === 'conflict') {
      journal.advancePendingUpload(targetId, pending, 'conflict');
      throw new WebDavFailure('review_required');
    }
    // Persist a received publication ACK before checking for a changed context.
    journal.advancePendingUpload(targetId, pending, 'moved');
    check();
  }
  if (await client.inspectFile(remotePath, pending.revision) !== 'match') throw new WebDavFailure('review_required');
  check();
  journal.completePendingUpload(targetId, pending);
}
export async function reconcilePendingUploads(journal: DesktopSyncJournal, client: NodeWebDavClient, targetId: string, sourceIds: readonly string[], check: () => void): Promise<void> {
  for (const pending of journal.getPendingUploads(targetId)) {
    check();
    if (!sourceIds.includes(pending.sourceId)) {
      journal.setPendingIssue(targetId, pending, 'settings_changed');
      continue;
    }
    if (pending.skipped || pending.issueCode) continue;
    try {
      if (pending.phase === 'prepared') {
        const state = await client.inspectFile(pending.temporaryPath, pending.revision);
        check();
        if (state !== 'missing') throw new WebDavFailure('review_required');
        journal.clearPendingUpload(targetId, pending);
      } else await finalizePendingUpload(journal, client, pending, check);
    } catch (error) {
      const code = failureCode(error);
      if (['connection_unavailable', 'settings_changed', 'interrupted'].includes(code)) throw error;
      journal.setPendingIssue(targetId, pending, code);
    }
  }
}
