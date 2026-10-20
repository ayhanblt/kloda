import { hostname } from 'node:os';
import { posix } from 'node:path';

import type { DesktopSyncJournal, PendingUpload } from './journal.js';
import type { NodeWebDavClient } from './webdav.js';
import { failureCode, WebDavFailure } from './webdav-errors.js';
import { finalizePendingUpload, pendingId } from './webdav-pending.js';

export interface WebDavIssue {
  id: string;
  targetId: string;
  sourceId: string;
  relativePath: string;
  revision: string;
  phase: PendingUpload['phase'];
  errorCode: string;
  skipped: boolean;
  canKeepBoth: boolean;
  publishedPath?: string;
}

function currentScope(journal: DesktopSyncJournal, pending: PendingUpload): boolean {
  const storage = journal.getDraft().storage;
  return Boolean(storage && pending.targetId === JSON.stringify([storage.endpoint, storage.targetPath, storage.username]) &&
    journal.getSourcePaths().some(source => source.id === pending.sourceId));
}

export function listWebDavIssues(journal: DesktopSyncJournal): WebDavIssue[] {
  return journal.getReviewUploads(true).map(pending => ({
    id: pendingId(pending), targetId: pending.targetId, sourceId: pending.sourceId,
    relativePath: pending.relativePath, revision: pending.revision, phase: pending.phase,
    errorCode: pending.issueCode ?? (pending.targetId && !currentScope(journal, pending) ? 'settings_changed' : 'review_required'), skipped: pending.skipped ?? false,
    canKeepBoth: pending.phase === 'conflict' && currentScope(journal, pending),
    ...(pending.publishedPath ? { publishedPath: pending.publishedPath } : {}),
  }));
}

export async function reviewWebDavUpload(journal: DesktopSyncJournal, client: NodeWebDavClient | null,
  id: string, action: 'recheck' | 'keep_both' | 'skip', check: () => void): Promise<void> {
  check();
  if (!/^[A-Za-z0-9_-]{43}$/.test(id) || !['recheck', 'keep_both', 'skip'].includes(action)) {
    throw new WebDavFailure('configuration_required');
  }
  const pending = journal.getReviewUploads(true).find(row => pendingId(row) === id);
  if (!pending) throw new WebDavFailure('review_required');
  try {
    if (action === 'skip') {
      journal.setPendingIssue(pending.targetId, pending, pending.issueCode ?? 'review_required', true);
      return;
    }
    if (!client || !currentScope(journal, pending)) throw new WebDavFailure('configuration_required');
    if (action === 'keep_both') await chooseCopyPath(journal, client, pending, check);
    check();
    journal.setPendingIssue(pending.targetId, pending, undefined);
    if (pending.phase === 'prepared') {
      const state = await client.inspectFile(pending.temporaryPath, pending.revision);
      check();
      if (state !== 'missing') throw new WebDavFailure('review_required');
      journal.clearPendingUpload(pending.targetId, pending);
    } else await finalizePendingUpload(journal, client, pending, check);
  } catch (error) {
    journal.setPendingIssue(pending.targetId, pending, failureCode(error));
    throw error;
  }
}

async function chooseCopyPath(journal: DesktopSyncJournal, client: NodeWebDavClient,
  pending: PendingUpload, check: () => void): Promise<void> {
  if (pending.phase !== 'conflict') throw new WebDavFailure('review_required');
  check();
  const temporary = await client.inspectFile(pending.temporaryPath, pending.revision);
  check();
  if (temporary !== 'match') throw new WebDavFailure('review_required');
  const original = `${pending.sourceId}/${pending.relativePath}`;
  const occupied = await client.inspectFile(original, pending.revision);
  check();
  if (occupied === 'missing') throw new WebDavFailure('review_required');
  let path: string;
  if (pending.publishedPath) {
    const previous = await client.inspectFile(pending.publishedPath, pending.revision);
    check();
    // A prior selection survives restart; only a known occupied alias permits another explicit choice.
    path = previous === 'missing' ? pending.publishedPath : nextCopyPath(pending.publishedPath);
  } else path = copyPath(pending);
  check();
  journal.setPendingPublication(pending.targetId, pending, path);
}

function truncateUtf8(value: string, limit: number): string {
  let result = '';
  for (const character of value) {
    if (Buffer.byteLength(result + character) > limit) break;
    result += character;
  }
  return result;
}

function copyPath(pending: PendingUpload): string {
  if (!/^sha256:[a-f0-9]{64}$/.test(pending.revision)) throw new WebDavFailure('configuration_required');
  const original = `${pending.sourceId}/${pending.relativePath}`;
  const directory = posix.dirname(original);
  const name = posix.basename(original).replace(/[<>:"/\\|?*]|\p{Cc}/gu, '_');
  const extension = posix.extname(name);
  const stem = name.slice(0, name.length - extension.length);
  const pc = truncateUtf8(hostname().normalize('NFC').replace(/[^\p{L}\p{N}_-]/gu, '_'), 48);
  const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15).replace('T', '-');
  const suffix = ` (Kloda ${pc} ${stamp} ${pending.revision.slice(7, 15)})`;
  const shortened = truncateUtf8(stem, 251 - Buffer.byteLength(suffix + extension));
  if (!pc || !shortened) throw new WebDavFailure('configuration_required');
  return `${directory}/${shortened}${suffix}${extension}`;
}

function nextCopyPath(path: string): string {
  const extension = posix.extname(path);
  const stem = path.slice(0, path.length - extension.length);
  const numbered = /^(.*\)) (\d+)$/.exec(stem);
  const next = numbered ? Number(numbered[2]) + 1 : 2;
  if (next > 100) throw new WebDavFailure('review_required');
  const base = numbered ? numbered[1] : stem;
  const candidate = `${base} ${next}${extension}`;
  if (Buffer.byteLength(posix.basename(candidate)) > 255) throw new WebDavFailure('configuration_required');
  return candidate;
}
