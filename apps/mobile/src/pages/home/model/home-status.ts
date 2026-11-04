import type { FileQueue } from '../../../shared/api/file-transfer';
import type { WebDavBackupStatus } from '../../../shared/api/backup-destinations';

import type { HomeState, DestinationKind } from '../../../shared/model/home-status';
export type { HomeState, DestinationKind } from '../../../shared/model/home-status';
export interface StatusProgress { kind: 'bytes' | 'operations'; completed: string; total: string; percent: number }
export interface HomeObservation {
  sourceCount: number; pcSelected: boolean | null; queue: FileQueue | null;
  webdav: WebDavBackupStatus | null; pcError?: string | null; webdavError?: string | null; others?: OtherTarget[];
}
function progress(completed: bigint, total: bigint, kind: StatusProgress['kind']): StatusProgress | undefined {
  if (total <= 0n || completed < 0n || completed > total) return;
  return { kind, completed: completed.toString(), total: total.toString(), percent: Number(completed * 10000n / total) / 100 };
}
// A destination outside the PC queue and the original WebDAV profile: added cloud targets (18A/3), SMB, SFTP, FTPS, S3.
// Each keeps its own run; the home summary only reads it.
export interface OtherTarget {
  id: string; label: string; kind: DestinationKind; enabled: boolean;
  running?: boolean; run?: { state: string; errorCode?: string }; errorCode?: string; automaticError?: string;
}
export function otherTargetState(target: OtherTarget): HomeState {
  const state = target.run?.state;
  if (state === 'needs_attention') return 'attention';
  if (state === 'exhausted' || target.errorCode || target.automaticError) return 'error';
  if (target.running || state === 'running') return 'syncing';
  // "safe" needs a finished run of this destination; no run yet, waiting or paused stays "waiting".
  return state === 'finished' && !target.run?.errorCode ? 'safe' : 'waiting';
}
const rank: HomeState[] = ['attention', 'error', 'syncing', 'waiting', 'safe'];

export function homeStatus(value: HomeObservation): { state: HomeState; progress?: StatusProgress } {
  const base = baseStatus(value);
  const others = (value.others ?? []).filter(target => target.enabled).map(otherTargetState);
  if (!others.length || value.sourceCount === 0) return base;
  // Without the PC or WebDAV enabled their "setup" says nothing about the other destinations.
  const states = base.state === 'setup' ? others : [base.state, ...others];
  const state = rank.find(item => states.includes(item)) ?? 'waiting';
  return state === base.state ? base : { state };
}
function baseStatus(value: HomeObservation): { state: HomeState; progress?: StatusProgress } {
  const pc = value.pcSelected === true, dav = value.webdav?.enabled === true;
  const queue = pc ? value.queue : null, webdav = dav ? value.webdav : null;
  const errors = [pc && value.pcError, dav && value.webdavError, queue?.errorCode, queue?.automaticError, webdav?.errorCode, webdav?.automaticError].filter(Boolean);
  if (queue?.run?.state === 'needs_attention' || webdav?.run?.state === 'needs_attention' || queue?.jobs.some(j => ['blocked', 'owner_deleted'].includes(j.state))) return { state: 'attention' };
  if (errors.length || queue?.run?.state === 'failed' || webdav?.run?.state === 'exhausted') return { state: 'error' };
  if (queue?.running || webdav?.running) {
    if (webdav?.running && webdav.run) return { state: 'syncing', progress: progress(BigInt(webdav.run.counts.completedOperations), BigInt(webdav.run.counts.operations), 'operations') };
    const jobs = queue?.jobs ?? [];
    const known = !queue?.hasMore && jobs.length > 0 && jobs.every(j => j.totalBytes !== undefined);
    return { state: 'syncing', progress: known ? progress(jobs.reduce((n, j) => n + BigInt(j.acknowledgedBytes), 0n), jobs.reduce((n, j) => n + BigInt(j.totalBytes!), 0n), 'bytes') : undefined };
  }
  if (value.sourceCount === 0) return { state: 'setup' };
  if (!pc && !dav) return { state: value.pcSelected === null || value.webdav === null ? 'waiting' : 'setup' };
  if (value.queue?.automaticPaused || queue?.run?.state === 'paused' || queue?.automaticRun?.state === 'paused' || webdav?.run?.state === 'paused') return { state: 'waiting' };
  if (value.pcSelected === null || value.webdav === null) return { state: 'waiting' };
  const pcDone = !pc || (!!queue && queue.run?.state === 'finished' && !queue.hasMore && queue.jobs.length > 0 && queue.jobs.every(j => j.state === 'completed'));
  const davDone = !dav || (webdav?.run?.state === 'finished' && BigInt(webdav.run.counts.operations) > 0n && webdav.run.counts.completedOperations === webdav.run.counts.operations);
  // "safe" describes only native-confirmed observed runs, never whole-library coverage.
  return { state: pcDone && davDone ? 'safe' : 'waiting' };
}
