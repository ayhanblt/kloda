import { Alert } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { ActivityPage } from './activity-page';
import { fileTransfer, photoManifestPrefix } from '../../../shared/api/file-transfer';
import { pairing } from '../../../shared/api/pairing';
import { i18n } from '../../../shared/i18n';

jest.mock('../../../shared/api/file-transfer', () => ({ photoManifestPrefix: 'kloda-photo-v1-', fileTransfer: {
  status: jest.fn(), run: jest.fn(), rebackup: jest.fn(), pause: jest.fn().mockResolvedValue({ running: false, jobs: [], totalJobs: '0', hasMore: false }),
  list: jest.fn(), restore: jest.fn(), cancelRestore: jest.fn().mockResolvedValue(true),
  photoStatus: jest.fn().mockResolvedValue({ state: 'idle', total: '0', completed: '0', review: '0' }), restorePhotos: jest.fn(),
} }));
jest.mock('../../../shared/api/pairing', () => ({ pairing: { status: jest.fn().mockResolvedValue({
  phase: 'complete', recordId: 'AAAAAAAAAAAAAAAAAAAAAA', peerFingerprint: 'isolated-public-fixture',
}) } }));

it('smokes actual production activity: acknowledged progress is exact and full upload is not durable completion', async () => {
  const job = { id: 'isolated-job', sourceId: 'isolated-source', recordId: 'AAAAAAAAAAAAAAAAAAAAAA', name: 'original.bin',
    state: 'uploading' as const, acknowledgedBytes: '9007199254740991', totalBytes: '9007199254740992' };
  jest.mocked(fileTransfer.status).mockResolvedValue({ running: false, jobs: [job], totalJobs: '1', hasMore: false });
  jest.mocked(fileTransfer.run).mockResolvedValue({ running: true, jobs: [{ ...job, acknowledgedBytes: job.totalBytes, state: 'finalizing' }], totalJobs: '1', hasMore: false });
  const surface = await render(<ActivityPage onBack={() => undefined} />);
  await waitFor(() => expect(surface.getByRole('progressbar').props.accessibilityValue.now).toBe(99));
  await fireEvent.press(surface.getByText(i18n.t('transfer.syncNow')));
  await waitFor(() => expect(surface.getByText(i18n.t('transfer.states.finalizing'))).toBeTruthy());
  expect(surface.queryByText(i18n.t('transfer.states.completed'))).toBeNull();
  expect(surface.getByRole('progressbar').props.accessibilityValue.now).toBe(100);
  await surface.unmount();
});

it('uses only own completed list results for explicit destination restore; cancellation is never success', async () => {
  const backup = { id: 'AAAAAAAAAAAAAAAAAAAAAA', name: 'saved-original.jpg', sha256: 'A'.repeat(43), size: '4' };
  jest.mocked(fileTransfer.status).mockResolvedValue({ running: false, jobs: [], totalJobs: '0', hasMore: false });
  jest.mocked(fileTransfer.list).mockResolvedValue({ items: [backup], hasMore: false });
  jest.mocked(fileTransfer.restore).mockRejectedValueOnce(new Error('cancelled'));
  const surface = await render(<ActivityPage onBack={() => undefined} />);
  await fireEvent.press(surface.getByText(i18n.t('transfer.backups.load')));
  await waitFor(() => expect(surface.getByText(backup.name)).toBeTruthy());
  const restoreLabel = i18n.t('transfer.backups.restore', { name: backup.name });
  await fireEvent.press(surface.getByText(restoreLabel));
  await waitFor(() => expect(surface.getByRole('alert').props.children).toBe(i18n.t('transfer.errors.cancelled')));
  expect(surface.queryByText(i18n.t('transfer.backups.restored', { name: backup.name }))).toBeNull();
  jest.mocked(fileTransfer.restore).mockResolvedValueOnce(backup);
  await fireEvent.press(surface.getByText(restoreLabel));
  await waitFor(() => expect(surface.getByText(i18n.t('transfer.backups.restored', { name: backup.name }))).toBeTruthy());
  await surface.unmount();
});

it('keeps a user-action pairing error visible through an empty native queue poll and wraps the full brand', async () => {
  jest.useFakeTimers();
  jest.mocked(fileTransfer.status).mockResolvedValue({ running: false, jobs: [], totalJobs: '0', hasMore: false });
  jest.mocked(pairing.status).mockResolvedValueOnce({ phase: 'idle', repairRequired: false });
  try {
    const surface = await render(<ActivityPage onBack={() => undefined} />);
    await fireEvent.press(surface.getByText(i18n.t('transfer.syncNow')));
    await waitFor(() => expect(surface.getByRole('alert').props.children).toBe(i18n.t('transfer.errors.pairing_required')));
    await act(async () => { jest.advanceTimersByTime(1100); });
    expect(surface.getByRole('alert').props.children).toBe(i18n.t('transfer.errors.pairing_required'));
    await surface.unmount();
  } finally { jest.useRealTimers(); }
});

it('shows an ambiguous Photos import as review rather than successful restore', async () => {
  const backup = { id: 'AAAAAAAAAAAAAAAAAAAAAA', name: `${photoManifestPrefix}fixture.json`, sha256: 'A'.repeat(43), size: '300' };
  jest.mocked(fileTransfer.status).mockResolvedValue({ running: false, jobs: [], totalJobs: '0', hasMore: false });
  jest.mocked(fileTransfer.list).mockResolvedValue({ items: [backup], hasMore: false });
  jest.mocked(fileTransfer.restorePhotos).mockResolvedValue({ state: 'review_required', total: '1', completed: '0', review: '1' });
  const surface = await render(<ActivityPage onBack={() => undefined} />);
  await fireEvent.press(surface.getByText(i18n.t('transfer.backups.load')));
  await waitFor(() => expect(surface.getByText(backup.name)).toBeTruthy());
  await fireEvent.press(surface.getByText(i18n.t('transfer.photos.restore')));
  await waitFor(() => expect(surface.getByText(i18n.t('transfer.photos.review_required', { review: '1' }))).toBeTruthy());
  expect(surface.queryByText(i18n.t('transfer.backups.restored', { name: backup.name }))).toBeNull();
  await surface.unmount();
});

it('requires explicit confirmation and uses current paired authority for an old-record deleted source version', async () => {
  const job = { id: 'AAAAAAAAAAAAAAAAAAAAAQ', sourceId: 'source', recordId: 'AAAAAAAAAAAAAAAAAAAAAQ', name: 'deleted.jpg',
    state: 'owner_deleted' as const, acknowledgedBytes: '4', totalBytes: '4', errorCode: 'owner_deleted' };
  jest.mocked(fileTransfer.status).mockResolvedValue({ running: false, jobs: [job], totalJobs: '1', hasMore: false });
  jest.mocked(fileTransfer.rebackup).mockResolvedValue({ running: true, jobs: [job], totalJobs: '1', hasMore: false });
  const confirmation = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  try {
    const surface = await render(<ActivityPage onBack={() => undefined} />);
    await waitFor(() => expect(surface.getByText(i18n.t('transfer.states.owner_deleted'))).toBeTruthy());
    expect(surface.queryByText(i18n.t('transfer.states.completed'))).toBeNull();
    jest.mocked(fileTransfer.rebackup).mockClear();
    await fireEvent.press(surface.getByText(i18n.t('transfer.rebackup')));
    expect(fileTransfer.rebackup).not.toHaveBeenCalled();
    const buttons = confirmation.mock.calls[0]?.[2];
    expect(buttons?.[0]?.style).toBe('cancel');
    await act(async () => { buttons?.[1]?.onPress?.(); });
    await waitFor(() => expect(fileTransfer.rebackup).toHaveBeenCalledWith('AAAAAAAAAAAAAAAAAAAAAA', job.id));
    await surface.unmount();
  } finally { confirmation.mockRestore(); }
});
