import * as Native from 'react-native';
import { AppState, Platform } from 'react-native';
import { act, render, waitFor } from '@testing-library/react-native';
import { ActivityPage } from './activity-page';
import { fileTransfer } from '../../../shared/api/file-transfer';
import { i18n } from '../../../shared/i18n';

jest.mock('../../../shared/api/backup-destinations', () => ({ backupDestinations: { status: jest.fn().mockResolvedValue({ configured: false, enabled: false, running: false }), pcSelected: jest.fn().mockResolvedValue(true), pcEnabled: jest.fn().mockResolvedValue(true), run: jest.fn() } }));
jest.mock('../../../shared/api/file-transfer', () => ({ photoManifestPrefix: 'kloda-photo-v1-', fileTransfer: {
  requestNotifications: jest.fn().mockResolvedValue(true), status: jest.fn(), run: jest.fn(), rebackup: jest.fn(), pause: jest.fn().mockResolvedValue({ running: false, jobs: [], totalJobs: '0', hasMore: false }),
  resumeAutomatic: jest.fn(), list: jest.fn(), restore: jest.fn(), cancelRestore: jest.fn().mockResolvedValue(true),
  photoStatus: jest.fn().mockResolvedValue({ state: 'idle', total: '0', completed: '0', review: '0' }), restorePhotos: jest.fn(),
} }));
jest.mock('../../../shared/api/pairing', () => ({ pairing: { status: jest.fn().mockResolvedValue({
  phase: 'complete', recordId: 'AAAAAAAAAAAAAAAAAAAAAA', peerFingerprint: 'isolated-public-fixture',
}) } }));

beforeEach(() => { jest.replaceProperty(Platform, 'OS', 'android'); jest.spyOn(AppState, 'addEventListener').mockReturnValue({ remove: jest.fn() }); });
afterEach(() => { jest.restoreAllMocks(); });

it('shows iOS access retry separately from OS opportunity counts in all three languages', async () => {
  jest.replaceProperty(Platform, 'OS', 'ios');
  try {
    for (const language of ['tr', 'en', 'de']) {
      await i18n.changeLanguage(language);
      jest.mocked(fileTransfer.status).mockResolvedValue({ running: false, jobs: [], totalJobs: '0', hasMore: false,
        automaticRun: { attempts: 5, accessAttempts: 2, state: 'waiting', updated: 0, errorCode: 'connection_closed' } });
      const surface = await render(<ActivityPage onBack={() => undefined} />);
      await waitFor(() => expect(surface.getByText(i18n.t('transfer.osAttempt', { attempt: 5 }))).toBeTruthy());
      expect(surface.getByText(i18n.t('transfer.runAttempt', { attempt: 2 }))).toBeTruthy();
      expect(surface.getByText(i18n.t('transfer.retryWaiting'))).toBeTruthy();
      expect(surface.queryByText(i18n.t('transfer.osStates.waiting'))).toBeNull();
      await surface.unmount();
    }
  } finally { await i18n.changeLanguage('tr'); }
});


it('G24-07: os_interrupted and WebDAV auth refusal keep their own states and claim no exact cause in all three languages', async () => {
  try {
    for (const language of ['tr', 'en', 'de']) {
      await i18n.changeLanguage(language);
      jest.mocked(fileTransfer.status).mockResolvedValue({ running: false, jobs: [], totalJobs: '0', hasMore: false,
        run: { id: 'run-1', recordId: 'AAAAAAAAAAAAAAAAAAAAAA', attempts: 1, state: 'failed', errorCode: 'webdav_auth' },
        automaticRun: { attempts: 3, accessAttempts: 1, state: 'waiting', updated: 0, errorCode: 'os_interrupted' } });
      const surface = await render(<ActivityPage onBack={() => undefined} />);
      await waitFor(() => expect(surface.getByText(i18n.t('transfer.errors.os_interrupted'))).toBeTruthy());
      expect(surface.getByText(i18n.t('transfer.osStates.waiting'))).toBeTruthy();
      expect(surface.queryByText(i18n.t('transfer.retryWaiting'))).toBeNull();
      expect(surface.getByText(i18n.t('transfer.errors.webdav_auth'))).toBeTruthy();
      expect(surface.queryByText(/transfer\./)).toBeNull();
      await surface.unmount();
    }
  } finally { await i18n.changeLanguage('tr'); }
});

it.each([{ fontScale: 1, height: 852 }, { fontScale: 2.643, height: 852 }, { fontScale: 1, height: 393 }])('keeps headers and actions reachable with $fontScale font and $height height', async ({ fontScale, height }) => {
  const original = Native.Dimensions.get('window');
  await act(async () => { Native.Dimensions.set({ window: { width: 393, height, scale: 3, fontScale } }); });
  jest.mocked(fileTransfer.status).mockResolvedValue({ running: false, jobs: [], totalJobs: '0', hasMore: false, automaticPaused: true });
  const surface = await render(<ActivityPage onBack={() => undefined} />);
  await waitFor(() => expect(surface.getByRole('button', { name: i18n.t('transfer.continueAutomatic') })).toBeTruthy());
  const inScroll = (node: ReturnType<typeof surface.getByText>) => {
    for (let current: typeof node | null = node; current; current = current.parent) if (typeof current.type === 'string' && current.type.includes('ScrollView')) return true;
    return false;
  };
  expect(inScroll(surface.getByRole('button', { name: i18n.t('transfer.continueAutomatic') }))).toBe(fontScale > 1.3 || height < 600);
  expect(inScroll(surface.getByRole('button', { name: i18n.t('pairing.back') }))).toBe(fontScale > 1.3 || height < 600);
  expect(inScroll(surface.getByRole('button', { name: i18n.t('transfer.syncNow') }))).toBe(fontScale > 1.3 || height < 600);
  await surface.unmount();
  await act(async () => { Native.Dimensions.set({ window: original }); });
});
