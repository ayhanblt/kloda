import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';
import { WebDavReviewPanel } from './webdav-review-panel';
import { webDavReview } from '../../../shared/api/webdav-review';
import { i18n } from '../../../shared/i18n';

jest.mock('../../../shared/api/webdav-review', () => ({ webDavReview: { items: jest.fn(), act: jest.fn(), cancel: jest.fn().mockResolvedValue(undefined) } }));
const id = '11111111-1111-4111-8111-111111111111';
const item = { id, sourceId: id, targetId: 'A'.repeat(43), name: 'owned.bin', relativePath: `${id}/owned.bin`, kind: 'file' as const,
  phase: 'uploaded' as const, skipped: false, errorCode: 'conflict', canRecheck: true, canKeepBoth: true };
beforeEach(() => { jest.clearAllMocks(); jest.mocked(webDavReview.items).mockResolvedValue({ items: [item], hasMore: false }); });
afterEach(() => jest.restoreAllMocks());
it('keeps an old context blocked and never shows skipped work as completed', async () => {
  jest.spyOn(AppState, 'addEventListener').mockReturnValue({ remove: jest.fn() });
  jest.mocked(webDavReview.items).mockResolvedValue({ items: [{ ...item, canRecheck: false, canKeepBoth: false, errorCode: 'settings_changed' }], hasMore: false });
  jest.mocked(webDavReview.act).mockResolvedValue('skipped');
  const surface = await render(<WebDavReviewPanel />);
  await waitFor(() => expect(surface.getByText('owned.bin')).toBeTruthy());
  await fireEvent.press(surface.getByText(i18n.t('destinations.review.recheck')));
  expect(webDavReview.act).not.toHaveBeenCalled();
  await fireEvent.press(surface.getByText(i18n.t('destinations.review.skip')));
  await waitFor(() => expect(surface.getByText(i18n.t('destinations.review.results.skipped'))).toBeTruthy());
  expect(surface.queryByText(i18n.t('destinations.review.results.completed'))).toBeNull();
});
it('cancels only the prior request and ignores its late result after away/back', async () => {
  let changed: ((state: AppStateStatus) => void) | undefined;
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_, listener) => { changed = listener; return { remove: jest.fn() }; });
  let finish!: (value: 'completed') => void;
  jest.mocked(webDavReview.act).mockReturnValueOnce(new Promise((resolve) => { finish = resolve; })).mockResolvedValueOnce('skipped');
  const surface = await render(<WebDavReviewPanel />);
  await waitFor(() => expect(surface.getByText('owned.bin')).toBeTruthy());
  await fireEvent.press(surface.getByText(i18n.t('destinations.review.recheck')));
  await waitFor(() => expect(webDavReview.act).toHaveBeenCalledTimes(1));
  const request = jest.mocked(webDavReview.act).mock.calls[0][2];
  await act(async () => { changed?.('background'); changed?.('active'); });
  await waitFor(() => expect(webDavReview.cancel).toHaveBeenCalledWith(request));
  await fireEvent.press(surface.getByText(i18n.t('destinations.review.skip')));
  await waitFor(() => expect(webDavReview.act).toHaveBeenCalledTimes(2));
  expect(jest.mocked(webDavReview.act).mock.calls[1][2]).not.toBe(request);
  await act(async () => { finish('completed'); });
  expect(surface.queryByText(i18n.t('destinations.review.results.completed'))).toBeNull();
});

it('refreshes after away/back while an earlier listing remains pending', async () => {
  let changed: ((state: AppStateStatus) => void) | undefined;
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_, listener) => { changed = listener; return { remove: jest.fn() }; });
  let finish!: (value: Awaited<ReturnType<typeof webDavReview.items>>) => void;
  jest.mocked(webDavReview.items).mockReturnValueOnce(new Promise((resolve) => { finish = resolve; }));
  const surface = await render(<WebDavReviewPanel />);
  await waitFor(() => expect(webDavReview.items).toHaveBeenCalledTimes(1));
  await act(async () => { changed?.('background'); changed?.('active'); });
  await waitFor(() => expect(surface.getByText('owned.bin')).toBeTruthy());
  await act(async () => { finish({ items: [], hasMore: false }); });
  expect(surface.getByText('owned.bin')).toBeTruthy();
});

it('uses a distinct explicit authorization action for an old context', async () => {
  jest.spyOn(AppState, 'addEventListener').mockReturnValue({ remove: jest.fn() });
  jest.mocked(webDavReview.items).mockResolvedValue({ items: [{ ...item, requiresAuthorization: true }], hasMore: false });
  jest.mocked(webDavReview.act).mockResolvedValue('completed');
  const surface = await render(<WebDavReviewPanel />);
  await waitFor(() => expect(surface.getByText(i18n.t('destinations.review.authorizationHint'))).toBeTruthy());
  await fireEvent.press(surface.getByText(i18n.t('destinations.review.authorizeRecheck')));
  await waitFor(() => expect(webDavReview.act).toHaveBeenCalledWith(id, 'authorize_recheck', expect.any(String)));
});
