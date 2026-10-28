import { Platform } from 'react-native';
import { fileTransfer, completedBackupsFromNative, fileQueueFromNative, photosImportStatusFromNative, restoredBackupFromNative } from './file-transfer';

const job = {
  id: 'durable-job-1', sourceId: 'selected-source', name: 'original.bin', recordId: 'AAAAAAAAAAAAAAAAAAAAAA',
  state: 'uploading', acknowledgedBytes: '65536', totalBytes: '100000',
};
const queue = { running: true, jobs: [job], totalJobs: '1', hasMore: false };

describe('native durable queue evidence', () => {
  it('rejects completion without full durable acknowledged bytes, and offsets beyond the immutable size', () => {
    expect(() => fileQueueFromNative({ ...queue, jobs: [{ ...job, state: 'completed' }] })).toThrow('outcome_unknown');
    expect(() => fileQueueFromNative({ ...queue, jobs: [{ ...job, acknowledgedBytes: '100001' }] })).toThrow('outcome_unknown');
    expect(() => fileQueueFromNative({ ...queue, jobs: [{ ...job, state: 'completed', totalBytes: undefined }] })).toThrow('outcome_unknown');
  });
  it('rejects noncanonical counters and contradictory durable queue pagination', () => {
    expect(() => fileQueueFromNative({ ...queue, jobs: [{ ...job, acknowledgedBytes: '065536' }] })).toThrow('outcome_unknown');
    expect(() => fileQueueFromNative({ ...queue, totalJobs: '0' })).toThrow('outcome_unknown');
    expect(() => fileQueueFromNative({ ...queue, totalJobs: '2', hasMore: false })).toThrow('outcome_unknown');
  });
});

describe('own completed backup and exact restore evidence', () => {
  const backup = { id: 'AAAAAAAAAAAAAAAAAAAAAA', name: 'original.jpg', sha256: 'A'.repeat(43), size: '4' };
  it('accepts only ordered bounded own completed pages with canonical hash and size metadata', () => {
    expect(completedBackupsFromNative({ items: [backup], hasMore: false }).items).toEqual([backup]);
    expect(() => completedBackupsFromNative({ items: [backup, backup], hasMore: false })).toThrow('outcome_unknown');
    expect(() => completedBackupsFromNative({ items: [backup], hasMore: true })).toThrow('outcome_unknown');
    expect(() => completedBackupsFromNative({ items: [backup], hasMore: false }, backup.id)).toThrow('outcome_unknown');
    for (const changed of [{ size: '04' }, { size: '9223372036854775808' }, { name: '../original.jpg' }, { sha256: `${backup.sha256}=` }]) {
      expect(() => completedBackupsFromNative({ items: [{ ...backup, ...changed }], hasMore: false })).toThrow('outcome_unknown');
    }
  });
  it('never treats cancellation, partial bytes, a different hash or a different selected backup as restore success', () => {
    expect(restoredBackupFromNative({ ...backup, state: 'completed' }, backup)).toEqual(backup);
    for (const changed of [{ state: 'cancelled' }, { state: 'restoring' }, { size: '3' },
      { sha256: 'B'.repeat(42) + 'A' }, { id: 'AAAAAAAAAAAAAAAAAAAAAQ' }, { name: 'other.jpg' }]) {
      expect(() => restoredBackupFromNative({ ...backup, state: 'completed', ...changed }, backup)).toThrow('outcome_unknown');
    }
  });
});

it('rejects partial or review-blocked Photos imports advertised as complete', () => {
  const review = { state: 'review_required', total: '2', completed: '1', review: '1' };
  expect(photosImportStatusFromNative(review).state).toBe('review_required');
  for (const invalid of [
    { ...review, state: 'completed' }, { ...review, review: '0' }, { ...review, completed: '2' },
    { ...review, state: 'idle' }, { ...review, total: '02' }, { ...review, state: 'importing_unknown' },
  ]) expect(() => photosImportStatusFromNative(invalid)).toThrow('outcome_unknown');
});

it('keeps an owner-deleted historical version separate from completed', () => {
  const queue = fileQueueFromNative({ running: false, jobs: [{ id: 'deleted', sourceId: 'source',
    recordId: 'AAAAAAAAAAAAAAAAAAAAAA', name: 'kept-on-phone.jpg', state: 'owner_deleted',
    acknowledgedBytes: '4', totalBytes: '4', errorCode: 'owner_deleted' }], totalJobs: '1', hasMore: false });
  expect(queue.jobs[0]?.state).toBe('owner_deleted');
  expect(queue.jobs[0]?.errorCode).toBe('owner_deleted');
});


describe('durable access retry evidence', () => {
  const run = { id: 'run-1', recordId: job.recordId, attempts: 2, state: 'retry_wait',
    retryAt: '1792756860000', errorCode: 'connection_closed' };
  it('keeps settings-stopped old work separate from a fresh run and completed file receipts', () => {
    const stopped = { ...run, state: 'failed', retryAt: undefined, errorCode: 'settings_changed' };
    const observed = fileQueueFromNative({ ...queue, running: false, run: stopped });
    expect(observed.run?.errorCode).toBe('settings_changed');
    expect(observed.run?.attempts).toBe(2);
    expect(fileQueueFromNative({ ...queue, run: { ...run, id: 'new-run', attempts: 1, state: 'running', retryAt: undefined, errorCode: undefined } }).run?.id).toBe('new-run');
  });
  it('retains the attempt and due time across reopened, paused views without inventing completion', () => {
    expect(fileQueueFromNative({ ...queue, run }).run).toEqual(run);
    expect(fileQueueFromNative({ ...queue, running: false, run: { ...run, state: 'paused' } }).run?.attempts).toBe(2);
    expect(fileQueueFromNative({ ...queue, running: false, jobs: [], totalJobs: '0', run: {
      ...run, state: 'failed', attempts: 5, retryAt: undefined,
    } }).run?.state).toBe('failed');
  });
  it('rejects impossible retry budgets, stale live work and contradictory due times', () => {
    for (const change of [{ attempts: 0 }, { attempts: 6 }, { attempts: 1.5 }, { attempts: 5 },
      { state: 'completed' }, { retryAt: '9223372036854775807' }, { retryAt: undefined }, { retryAt: '01' }, { state: 'finished' }, { recordId: 'unknown' }]) {
      expect(() => fileQueueFromNative({ ...queue, run: { ...run, ...change } })).toThrow('outcome_unknown');
    }
    expect(() => fileQueueFromNative({ ...queue, running: false, run })).toThrow('outcome_unknown');
    expect(() => fileQueueFromNative({ ...queue, running: false,
      run: { ...run, state: 'running', retryAt: undefined } })).toThrow('outcome_unknown');
  });
});


it('accepts only real optional automatic pause/error evidence without changing transfer state', () => {
  expect(fileQueueFromNative(queue).automaticPaused).toBeUndefined();
  for (const automaticPaused of [true, false]) {
    const observed = fileQueueFromNative({ ...queue, automaticPaused, automaticError: 'automatic_unavailable' });
    expect(observed.automaticPaused).toBe(automaticPaused);
    expect(observed.automaticError).toBe('automatic_unavailable');
    expect(observed.running).toBe(true);
  }
  for (const automaticPaused of ['false', 0, null, undefined]) {
    expect(() => fileQueueFromNative({ ...queue, automaticPaused })).toThrow('outcome_unknown');
  }
  for (const automaticError of [false, 0, '', 'x'.repeat(1025)]) {
    expect(() => fileQueueFromNative({ ...queue, automaticError })).toThrow('outcome_unknown');
  }
});


it('validates optional notification evidence and treats an unavailable request API as no permission grant', async () => {
  expect(fileQueueFromNative(queue).notificationsEnabled).toBeUndefined();
  for (const notificationsEnabled of [true, false]) {
    expect(fileQueueFromNative({ ...queue, notificationsEnabled }).notificationsEnabled).toBe(notificationsEnabled);
  }
  for (const notificationsEnabled of ['false', 0, null, undefined]) {
    expect(() => fileQueueFromNative({ ...queue, notificationsEnabled })).toThrow('outcome_unknown');
  }
  try {
    jest.replaceProperty(Platform, 'OS', 'ios');
    await expect(fileTransfer.requestNotifications()).resolves.toBe(false);
    jest.replaceProperty(Platform, 'OS', 'android');
    await expect(fileTransfer.requestNotifications()).resolves.toBe(false);
  } finally { jest.restoreAllMocks(); }
});

it('keeps OS and access retry evidence separate and rejects contradictory scheduled completion', () => {
  const empty = { running: false, jobs: [], totalJobs: '0', hasMore: false };
  const automaticRun = { attempts: 3, state: 'waiting', updated: 0, retryAt: '300000' };
  expect(fileQueueFromNative({ ...empty, automaticRun }).automaticRun).toEqual(automaticRun);
  for (const wrong of [{ ...automaticRun, updated: 1 }, { ...automaticRun, attempts: 5 },
    { ...automaticRun, retryAt: undefined }, { attempts: 1, state: 'running', updated: 1 },
    { attempts: 0, state: 'paused', updated: 0 }]) {
    expect(() => fileQueueFromNative({ ...empty, automaticRun: wrong })).toThrow('outcome_unknown');
  }
  expect(fileQueueFromNative({ ...empty, automaticRun: { attempts: 5, state: 'exhausted', updated: 0 } }).automaticRun?.updated).toBe(0);
});

it('keeps iOS access retry independent from the fifth OS opportunity and rejects false completion', () => {
  const queue = { running: false, jobs: [], totalJobs: '0', hasMore: false };
  const automaticRun = { attempts: 5, accessAttempts: 2, state: 'waiting', updated: 0, retryAt: '600000', errorCode: 'connection_closed' };
  expect(fileQueueFromNative({ ...queue, automaticRun }).automaticRun?.accessAttempts).toBe(2);
  for (const row of [{ ...automaticRun, accessAttempts: 5 }, { ...automaticRun, accessAttempts: 0 },
    { ...automaticRun, accessAttempts: false }, { ...automaticRun, errorCode: 'os_interrupted' },
    { attempts: 1, state: 'finished', updated: 0 }, { attempts: 1, state: 'finished', updated: 1, errorCode: 'denied' }]) {
    expect(() => fileQueueFromNative({ ...queue, automaticRun: row })).toThrow('outcome_unknown');
  }
});
