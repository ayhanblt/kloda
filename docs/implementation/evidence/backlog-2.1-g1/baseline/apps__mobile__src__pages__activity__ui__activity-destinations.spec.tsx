import { AppState } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { ActivityPage } from './activity-page';
import { backupDestinations } from '../../../shared/api/backup-destinations';
import { fileTransfer } from '../../../shared/api/file-transfer';
import { pairing } from '../../../shared/api/pairing';
import { i18n } from '../../../shared/i18n';

jest.mock('../../../shared/api/backup-destinations', () => ({ backupDestinations: {
  status: jest.fn().mockResolvedValue({ configured: false, enabled: false, running: false }), pcSelected: jest.fn().mockResolvedValue(true), pcEnabled: jest.fn().mockResolvedValue(true), run: jest.fn(),
} }));
jest.mock('../../../shared/api/file-transfer', () => ({ photoManifestPrefix: 'kloda-photo-v1-', fileTransfer: {
  status: jest.fn(), run: jest.fn(), requestNotifications: jest.fn().mockResolvedValue(true), cancelRestore: jest.fn().mockResolvedValue(true),
  photoStatus: jest.fn().mockResolvedValue({ state: 'idle', total: '0', completed: '0', review: '0' }),
} }));
jest.mock('../../../shared/api/pairing', () => ({ pairing: { status: jest.fn().mockResolvedValue({
  phase: 'complete', recordId: 'AAAAAAAAAAAAAAAAAAAAAA', peerFingerprint: 'isolated-public-fixture',
}) } }));
beforeEach(() => { jest.spyOn(AppState, 'addEventListener').mockReturnValue({ remove: jest.fn() }); });
afterEach(() => jest.restoreAllMocks());

it('starts an enabled WebDAV destination while the PC attempt is still pending', async () => {
  const dav = { configured: true, enabled: true, running: false, targetId: 'A'.repeat(43), config: { endpoint: 'https://owned.invalid', targetPath: 'Kloda', username: 'owned' } };
  jest.mocked(backupDestinations.status).mockResolvedValue(dav);
  jest.mocked(backupDestinations.run).mockResolvedValue(dav);
  jest.mocked(fileTransfer.status).mockResolvedValue({ running: false, jobs: [], totalJobs: '0', hasMore: false });
  let failPc!: (error: Error) => void;
  jest.mocked(fileTransfer.run).mockReturnValueOnce(new Promise((_, reject) => { failPc = reject; }));
  try {
    const surface = await render(<ActivityPage onBack={() => undefined} />);
    await fireEvent.press(surface.getByText(i18n.t('transfer.syncNow')));
    await waitFor(() => expect(backupDestinations.run).toHaveBeenCalled());
    await waitFor(() => expect(failPc).toBeDefined());
    await act(async () => { failPc(new Error('connection_unavailable')); });
    await waitFor(() => expect(surface.getByText(i18n.t('transfer.errors.connection_unavailable'))).toBeTruthy());
  } finally { jest.mocked(backupDestinations.status).mockResolvedValue({ configured: false, enabled: false, running: false }); }
});
it('skips the disabled PC during a general backup and still runs enabled WebDAV', async () => {
  jest.mocked(fileTransfer.run).mockClear(); jest.mocked(backupDestinations.run).mockClear();
  jest.mocked(fileTransfer.status).mockResolvedValue({ running: false, jobs: [], totalJobs: '0', hasMore: false });
  jest.mocked(backupDestinations.pcSelected).mockResolvedValueOnce(false);
  jest.mocked(pairing.status).mockClear();
  jest.mocked(backupDestinations.status).mockResolvedValue({ configured: true, enabled: true, running: false });
  try {
    const surface = await render(<ActivityPage onBack={() => undefined} />);
    await fireEvent.press(surface.getByText(i18n.t('transfer.syncNow')));
    await waitFor(() => expect(backupDestinations.run).toHaveBeenCalledTimes(1));
    expect(fileTransfer.run).not.toHaveBeenCalled();
    expect(pairing.status).not.toHaveBeenCalled();
  } finally { jest.mocked(backupDestinations.status).mockResolvedValue({ configured: false, enabled: false, running: false }); }
});
