import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';
import { SmbItemsPanel } from './smb-items-panel';
import { smb } from '../../../shared/api/smb';
import { smbBackups } from '../../../shared/api/smb-backups';
import { i18n } from '../../../shared/i18n';
jest.mock('../../../shared/api/smb',() => ({ smb:{ status:jest.fn(),newRequest:jest.fn() } }));
jest.mock('../../../shared/api/smb-backups',() => ({ smbBackups:{ list:jest.fn(),restore:jest.fn(),copy:jest.fn(),cancel:jest.fn().mockResolvedValue(undefined) } }));
const id = '11111111-1111-4111-8111-111111111111', fileId = '33333333-3333-4333-8333-333333333333';
const item = { id,name:'owned.json',path:'source/owned.json',kind:'photo_manifest' as const,sha256:'A'.repeat(43),size:'1' };
const file = { ...item,id:fileId,name:'owned.bin',path:'source/owned.bin',kind:'file' as const,errorCode:'restart_review_required' };
const ticket = (n: number) => `0000000${n}-0000-4000-8000-000000000000`;
let listener: (state: AppStateStatus) => void = () => undefined;
beforeEach(() => {
  jest.clearAllMocks(); jest.mocked(smb.status).mockResolvedValue({ supported:true,configured:true,enabled:true,running:false });
  let next = 0; jest.mocked(smb.newRequest).mockImplementation(() => ticket(++next));
  jest.mocked(smbBackups.list).mockResolvedValue({ targetId:'A'.repeat(43),items:[item,file],hasMore:false,canRestoreFiles:true,canRestorePhotos:true });
  jest.spyOn(AppState,'addEventListener').mockImplementation((_event,callback) => { listener = callback; return { remove:jest.fn() }; });
});
afterEach(() => jest.restoreAllMocks());
async function mount(issues = false) {
  const view = await render(<SmbItemsPanel issues={issues} />);
  await waitFor(() => expect(view.getByText(i18n.t(issues ? 'destinations.smb.reviewTitle' : 'destinations.smb.backupsTitle'))).toBeTruthy());
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
  const late = pending(); jest.mocked(smbBackups.restore).mockReturnValue(late.promise);
  const view = await mount();
  await fireEvent.press(view.getByRole('button',restoreButton(item.name,'photo')));
  await act(async () => { listener('background'); });
  expect(smbBackups.cancel).toHaveBeenCalledWith(ticket(1),false);
  await act(async () => { late.finish(item.name); });
  expect(view.queryByText(i18n.t('transfer.backups.restored',{ name:item.name }))).toBeNull();
  await view.unmount();
});
it('restores a file with the native ticket when the JS runtime has no crypto',async () => withoutCrypto(async () => {
  jest.mocked(smbBackups.restore).mockResolvedValue(file.name);
  const view = await mount();
  await fireEvent.press(view.getByRole('button',restoreButton(file.name,'file')));
  await waitFor(() => expect(view.getByText(i18n.t('transfer.backups.restored',{ name:file.name }))).toBeTruthy());
  expect(smbBackups.restore).toHaveBeenCalledWith(expect.objectContaining({ id:fileId,kind:'file' }),ticket(1));
  await view.unmount();
}));
it('reviews a file with the native ticket when the JS runtime has no crypto',async () => withoutCrypto(async () => {
  jest.mocked(smbBackups.copy).mockResolvedValue(file.name);
  const view = await mount(true);
  expect(view.getAllByRole('button',{ name:i18n.t('destinations.review.keepBoth') })).toHaveLength(1);
  await fireEvent.press(view.getByRole('button',{ name:i18n.t('destinations.review.keepBoth') }));
  await waitFor(() => expect(view.getByText(i18n.t('destinations.smb.copied',{ name:file.name }))).toBeTruthy());
  expect(smbBackups.copy).toHaveBeenCalledWith(fileId,ticket(1));
  await waitFor(() => expect(smbBackups.list).toHaveBeenCalledTimes(2));
  await view.unmount();
}));
it('cancels a review on foreground loss with its exact ticket and ignores its late success',async () => {
  const late = pending(); jest.mocked(smbBackups.copy).mockReturnValue(late.promise);
  const view = await mount(true);
  await fireEvent.press(view.getByRole('button',{ name:i18n.t('destinations.review.keepBoth') }));
  await act(async () => { listener('background'); });
  expect(smbBackups.cancel).toHaveBeenCalledWith(ticket(1),true);
  await act(async () => { late.finish(file.name); });
  expect(view.queryByText(i18n.t('destinations.smb.copied',{ name:file.name }))).toBeNull();
  await view.unmount();
});
it('keeps the native Files picker handoff and cancels exact tickets explicitly or on unmount',async () => {
  jest.mocked(smbBackups.restore).mockImplementation(() => pending().promise);
  const view = await mount();
  await fireEvent.press(view.getByRole('button',restoreButton(file.name,'file')));
  await act(async () => { listener('background'); });
  expect(smbBackups.cancel).not.toHaveBeenCalled();
  await act(async () => { listener('active'); });
  await fireEvent.press(view.getByRole('button',{ name:i18n.t('transfer.backups.cancel') }));
  expect(smbBackups.cancel).toHaveBeenCalledWith(ticket(1),false);
  await fireEvent.press(view.getByRole('button',restoreButton(file.name,'file')));
  expect(smbBackups.restore).toHaveBeenLastCalledWith(expect.objectContaining({ id:fileId }),ticket(2));
  await view.unmount();
  expect(smbBackups.cancel).toHaveBeenLastCalledWith(ticket(2),false);
});
it('creates no ticket while busy or outside the foreground',async () => {
  jest.mocked(smbBackups.restore).mockImplementation(() => pending().promise);
  const view = await mount();
  await fireEvent.press(view.getByRole('button',restoreButton(item.name,'photo')));
  await fireEvent.press(view.getByRole('button',restoreButton(file.name,'file')));
  expect(smb.newRequest).toHaveBeenCalledTimes(1); expect(smbBackups.restore).toHaveBeenCalledTimes(1);
  await act(async () => { listener('background'); });
  await fireEvent.press(view.getByRole('button',restoreButton(item.name,'photo')));
  expect(smb.newRequest).toHaveBeenCalledTimes(1); expect(smbBackups.restore).toHaveBeenCalledTimes(1);
  await view.unmount();
});
it('shows a factory failure without a native call or stuck work and recovers on the next action',async () => {
  jest.mocked(smb.newRequest).mockImplementationOnce(() => { throw new Error('native_unsupported'); });
  jest.mocked(smbBackups.restore).mockResolvedValue(item.name);
  const view = await mount();
  await fireEvent.press(view.getByRole('button',restoreButton(item.name,'photo')));
  expect(view.getByRole('alert')).toBeTruthy();
  expect(smbBackups.restore).not.toHaveBeenCalled(); expect(smbBackups.copy).not.toHaveBeenCalled(); expect(smbBackups.cancel).not.toHaveBeenCalled();
  expect(view.queryByRole('button',{ name:i18n.t('transfer.backups.cancel') })).toBeNull();
  await fireEvent.press(view.getByRole('button',restoreButton(item.name,'photo')));
  await waitFor(() => expect(view.getByText(i18n.t('transfer.backups.restored',{ name:item.name }))).toBeTruthy());
  expect(smbBackups.restore).toHaveBeenCalledWith(expect.objectContaining({ id }),ticket(1));
  expect(view.queryByRole('alert')).toBeNull();
  await view.unmount();
});
