import { homeStatus, otherTargetState, type HomeObservation } from './home-status';
import type { FileQueue } from '../../../shared/api/file-transfer';
import type { WebDavBackupStatus } from '../../../shared/api/backup-destinations';
const job = { id: 'job', sourceId: 'source', recordId: 'record', name: 'file', state: 'completed' as const, acknowledgedBytes: '9007199254740993', totalBytes: '9007199254740993' };
const queue: FileQueue = { running: false, jobs: [job], totalJobs: '1', hasMore: false, run: { id: 'run', recordId: 'record', attempts: 1, state: 'finished' } };
const absent: WebDavBackupStatus = { configured: false, enabled: false, running: false };
const dav: WebDavBackupStatus = { configured: true, enabled: true, running: false, run: { id: 'dav', targetId: 'target', automatic: false, attempts: 1, osAttempts: 0, state: 'finished', counts: { operations: '4', completedOperations: '4', files: '1', completedFiles: '1', photos: '0', completedPhotos: '0' } } };
const input: HomeObservation = { sourceCount: 1, pcSelected: true, queue, webdav: absent };

test('safe requires known completed runs from every explicitly enabled target', () => {
  expect(homeStatus(input).state).toBe('safe');
  expect(homeStatus({ ...input, pcSelected: false }).state).toBe('setup');
  expect(homeStatus({ ...input, queue: { ...queue, hasMore: true } }).state).toBe('waiting');
  expect(homeStatus({ ...input, queue: { ...queue, jobs: [] } }).state).toBe('waiting');
  expect(homeStatus({ ...input, webdav: { ...dav, run: undefined } }).state).toBe('waiting');
  expect(homeStatus({ ...input, webdav: dav }).state).toBe('safe');
  expect(homeStatus({ ...input, pcSelected: null, webdav: dav }).state).toBe('waiting');
  expect(homeStatus({ ...input, webdav: null }).state).toBe('waiting');
  expect(homeStatus({ ...input, queue: null, pcSelected: false, webdav: dav, pcError: 'pairing_required' }).state).toBe('safe');
});
test('unknown/paused/error/review stay non-successful and disabled destinations do not authorize backup', () => {
  expect(homeStatus({ ...input, queue: null, webdav: null, pcSelected: null }).state).toBe('waiting');
  expect(homeStatus({ ...input, queue: { ...queue, automaticPaused: true } }).state).toBe('waiting');
  expect(homeStatus({ ...input, pcSelected: false, queue: { ...queue, automaticPaused: true }, webdav: dav }).state).toBe('waiting');
  expect(homeStatus({ ...input, pcError: 'access_revoked' }).state).toBe('error');
  expect(homeStatus({ ...input, queue: { ...queue, jobs: [{ ...job, state: 'blocked' }] } }).state).toBe('attention');
  expect(homeStatus({ ...input, pcSelected: false, webdav: { ...dav, enabled: false } }).state).toBe('setup');
});
test('progress uses exact acknowledged int64 values and never assumes a missing total', () => {
  const result = homeStatus({ ...input, queue: { ...queue, running: true, jobs: [{ ...job, state: 'uploading', acknowledgedBytes: '4503599627370496' }] } });
  expect(result.state).toBe('syncing'); expect(result.progress?.completed).toBe('4503599627370496'); expect(result.progress?.percent).toBe(49.99);
  expect(homeStatus({ ...input, queue: { ...queue, running: true, jobs: [{ ...job, totalBytes: undefined }] } }).progress).toBeUndefined();
  expect(homeStatus({ ...input, pcSelected: false, webdav: { ...dav, running: true, run: { ...dav.run!, state: 'running', counts: { ...dav.run!.counts, completedOperations: '2' } } } }).progress).toEqual({ kind: 'operations', completed: '2', total: '4', percent: 50 });
});
test('other destinations count only when enabled and keep the most urgent state', () => {
  const dropbox = { id: 'dbx', label: 'Dropbox', kind: 'cloud' as const, enabled: true, run: { state: 'finished' } };
  const alone = { ...input, pcSelected: false, queue: null };
  expect(homeStatus({ ...alone, others: [dropbox] }).state).toBe('safe');
  expect(homeStatus({ ...alone, others: [{ ...dropbox, enabled: false }] }).state).toBe('setup');
  expect(homeStatus({ ...alone, others: [{ ...dropbox, run: undefined }] }).state).toBe('waiting');
  expect(homeStatus({ ...alone, others: [dropbox, { ...dropbox, id: 'smb', kind: 'nas', run: { state: 'needs_attention' } }] }).state).toBe('attention');
  expect(homeStatus({ ...alone, others: [dropbox, { ...dropbox, id: 'sftp', automaticError: 'auth_failed' }] }).state).toBe('error');
  expect(homeStatus({ ...input, others: [{ ...dropbox, running: true }] })).toEqual({ state: 'syncing' });
  expect(homeStatus({ ...input, others: [dropbox] }).state).toBe('safe');
  expect(homeStatus({ ...input, sourceCount: 0, others: [dropbox] }).state).toBe('setup');
  expect(otherTargetState({ ...dropbox, run: { state: 'finished', errorCode: 'x' } })).toBe('waiting');
  expect(otherTargetState({ ...dropbox, run: { state: 'exhausted' } })).toBe('error');
});
