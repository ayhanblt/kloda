import type { JobStatus, ScheduledRunSnapshot } from './contracts.js';

const activeStatuses: readonly JobStatus[] = ['queued', 'running', 'waiting-access', 'waiting-os'];

export function mayStartSourceJob(status: JobStatus | null): boolean {
  return status === null || !activeStatuses.includes(status);
}

export function updateScheduledRun(
  run: ScheduledRunSnapshot,
  jobStatuses: readonly JobStatus[],
): ScheduledRunSnapshot {
  if (jobStatuses.length === 0 || jobStatuses.length !== run.jobIds.length ||
    !jobStatuses.every((status) => status === 'completed')) {
    return { ...run, updated: 0 };
  }

  return { ...run, updated: 1 };
}
