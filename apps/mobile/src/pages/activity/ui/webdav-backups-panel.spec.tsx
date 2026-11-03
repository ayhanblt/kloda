import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';
import { WebDavBackupsPanel } from './webdav-backups-panel';
import { webDavBackups } from '../../../shared/api/webdav-backups';
import { i18n } from '../../../shared/i18n';

jest.mock('../../../shared/api/webdav-backups', () => ({ webDavBackups: { list: jest.fn(), restoreFile: jest.fn(), restorePhotos: jest.fn(), cancel: jest.fn().mockResolvedValue(undefined) } }));
const id = '11111111-1111-4111-8111-111111111111';
const item = { id, sourceId: id, name: 'own.bin', kind: 'file' as const, sha256: 'A'.repeat(43), size: '1' };
beforeEach(() => {
  jest.clearAllMocks(); jest.mocked(webDavBackups.list).mockResolvedValue({ targetId: 'A'.repeat(43), items: [item], hasMore: false, canRestoreFiles: true, canRestorePhotos: false });
});
afterEach(() => jest.restoreAllMocks());
it('keeps native picker hand-off pending and cancels only its own restore when unmounted', async () => {
  let changed: ((state: AppStateStatus) => void) | undefined;
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_, listener) => { changed = listener; return { remove: jest.fn() }; });
  let finish!: (value: { name: string }) => void;
  jest.mocked(webDavBackups.restoreFile).mockReturnValue(new Promise((resolve) => { finish = resolve; }));
  const surface = await render(<WebDavBackupsPanel />);
  await fireEvent.press(surface.getByText(i18n.t('destinations.restore.load')));
  await waitFor(() => expect(surface.getByText('own.bin')).toBeTruthy());
  await fireEvent.press(surface.getByText(i18n.t('transfer.backups.restore', { name: 'own.bin' })));
  await waitFor(() => expect(webDavBackups.restoreFile).toHaveBeenCalledTimes(1));
  const nonce = jest.mocked(webDavBackups.restoreFile).mock.calls[0][1];
  await act(async () => { changed?.('background'); changed?.('active'); });
  expect(webDavBackups.cancel).not.toHaveBeenCalled();
  await surface.unmount();
  expect(webDavBackups.cancel).toHaveBeenCalledWith(nonce);
  await act(async () => { finish({ name: 'own.bin' }); });
});
it('does not offer a working restore when the native adapter is still unavailable', async () => {
  jest.spyOn(AppState, 'addEventListener').mockReturnValue({ remove: jest.fn() });
  jest.mocked(webDavBackups.list).mockResolvedValue({ targetId: 'A'.repeat(43), items: [item], hasMore: false, canRestoreFiles: false, canRestorePhotos: false });
  const surface = await render(<WebDavBackupsPanel />);
  await fireEvent.press(surface.getByText(i18n.t('destinations.restore.load')));
  await waitFor(() => expect(surface.getByText(i18n.t('destinations.restore.unavailable'))).toBeTruthy());
  expect(surface.queryByText(i18n.t('transfer.backups.restore', { name: 'own.bin' }))).toBeNull();
  expect(webDavBackups.restoreFile).not.toHaveBeenCalled();
});

it('routes Photos restore through its typed native API', async () => {
  jest.spyOn(AppState, 'addEventListener').mockReturnValue({ remove: jest.fn() });
  jest.mocked(webDavBackups.list).mockResolvedValue({ targetId: 'A'.repeat(43), items: [{ ...item, kind: 'photo_manifest' }], hasMore: false, canRestoreFiles: true, canRestorePhotos: true });
  jest.mocked(webDavBackups.restorePhotos).mockResolvedValue({ name: 'own.png' });
  const surface = await render(<WebDavBackupsPanel />);
  await fireEvent.press(surface.getByText(i18n.t('destinations.restore.load')));
  await waitFor(() => expect(surface.getByText(i18n.t('transfer.photos.restore'))).toBeTruthy());
  await fireEvent.press(surface.getByText(i18n.t('transfer.photos.restore')));
  await waitFor(() => expect(webDavBackups.restorePhotos).toHaveBeenCalledWith(id, expect.any(String), ''));
  expect(webDavBackups.restoreFile).not.toHaveBeenCalled();
});
it('does not call a filtered first catalog page empty when more local receipts remain', async () => {
  jest.spyOn(AppState, 'addEventListener').mockReturnValue({ remove: jest.fn() });
  jest.mocked(webDavBackups.list).mockResolvedValue({ targetId: 'A'.repeat(43), items: [], hasMore: true, nextCursor: id, canRestoreFiles: true, canRestorePhotos: true });
  const surface = await render(<WebDavBackupsPanel />);
  await fireEvent.press(surface.getByText(i18n.t('destinations.restore.load')));
  await waitFor(() => expect(surface.getByText(i18n.t('transfer.backups.more'))).toBeTruthy());
  expect(surface.queryByText(i18n.t('transfer.backups.empty'))).toBeNull();
});
