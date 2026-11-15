import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';
import { FtpsItemsPanel } from './ftps-items-panel';
import { ftps } from '../../../shared/api/ftps';
import { ftpsBackups } from '../../../shared/api/ftps-backups';
import { i18n } from '../../../shared/i18n';
jest.mock('../../../shared/api/ftps',() => ({ ftps:{ status:jest.fn(),newRequest:jest.fn() },ftpsErrorCode:jest.requireActual('../../../shared/api/ftps').ftpsErrorCode }));
jest.mock('../../../shared/api/ftps-backups',() => ({ ftpsBackups:{ list:jest.fn(),restore:jest.fn(),copy:jest.fn(),cancel:jest.fn().mockResolvedValue(undefined) } }));
const id = '11111111-1111-4111-8111-111111111111', fileId = '33333333-3333-4333-8333-333333333333';
const item = { id,name:'owned.json',path:'source/owned.json',kind:'photo_manifest' as const,sha256:'A'.repeat(43),size:'1' };
const file = { ...item,id:fileId,name:'owned.bin',path:'source/owned.bin',kind:'file' as const,errorCode:'restart_review_required' };
const ticket = (n: number) => `0000000${n}-0000-4000-8000-000000000000`;
let listener: (state: AppStateStatus) => void = () => undefined;
beforeEach(() => {
  jest.clearAllMocks(); jest.mocked(ftps.status).mockResolvedValue({ supported:true,configured:true,enabled:true,running:false });
  let next = 0; jest.mocked(ftps.newRequest).mockImplementation(() => ticket(++next));
  jest.mocked(ftpsBackups.list).mockResolvedValue({ targetId:'A'.repeat(43),items:[item,file],hasMore:false,canRestoreFiles:true,canRestorePhotos:true });
  jest.spyOn(AppState,'addEventListener').mockImplementation((_event,callback) => { listener = callback; return { remove:jest.fn() }; });
});
afterEach(() => jest.restoreAllMocks());
async function mount(issues = false) {
  const view = await render(<FtpsItemsPanel issues={issues} />);
  await waitFor(() => expect(view.getByText(i18n.t(issues ? 'destinations.ftps.reviewTitle' : 'destinations.ftps.backupsTitle'))).toBeTruthy());
  await fireEvent.press(view.getByRole('button',{ name:i18n.t('destinations.review.refresh') }));
  await waitFor(() => expect(view.getByText(file.name)).toBeTruthy());
  return view;
}
const pending = () => { let finish: (value: string) => void = () => undefined; return { promise:new Promise<string>(resolve => { finish = resolve; }),finish:(value: string) => finish(value) }; };
async function withoutCrypto(run: () => Promise<void>) {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis,'crypto');
  try { Object.defineProperty(globalThis,'crypto',{ value:undefined,configurable:true,writable:true }); await run(); }
  finally { if (descriptor) Object.defineProperty(globalThis,'crypto',descriptor); else delete (globalThis as { crypto?: unknown }).crypto; }
}
const restoreButton = (name: string, kind: 'file' | 'photo') => ({ name:i18n.t(kind === 'file' ? 'transfer.backups.restore' : 'transfer.photos.restore',{ name }) });
it('cancels a Photos restore on foreground loss and ignores its late success',async () => {
  const late = pending(); jest.mocked(ftpsBackups.restore).mockReturnValue(late.promise);
  const view = await mount();
  await fireEvent.press(view.getByRole('button',restoreButton(item.name,'photo')));
  await act(async () => { listener('background'); });
  expect(ftpsBackups.cancel).toHaveBeenCalledWith(ticket(1),false);
  await act(async () => { late.finish(item.name); });
  expect(view.queryByText(i18n.t('transfer.backups.restored',{ name:item.name }))).toBeNull();
  await view.unmount();
});
it('restores a file with the native ticket when the JS runtime has no crypto',async () => withoutCrypto(async () => {
  jest.mocked(ftpsBackups.restore).mockResolvedValue(file.name);
  const view = await mount();
  await fireEvent.press(view.getByRole('button',restoreButton(file.name,'file')));
  await waitFor(() => expect(view.getByText(i18n.t('transfer.backups.restored',{ name:file.name }))).toBeTruthy());
  expect(ftpsBackups.restore).toHaveBeenCalledWith(expect.objectContaining({ id:fileId,kind:'file' }),ticket(1));
  await view.unmount();
}));
it('reviews a file with the native ticket when the JS runtime has no crypto',async () => withoutCrypto(async () => {
  jest.mocked(ftpsBackups.copy).mockResolvedValue(file.name);
  const view = await mount(true);
  expect(view.getAllByRole('button',{ name:i18n.t('destinations.review.keepBoth') })).toHaveLength(1);
  await fireEvent.press(view.getByRole('button',{ name:i18n.t('destinations.review.keepBoth') }));
  await waitFor(() => expect(view.getByText(i18n.t('destinations.ftps.copied',{ name:file.name }))).toBeTruthy());
  expect(ftpsBackups.copy).toHaveBeenCalledWith(fileId,ticket(1));
  await waitFor(() => expect(ftpsBackups.list).toHaveBeenCalledTimes(2));
  await view.unmount();
}));
it('cancels a review on foreground loss with its exact ticket and ignores its late success',async () => {
  const late = pending(); jest.mocked(ftpsBackups.copy).mockReturnValue(late.promise);
  const view = await mount(true);
  await fireEvent.press(view.getByRole('button',{ name:i18n.t('destinations.review.keepBoth') }));
  await act(async () => { listener('background'); });
  expect(ftpsBackups.cancel).toHaveBeenCalledWith(ticket(1),true);
  await act(async () => { late.finish(file.name); });
  expect(view.queryByText(i18n.t('destinations.ftps.copied',{ name:file.name }))).toBeNull();
  await view.unmount();
});
it('keeps the native Files picker handoff and cancels exact tickets explicitly or on unmount',async () => {
  jest.mocked(ftpsBackups.restore).mockImplementation(() => pending().promise);
  const view = await mount();
  await fireEvent.press(view.getByRole('button',restoreButton(file.name,'file')));
  await act(async () => { listener('background'); });
  expect(ftpsBackups.cancel).not.toHaveBeenCalled();
  await act(async () => { listener('active'); });
  await fireEvent.press(view.getByRole('button',{ name:i18n.t('transfer.backups.cancel') }));
  expect(ftpsBackups.cancel).toHaveBeenCalledWith(ticket(1),false);
  await fireEvent.press(view.getByRole('button',restoreButton(file.name,'file')));
  expect(ftpsBackups.restore).toHaveBeenLastCalledWith(expect.objectContaining({ id:fileId }),ticket(2));
  await view.unmount();
  expect(ftpsBackups.cancel).toHaveBeenLastCalledWith(ticket(2),false);
});
it('creates no ticket while busy or outside the foreground',async () => {
  jest.mocked(ftpsBackups.restore).mockImplementation(() => pending().promise);
  const view = await mount();
  await fireEvent.press(view.getByRole('button',restoreButton(item.name,'photo')));
  await fireEvent.press(view.getByRole('button',restoreButton(file.name,'file')));
  expect(ftps.newRequest).toHaveBeenCalledTimes(1); expect(ftpsBackups.restore).toHaveBeenCalledTimes(1);
  await act(async () => { listener('background'); });
  await fireEvent.press(view.getByRole('button',restoreButton(item.name,'photo')));
  expect(ftps.newRequest).toHaveBeenCalledTimes(1); expect(ftpsBackups.restore).toHaveBeenCalledTimes(1);
  await view.unmount();
});
it('shows a factory failure without a native call or stuck work and recovers on the next action',async () => {
  jest.mocked(ftps.newRequest).mockImplementationOnce(() => { throw new Error('native_unsupported'); });
  jest.mocked(ftpsBackups.restore).mockResolvedValue(item.name);
  const view = await mount();
  await fireEvent.press(view.getByRole('button',restoreButton(item.name,'photo')));
  expect(view.getByRole('alert')).toBeTruthy();
  expect(ftpsBackups.restore).not.toHaveBeenCalled(); expect(ftpsBackups.copy).not.toHaveBeenCalled(); expect(ftpsBackups.cancel).not.toHaveBeenCalled();
  expect(view.queryByRole('button',{ name:i18n.t('transfer.backups.cancel') })).toBeNull();
  await fireEvent.press(view.getByRole('button',restoreButton(item.name,'photo')));
  await waitFor(() => expect(view.getByText(i18n.t('transfer.backups.restored',{ name:item.name }))).toBeTruthy());
  expect(ftpsBackups.restore).toHaveBeenCalledWith(expect.objectContaining({ id }),ticket(1));
  expect(view.queryByRole('alert')).toBeNull();
  await view.unmount();
});
