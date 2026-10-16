import { describe, expect, it } from 'vitest';

import { mayStartSourceJob, updateScheduledRun } from './run-state.js';

describe('scheduled run state', () => {
  it('does not duplicate an active transfer and does not mark it updated', () => {
    const run = {
      accessAttempts: 1,
      id: 'run-1',
      jobIds: ['job-1'],
      osAttempts: 1,
      updated: 0 as const,
    };

    expect(mayStartSourceJob('running')).toBe(false);
    expect(updateScheduledRun(run, ['running'])).toMatchObject({ updated: 0 });
  });

  it('marks a run updated only after every job completed', () => {
    const run = {
      accessAttempts: 1,
      id: 'run-1',
      jobIds: ['job-1', 'job-2'],
      osAttempts: 1,
      updated: 0 as const,
    };

    expect(updateScheduledRun(run, ['completed', 'completed'])).toMatchObject({ updated: 1 });
    for (const statuses of [[], ['completed'], ['completed', 'completed', 'completed']] as const) {
      expect(updateScheduledRun(run, statuses)).toMatchObject({ updated: 0 });
    }
  });
});
