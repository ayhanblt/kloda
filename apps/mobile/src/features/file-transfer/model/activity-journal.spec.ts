import type { FileJob, FileQueue } from '../../../shared/api/file-transfer';
import { activityNowJobs, activityPastJobs } from './activity-journal';

const job = (id: string, state: FileJob['state']): FileJob => ({ id, sourceId: `source-${id}`, recordId: 'AAAAAAAAAAAAAAAAAAAAAA', name: `${id}.bin`, state,
  acknowledgedBytes: state === 'completed' ? '4' : '0', totalBytes: '4' });
// Native order is intentionally not chronological; the projection must keep it untouched.
const mixed: FileQueue = { running: true, totalJobs: '8', hasMore: false, jobs: [
  job('j-queued', 'queued'), job('j-done-b', 'completed'), job('j-preparing', 'preparing'), job('j-paused', 'paused'),
  job('j-uploading', 'uploading'), job('j-blocked', 'blocked'), job('j-done-a', 'completed'), job('j-deleted', 'owner_deleted'),
] };
const ids = (jobs: FileJob[]) => jobs.map(({ id }) => id);

it('projects one mixed native snapshot into Now and Past sets without reordering or mutating it', () => {
  const snapshot = JSON.stringify(mixed);
  expect(ids(activityNowJobs(mixed))).toEqual(['j-queued', 'j-preparing', 'j-paused', 'j-uploading', 'j-blocked', 'j-deleted']);
  expect(ids(activityPastJobs(mixed, 'all'))).toEqual(['j-done-b', 'j-paused', 'j-blocked', 'j-done-a', 'j-deleted']);
  expect(ids(activityPastJobs(mixed, 'done'))).toEqual(['j-done-b', 'j-done-a']);
  expect(ids(activityPastJobs(mixed, 'issues'))).toEqual(['j-paused', 'j-blocked', 'j-deleted']);
  expect(JSON.stringify(mixed)).toBe(snapshot);
});

it('never treats finalizing or fully acknowledged upload as a past success', () => {
  const pending: FileQueue = { running: true, totalJobs: '2', hasMore: false, jobs: [
    { ...job('j-full', 'uploading'), acknowledgedBytes: '4' }, { ...job('j-final', 'finalizing'), acknowledgedBytes: '4' },
  ] };
  expect(activityPastJobs(pending, 'all')).toEqual([]);
  expect(activityPastJobs(pending, 'done')).toEqual([]);
  expect(ids(activityNowJobs(pending))).toEqual(['j-full', 'j-final']);
});
