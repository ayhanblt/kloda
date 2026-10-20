import { completedBackupsFromNative, fileQueueFromNative, photosImportStatusFromNative, restoredBackupFromNative } from './file-transfer';

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
