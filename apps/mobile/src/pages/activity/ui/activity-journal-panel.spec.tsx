import { AppState, Platform, type AppStateStatus } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { ActivityPage } from './activity-page';
import { fileTransfer, type FileJob, type FileQueue } from '../../../shared/api/file-transfer';
import { ftps } from '../../../shared/api/ftps';
import { i18n } from '../../../shared/i18n';
import tr from '../../../shared/i18n/locales/tr.json';
import en from '../../../shared/i18n/locales/en.json';
import de from '../../../shared/i18n/locales/de.json';

jest.mock('../../../shared/api/backup-destinations', () => ({ backupDestinations: { status: jest.fn().mockResolvedValue({ configured: false, enabled: false, running: false }), pcSelected: jest.fn().mockResolvedValue(true), pcEnabled: jest.fn().mockResolvedValue(true), run: jest.fn() } }));
jest.mock('../../../shared/api/file-transfer', () => ({ photoManifestPrefix: 'kloda-photo-v1-', fileTransfer: {
  requestNotifications: jest.fn().mockResolvedValue(true), status: jest.fn(), run: jest.fn(), rebackup: jest.fn(), pause: jest.fn(),
  resumeAutomatic: jest.fn(), list: jest.fn(), restore: jest.fn(), cancelRestore: jest.fn().mockResolvedValue(true),
  photoStatus: jest.fn().mockResolvedValue({ state: 'idle', total: '0', completed: '0', review: '0' }), restorePhotos: jest.fn(),
} }));
jest.mock('../../../shared/api/pairing', () => ({ pairing: { status: jest.fn().mockResolvedValue({
  phase: 'complete', recordId: 'AAAAAAAAAAAAAAAAAAAAAA', peerFingerprint: 'isolated-public-fixture',
}) } }));

const job = (id: string, state: FileJob['state'], acknowledgedBytes = state === 'completed' ? '4' : '0'): FileJob => ({
  id, sourceId: `source-${id}`, recordId: 'AAAAAAAAAAAAAAAAAAAAAA', name: `${id}.bin`, state, acknowledgedBytes, totalBytes: '4' });
const queueOf = (jobs: FileJob[], extra: Partial<FileQueue> = {}): FileQueue => ({ running: false, jobs, totalJobs: String(jobs.length), hasMore: false, ...extra });
const mixed = queueOf([job('j-queued', 'queued'), job('j-done-b', 'completed'), job('j-paused', 'paused'), job('j-uploading', 'uploading'),
  job('j-blocked', 'blocked'), job('j-done-a', 'completed'), job('j-deleted', 'owner_deleted')]);
const actions = () => [fileTransfer.run, fileTransfer.rebackup, fileTransfer.pause, fileTransfer.resumeAutomatic, fileTransfer.list,
  fileTransfer.restore, fileTransfer.cancelRestore, fileTransfer.restorePhotos].map((call) => jest.mocked(call).mock.calls.length);
type Surface = Awaited<ReturnType<typeof render>>;
const names = (surface: Surface) => surface.queryAllByText(/^j-.*\.bin$/).map((node) => node.props.children as string);
const tab = (surface: Surface, key: 'now' | 'past') => surface.getByRole('tab', { name: i18n.t(`transfer.journal.${key}`) });
// M11: History filter is a header dropdown — trigger shows the current choice, the menu lists radio items.
const trigger = (surface: Surface) => surface.getByHintText(i18n.t('transfer.journal.filters'));
const option = (surface: Surface, key: 'All' | 'Done' | 'Issues') => surface.getByRole('menuitem', { name: i18n.t(`transfer.journal.filter${key}`) });
const menu = (surface: Surface) => surface.queryByLabelText(i18n.t('transfer.journal.filters'));
const filter = async (surface: Surface, key: 'All' | 'Done' | 'Issues') => { await fireEvent.press(trigger(surface)); await fireEvent.press(option(surface, key)); };
let listeners: ((state: AppStateStatus) => void)[] = [];
const change = (state: AppStateStatus) => listeners.forEach((listener) => listener(state));

beforeEach(() => {
  jest.replaceProperty(Platform, 'OS', 'android');
  listeners = [];
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_, listener) => {
    listeners.push(listener);
    return { remove: jest.fn(() => { listeners = listeners.filter((item) => item !== listener); }) };
  });
});
afterEach(() => { jest.restoreAllMocks(); });

it('G1-01 separates Now and History sets from one native snapshot without extra native work or reordering', async () => {
  jest.mocked(fileTransfer.status).mockResolvedValue(mixed);
  const ftpsStatus = jest.spyOn(ftps, 'status');
  const surface = await render(<ActivityPage onBack={() => undefined} />);
  await waitFor(() => expect(names(surface)).toEqual(['j-queued.bin', 'j-paused.bin', 'j-uploading.bin', 'j-blocked.bin', 'j-deleted.bin']));
  expect(tab(surface, 'now').props.accessibilityState).toEqual({ selected: true });
  const before = actions(), reads = jest.mocked(fileTransfer.status).mock.calls.length, mounts = ftpsStatus.mock.calls.length;
  await fireEvent.press(tab(surface, 'past'));
  expect(tab(surface, 'past').props.accessibilityState).toEqual({ selected: true });
  expect(names(surface)).toEqual(['j-done-b.bin', 'j-paused.bin', 'j-blocked.bin', 'j-done-a.bin', 'j-deleted.bin']);
  await filter(surface, 'Done');
  expect(names(surface)).toEqual(['j-done-b.bin', 'j-done-a.bin']);
  await filter(surface, 'Issues');
  expect(names(surface)).toEqual(['j-paused.bin', 'j-blocked.bin', 'j-deleted.bin']);
  expect(surface.queryByText(i18n.t('transfer.rebackup'))).toBeNull();
  await fireEvent.press(tab(surface, 'now'));
  expect(names(surface)).toEqual(['j-queued.bin', 'j-paused.bin', 'j-uploading.bin', 'j-blocked.bin', 'j-deleted.bin']);
  expect(actions()).toEqual(before);
  expect(jest.mocked(fileTransfer.status).mock.calls.length).toBe(reads);
  expect(ftpsStatus.mock.calls.length).toBe(mounts);
  await surface.unmount();
});

it('G1-R1 keeps the M11 History filter as a header dropdown, absent in Now and without native work', async () => {
  jest.mocked(fileTransfer.status).mockResolvedValue(mixed);
  const surface = await render(<ActivityPage onBack={() => undefined} />);
  await waitFor(() => expect(names(surface)).toHaveLength(5));
  expect(surface.queryByHintText(i18n.t('transfer.journal.filters'))).toBeNull();
  await fireEvent.press(tab(surface, 'past'));
  const before = actions(), reads = jest.mocked(fileTransfer.status).mock.calls.length;
  expect(surface.queryByRole('radio')).toBeNull();
  expect(menu(surface)).toBeNull();
  expect(trigger(surface).props.accessibilityState).toEqual({ expanded: false });
  await fireEvent.press(trigger(surface));
  expect(trigger(surface).props.accessibilityState).toEqual({ expanded: true });
  expect(menu(surface)?.props.accessibilityRole).toBe('menu');
  expect(option(surface, 'All').props.accessibilityState).toEqual({ checked: true });
  expect(option(surface, 'Done').props.accessibilityState).toEqual({ checked: false });
  await fireEvent.press(option(surface, 'Done'));
  expect(menu(surface)).toBeNull();
  expect(trigger(surface).props.accessibilityLabel).toBe(i18n.t('transfer.journal.filterDone'));
  expect(names(surface)).toEqual(['j-done-b.bin', 'j-done-a.bin']);
  await fireEvent.press(trigger(surface));
  expect(option(surface, 'Done').props.accessibilityState).toEqual({ checked: true });
  await fireEvent.press(trigger(surface));
  expect(menu(surface)).toBeNull();
  expect(names(surface)).toEqual(['j-done-b.bin', 'j-done-a.bin']);
  await fireEvent.press(tab(surface, 'now'));
  expect(surface.queryByHintText(i18n.t('transfer.journal.filters'))).toBeNull();
  expect(actions()).toEqual(before);
  expect(jest.mocked(fileTransfer.status).mock.calls.length).toBe(reads);
  await surface.unmount();
});

it('G1-02 lists only native completed as History success; full ACK and finalizing stay out of Completed', async () => {
  jest.mocked(fileTransfer.status).mockResolvedValue(queueOf([job('j-file', 'uploading', '4')], { running: true }));
  const surface = await render(<ActivityPage onBack={() => undefined} />);
  await waitFor(() => expect(names(surface)).toEqual(['j-file.bin']));
  await fireEvent.press(tab(surface, 'past'));
  await filter(surface, 'Done');
  expect(names(surface)).toEqual([]);
  jest.mocked(fileTransfer.status).mockResolvedValue(queueOf([job('j-file', 'finalizing', '4')], { running: true }));
  await waitFor(() => expect(surface.getByText(i18n.t('transfer.states.finalizing'), { includeHiddenElements: true })).toBeTruthy(), { timeout: 3000 });
  expect(names(surface)).toEqual([]);
  expect(surface.getByText(i18n.t('transfer.journal.empty'))).toBeTruthy();
  jest.mocked(fileTransfer.status).mockResolvedValue(queueOf([job('j-file', 'completed')]));
  await waitFor(() => expect(names(surface)).toEqual(['j-file.bin']), { timeout: 3000 });
  expect(surface.getByText(i18n.t('transfer.states.completed'))).toBeTruthy();
  await surface.unmount();
});

it('G1-03 marks a truncated window as limited instead of claiming an empty History', async () => {
  const window = Array.from({ length: 100 }, (_, index) => job(`j-${index}`, 'queued'));
  jest.mocked(fileTransfer.status).mockResolvedValue(queueOf(window, { totalJobs: '101', hasMore: true }));
  const surface = await render(<ActivityPage onBack={() => undefined} />);
  await waitFor(() => expect(names(surface)).toHaveLength(100));
  await fireEvent.press(tab(surface, 'past'));
  for (const key of ['All', 'Done', 'Issues'] as const) {
    await filter(surface, key);
    expect(names(surface)).toEqual([]);
    expect(surface.getByText(i18n.t('transfer.journal.emptyLimited'))).toBeTruthy();
    expect(surface.getByText(i18n.t('transfer.journal.limited', { shown: 100, count: '101' }))).toBeTruthy();
    expect(surface.queryByText(i18n.t('transfer.journal.empty'))).toBeNull();
  }
  await surface.unmount();
  jest.mocked(fileTransfer.status).mockResolvedValue(queueOf([job('j-only', 'queued')]));
  const complete = await render(<ActivityPage onBack={() => undefined} />);
  await waitFor(() => expect(names(complete)).toEqual(['j-only.bin']));
  await fireEvent.press(tab(complete, 'past'));
  expect(complete.getByText(i18n.t('transfer.journal.empty'))).toBeTruthy();
  expect(complete.queryByText(i18n.t('transfer.journal.emptyLimited'))).toBeNull();
  expect(complete.queryByText(/101/)).toBeNull();
  await complete.unmount();
});

it('G1-04 keeps loading, read errors and late background responses from looking like an empty or completed History', async () => {
  let resolve: (value: FileQueue) => void = () => undefined;
  jest.mocked(fileTransfer.status).mockImplementationOnce(() => new Promise((done) => { resolve = done; }));
  jest.mocked(fileTransfer.status).mockRejectedValue(new Error('queue_unavailable'));
  const surface = await render(<ActivityPage onBack={() => undefined} />);
  await fireEvent.press(tab(surface, 'past'));
  expect(surface.getByText(i18n.t('pairing.loading'))).toBeTruthy();
  expect(surface.queryByText(i18n.t('transfer.journal.empty'))).toBeNull();
  await act(async () => { change('background'); });
  await act(async () => { resolve(queueOf([job('j-late', 'completed')])); });
  expect(names(surface)).toEqual([]);
  expect(surface.getByText(i18n.t('pairing.loading'))).toBeTruthy();
  await act(async () => { change('active'); });
  await waitFor(() => expect(surface.getByRole('alert').props.children).toBe(i18n.t('transfer.errors.queue_unavailable')));
  expect(surface.queryByText(i18n.t('transfer.journal.empty'))).toBeNull();
  expect(names(surface)).toEqual([]);
  jest.mocked(fileTransfer.status).mockResolvedValue(queueOf([job('j-current', 'completed')]));
  await waitFor(() => expect(names(surface)).toEqual(['j-current.bin']), { timeout: 3000 });
  expect(fileTransfer.pause).not.toHaveBeenCalled();
  await surface.unmount();
});

it('G1-05/G1-07 keeps Now mounted but hidden from accessibility in History; departure keeps the existing cleanup', async () => {
  jest.mocked(fileTransfer.status).mockResolvedValue(queueOf([job('j-up', 'uploading', '2')], { running: true }));
  jest.mocked(fileTransfer.cancelRestore).mockClear();
  const surface = await render(<ActivityPage onBack={() => undefined} />);
  await waitFor(() => expect(surface.getByText(i18n.t('transfer.pause'))).toBeTruthy());
  await fireEvent.press(tab(surface, 'past'));
  expect(surface.queryByText(i18n.t('transfer.description'))).toBeNull();
  expect(surface.getByText(i18n.t('transfer.description'), { includeHiddenElements: true })).toBeTruthy();
  expect(surface.queryByText(i18n.t('transfer.syncNow'))).toBeNull();
  expect(surface.queryByRole('progressbar')).toBeNull();
  await act(async () => { change('background'); change('active'); });
  expect(fileTransfer.pause).not.toHaveBeenCalled();
  expect(fileTransfer.cancelRestore).not.toHaveBeenCalled();
  await fireEvent.press(tab(surface, 'now'));
  expect(surface.getByRole('progressbar').props.accessibilityValue.now).toBe(50);
  await surface.unmount();
  expect(fileTransfer.cancelRestore).toHaveBeenCalledTimes(1);
  expect(fileTransfer.pause).not.toHaveBeenCalled();
});

it('G1-06 adds no segment or History to the Backups view', async () => {
  jest.mocked(fileTransfer.status).mockResolvedValue(mixed);
  const surface = await render(<ActivityPage onBack={() => undefined} view="backups" embedded />);
  await waitFor(() => expect(fileTransfer.status).toHaveBeenCalled());
  expect(surface.queryByLabelText(i18n.t('transfer.journal.segments'))).toBeNull();
  expect(surface.queryByRole('tab')).toBeNull();
  expect(surface.queryByText(i18n.t('transfer.journal.scope'))).toBeNull();
  expect(names(surface)).toEqual([]);
  await surface.unmount();
});

it.each(['tr', 'en', 'de'])('G1-07 shows accessible segments, filters and the bounded scope in %s without demo dates', async (language) => {
  jest.mocked(fileTransfer.status).mockResolvedValue(mixed);
  await i18n.changeLanguage(language);
  try {
    const surface = await render(<ActivityPage onBack={() => undefined} />);
    await waitFor(() => expect(names(surface)).toHaveLength(5));
    // Group containers are not focusable themselves (like the app tab bar), so their role is read from the labelled host.
    expect(surface.getByLabelText(i18n.t('transfer.journal.segments')).props.accessibilityRole).toBe('tablist');
    await fireEvent.press(tab(surface, 'past'));
    expect(trigger(surface).props.accessibilityLabel).toBe(i18n.t('transfer.journal.filterAll'));
    expect(surface.getByText(i18n.t('transfer.journal.scope'))).toBeTruthy();
    expect(surface.queryByText(/\d{1,2}:\d{2}/)).toBeNull();
    await surface.unmount();
  } finally { await i18n.changeLanguage('tr'); }
});

it('G1-07 defines the same History keys in every language', () => {
  const keys = (value: { transfer: { journal: Record<string, string> } }) => Object.keys(value.transfer.journal).sort();
  expect(keys(tr)).toEqual(keys(en));
  expect(keys(de)).toEqual(keys(en));
  for (const value of [tr, en, de]) expect(Object.values(value.transfer.journal).every((text) => text.trim().length > 0)).toBe(true);
});
