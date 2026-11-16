import type { FileJob, FileJobState, FileQueue } from '../../../shared/api/file-transfer';

export type ActivityTab = 'now' | 'past';
export type ActivityFilter = 'all' | 'done' | 'issues';

// Retained problem states are both pending work (Now) and the journal's latest result (Past).
// They are not separate events or failed sessions; only native `completed` is a success.
const issueStates: ReadonlySet<FileJobState> = new Set(['paused', 'blocked', 'owner_deleted']);

export function isActivityIssue(job: FileJob): boolean {
  return issueStates.has(job.state);
}

// Read-only projections over one verified queue snapshot: native order, IDs and ACK values are kept as-is.
export function activityNowJobs(queue: FileQueue): FileJob[] {
  return queue.jobs.filter((job) => job.state !== 'completed');
}

export function activityPastJobs(queue: FileQueue, filter: ActivityFilter): FileJob[] {
  return queue.jobs.filter((job) => {
    const done = job.state === 'completed';
    if (filter === 'done') return done;
    if (filter === 'issues') return isActivityIssue(job);
    return done || isActivityIssue(job);
  });
}
