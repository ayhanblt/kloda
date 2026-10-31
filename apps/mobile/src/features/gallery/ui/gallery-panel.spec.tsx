import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { AppState, BackHandler, type AppStateStatus } from 'react-native';
import { GalleryPanel } from './gallery-panel';
import { useGallery } from '../model/use-gallery';
function GalleryFixture() { return <GalleryPanel model={useGallery()} />; }
import { gallery } from '../../../shared/api/gallery';
import { i18n } from '../../../shared/i18n';

jest.mock('../../../shared/api/gallery', () => ({ gallery: {
  sources: jest.fn(), page: jest.fn(), preview: jest.fn(), history: jest.fn(),
} }));
const asset = { id: 'a', name: 'owned.png', width: 10, height: 20, video: false };
const jpeg = 'data:image/jpeg;base64,YQ==';
beforeEach(() => {
  jest.resetAllMocks();
  jest.spyOn(AppState, 'addEventListener').mockReturnValue({ remove: jest.fn() });
  jest.spyOn(BackHandler, 'addEventListener').mockReturnValue({ remove: jest.fn() });
  jest.mocked(gallery.sources).mockResolvedValue([{ id: 's', displayName: 'Selected album' }, { id: 'other', displayName: 'Other album' }]);
  jest.mocked(gallery.page).mockResolvedValue({ permission: 'limited', items: [asset], hasMore: false });
  jest.mocked(gallery.preview).mockResolvedValue(jpeg);
  jest.mocked(gallery.history).mockResolvedValue([{ recordId: 'paired-pc', state: 'completed', kind: 'manifest' }]);
});
afterEach(() => jest.restoreAllMocks());
it.each(['tr', 'en', 'de'])('opens real-source detail and labels receipts as past evidence in %s', async (language) => {
  await i18n.changeLanguage(language);
  const view = await render(<GalleryFixture />);
  await waitFor(() => expect(view.getByText(i18n.t('gallery.limited'))).toBeTruthy());
  await fireEvent.press(view.getByRole('button', { name: i18n.t('gallery.open', { name: asset.name }) }));
  await waitFor(() => expect(view.getByText('paired-pc')).toBeTruthy());
  expect(view.getByText(i18n.t('gallery.historyNote'))).toBeTruthy();
  expect(view.getByText(i18n.t('gallery.manifest'))).toBeTruthy();
  expect(view.getByText(i18n.t('transfer.states.completed'))).toBeTruthy();
  expect(gallery.preview).toHaveBeenCalledWith('s', 'a', true);
  expect(view.queryByRole('button', { name: i18n.t('ui.photo.deleteLocal') })).toBeNull();
  await fireEvent.press(view.getByRole('button', { name: i18n.t('ui.common.back') }));
  await waitFor(() => expect(view.getByRole('button', { name: 'Other album' })).toBeTruthy());
});
it('replaces a page and drops old thumbnails on source change', async () => {
  const view = await render(<GalleryFixture />);
  await waitFor(() => expect(gallery.preview).toHaveBeenCalledWith('s', 'a'));
  jest.mocked(gallery.page).mockResolvedValueOnce({ permission: 'granted', items: [], hasMore: false });
  await fireEvent.press(view.getByRole('button', { name: 'Other album' }));
  await waitFor(() => expect(view.getByText(i18n.t('gallery.empty'))).toBeTruthy());
  expect(view.queryByRole('button', { name: i18n.t('gallery.open', { name: asset.name }) })).toBeNull();
  expect(gallery.page).toHaveBeenCalledWith('other', 0);
});
it('shows denial and never loads previews for it', async () => {
  jest.mocked(gallery.page).mockResolvedValue({ permission: 'denied', items: [], hasMore: false });
  const view = await render(<GalleryFixture />);
  await waitFor(() => expect(view.getByText(i18n.t('ui.gallery.noPhotoPermission'))).toBeTruthy());
  expect(gallery.preview).not.toHaveBeenCalled();
});
it('keeps absent receipts unknown and unavailable previews explicit', async () => {
  jest.mocked(gallery.preview).mockResolvedValue(null);
  jest.mocked(gallery.history).mockResolvedValue([]);
  const view = await render(<GalleryFixture />);
  await waitFor(() => expect(view.getByText(i18n.t('gallery.limited'))).toBeTruthy());
  await fireEvent.press(view.getByRole('button', { name: i18n.t('gallery.open', { name: asset.name }) }));
  await waitFor(() => expect(view.getByText(i18n.t('gallery.noHistory'))).toBeTruthy());
  expect(view.getByText(i18n.t('gallery.previewUnavailable'))).toBeTruthy();
  expect(view.queryByText(i18n.t('transfer.states.completed'))).toBeNull();
});
it('clears pixels and ignores a late detail callback after backgrounding, then rechecks permission', async () => {
  let change!: (state: AppStateStatus) => void;
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, listener) => { change = listener; return { remove: jest.fn() }; });
  let finish!: (value: string) => void;
  const view = await render(<GalleryFixture />);
  await waitFor(() => expect(gallery.preview).toHaveBeenCalledWith('s', 'a'));
  jest.mocked(gallery.preview).mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
  await fireEvent.press(view.getByRole('button', { name: i18n.t('gallery.open', { name: asset.name }) }));
  await act(async () => { change('background'); finish(jpeg); });
  expect(view.queryByText(asset.name)).toBeNull();
  expect(gallery.history).not.toHaveBeenCalled();
  jest.mocked(gallery.page).mockResolvedValue({ permission: 'denied', items: [], hasMore: false });
  await act(async () => { change('active'); });
  await waitFor(() => expect(view.getByText(i18n.t('ui.gallery.noPhotoPermission'))).toBeTruthy());
});
it('handles native source/permission failure without retaining a success', async () => {
  const view = await render(<GalleryFixture />);
  await waitFor(() => expect(view.getByText(i18n.t('gallery.limited'))).toBeTruthy());
  jest.mocked(gallery.preview).mockRejectedValueOnce(new Error('source_changed'));
  await fireEvent.press(view.getByRole('button', { name: i18n.t('gallery.open', { name: asset.name }) }));
  await waitFor(() => expect(view.getByText(i18n.t('gallery.error'))).toBeTruthy());
  expect(view.queryByText(asset.name)).toBeNull();
  expect(view.queryByText(i18n.t('transfer.states.completed'))).toBeNull();
});
it('uses Android back to leave detail before leaving the gallery', async () => {
  const back = jest.spyOn(BackHandler, 'addEventListener');
  const view = await render(<GalleryFixture />);
  await waitFor(() => expect(view.getByText(i18n.t('gallery.limited'))).toBeTruthy());
  await fireEvent.press(view.getByRole('button', { name: i18n.t('gallery.open', { name: asset.name }) }));
  await waitFor(() => expect(back).toHaveBeenCalled());
  await act(async () => { expect(back.mock.calls.at(-1)![1](null as never)).toBe(true); });
  await waitFor(() => expect(view.getByRole('button', { name: 'Other album' })).toBeTruthy());
});
