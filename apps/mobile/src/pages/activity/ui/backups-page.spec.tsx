import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { AppState } from 'react-native';
import { ActivityPage } from './activity-page';
import { fileTransfer } from '../../../shared/api/file-transfer';
import { i18n } from '../../../shared/i18n';

jest.mock('../../../shared/api/file-transfer', () => ({ photoManifestPrefix: 'kloda-photo-v1-', fileTransfer: {
  status: jest.fn(), list: jest.fn(), cancelRestore: jest.fn().mockResolvedValue(true),
  photoStatus: jest.fn().mockResolvedValue({ state: 'idle', total: '0', completed: '0', review: '0' }),
} }));
jest.mock('../../../shared/api/pairing', () => ({ pairing: { status: jest.fn().mockResolvedValue({
  phase: 'complete', recordId: 'AAAAAAAAAAAAAAAAAAAAAA', peerFingerprint: 'isolated-public-fixture',
}) } }));
beforeEach(() => { jest.spyOn(AppState, 'addEventListener').mockReturnValue({ remove: jest.fn() }); });
afterEach(() => { jest.restoreAllMocks(); });

it('renders the separate embedded backups surface without upload controls or unrelated queue rows', async () => {
  const backup = { id: 'AAAAAAAAAAAAAAAAAAAAAA', name: 'separate-backup.jpg', sha256: 'A'.repeat(43), size: '4' };
  jest.mocked(fileTransfer.status).mockResolvedValue({ running: false, jobs: [{
    id: 'upload-job', sourceId: 'source', recordId: 'AAAAAAAAAAAAAAAAAAAAAA', name: 'unrelated-upload.bin',
    state: 'uploading', acknowledgedBytes: '0', totalBytes: '4',
  }], totalJobs: '1', hasMore: false });
  jest.mocked(fileTransfer.list).mockResolvedValue({ items: [backup], hasMore: false });
  const surface = await render(<ActivityPage onBack={() => undefined} embedded view="backups" />);
  expect(surface.queryByText(i18n.t('transfer.syncNow'))).toBeNull();
  expect(surface.queryByText('unrelated-upload.bin')).toBeNull();
  await fireEvent.press(surface.getByText(i18n.t('transfer.backups.load')));
  await waitFor(() => expect(surface.getByText(backup.name)).toBeTruthy());
  expect(surface.getByText(i18n.t('transfer.backups.restore', { name: backup.name }))).toBeTruthy();
  await surface.unmount();
});

it('keeps failed own-backup loading visible on the separate backups surface', async () => {
  jest.mocked(fileTransfer.status).mockResolvedValue({ running: false, jobs: [], totalJobs: '0', hasMore: false });
  jest.mocked(fileTransfer.list).mockRejectedValueOnce(new Error('connection_closed'));
  const surface = await render(<ActivityPage onBack={() => undefined} embedded view="backups" />);
  await fireEvent.press(surface.getByText(i18n.t('transfer.backups.load')));
  await waitFor(() => expect(surface.getByRole('alert').props.children).toBe(i18n.t('transfer.errors.connection_closed')));
  await surface.unmount();
});
