import { Alert, AppState, Platform, StyleSheet, type AppStateStatus } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { ActivityPage } from './activity-page';
import { fileTransfer, photoManifestPrefix } from '../../../shared/api/file-transfer';
import { pairing } from '../../../shared/api/pairing';
import { i18n } from '../../../shared/i18n';

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
  expect(StyleSheet.flatten(surface.getByText(i18n.t('transfer.backups.restored', { name: backup.name })).props.style).color).toBe('#1C1917');
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


it('shows an interrupted retained retry as paused, with its budget and no invented completion', async () => {
  jest.mocked(fileTransfer.status).mockResolvedValue({ running: false, jobs: [], totalJobs: '0', hasMore: false,
    run: { id: 'retained-run', recordId: 'AAAAAAAAAAAAAAAAAAAAAA', state: 'paused', attempts: 3,
      retryAt: '1792756860000', errorCode: 'connection_closed' } });
  const surface = await render(<ActivityPage onBack={() => undefined} />);
  await waitFor(() => expect(surface.getByText(i18n.t('transfer.runAttempt', { attempt: 3 }))).toBeTruthy());
  expect(surface.getByText(i18n.t('transfer.runStates.paused'))).toBeTruthy();
  expect(surface.queryByText(i18n.t('transfer.retryWaiting'))).toBeNull();
  expect(surface.queryByText(i18n.t('transfer.states.completed'))).toBeNull();
  await surface.unmount();
});

it('explains settings stop in each language and does not render stale work after a failed status read', async () => {
  jest.useFakeTimers();
  try {
    for (const language of ['tr', 'en', 'de']) {
      await i18n.changeLanguage(language);
      jest.mocked(fileTransfer.status).mockResolvedValue({ running: false, jobs: [], totalJobs: '0', hasMore: false,
        run: { id: 'old-context', recordId: 'AAAAAAAAAAAAAAAAAAAAAA', state: 'failed', attempts: 2, errorCode: 'settings_changed' } });
      const surface = await render(<ActivityPage onBack={() => undefined} />);
      await waitFor(() => expect(surface.getByText(i18n.t('transfer.errors.settings_changed'))).toBeTruthy());
      expect(surface.queryByText(i18n.t('transfer.runStates.finished'))).toBeNull();
      jest.mocked(fileTransfer.status).mockRejectedValue(new Error('queue_unavailable'));
      await act(async () => { jest.advanceTimersByTime(1100); });
      await waitFor(() => expect(surface.queryByText(i18n.t('transfer.errors.settings_changed'))).toBeNull());
      await surface.unmount();
    }
  } finally { await i18n.changeLanguage('tr'); jest.useRealTimers(); }
});

it('keeps valid Files controls usable when the independent Photos status query fails', async () => {
  jest.mocked(fileTransfer.status).mockResolvedValue({ running: true, jobs: [], totalJobs: '0', hasMore: false });
  jest.mocked(fileTransfer.photoStatus).mockRejectedValue(new Error('queue_unavailable'));
  jest.mocked(fileTransfer.pause).mockClear();
  try {
    const surface = await render(<ActivityPage onBack={() => undefined} />);
    await waitFor(() => expect(surface.getByText(i18n.t('transfer.errors.queue_unavailable'))).toBeTruthy());
    await fireEvent.press(surface.getByText(i18n.t('transfer.pause')));
    await waitFor(() => expect(fileTransfer.pause).toHaveBeenCalled());
    await surface.unmount();
  } finally {
    jest.mocked(fileTransfer.photoStatus).mockResolvedValue({ state: 'idle', total: '0', completed: '0', review: '0' });
  }
});


it('retains native uploads across background and page departure, then reads current state on reopen', async () => {
  let change: ((state: AppStateStatus) => void) | undefined;
  const subscription = jest.spyOn(AppState, 'addEventListener').mockImplementation((_, listener) => {
    change = listener;
    return { remove: jest.fn() };
  });
  jest.mocked(fileTransfer.pause).mockClear();
  jest.mocked(fileTransfer.cancelRestore).mockClear();
  jest.mocked(fileTransfer.status).mockResolvedValue({ running: true, jobs: [], totalJobs: '0', hasMore: false });
  try {
    const surface = await render(<ActivityPage onBack={() => undefined} />);
    await waitFor(() => expect(surface.getByText(i18n.t('transfer.pause'))).toBeTruthy());
    await act(async () => { change?.('background'); });
    expect(fileTransfer.pause).not.toHaveBeenCalled();
    await act(async () => { change?.('active'); });
    await surface.unmount();
    expect(fileTransfer.cancelRestore).toHaveBeenCalled();
    expect(fileTransfer.pause).not.toHaveBeenCalled();
    jest.mocked(fileTransfer.status).mockResolvedValue({ running: false, jobs: [], totalJobs: '0', hasMore: false,
      run: { id: 'retained-run', recordId: 'AAAAAAAAAAAAAAAAAAAAAA', attempts: 2, state: 'paused', errorCode: 'paused' } });
    const reopened = await render(<ActivityPage onBack={() => undefined} />);
    await waitFor(() => expect(reopened.getByText(i18n.t('transfer.runStates.paused'))).toBeTruthy());
    expect(reopened.queryByText(i18n.t('transfer.runStates.finished'))).toBeNull();
    await reopened.unmount();
  } finally { subscription.mockRestore(); }
});


it('pauses automatic backup while idle, preserves that choice across Sync now and reopen, and resumes only explicitly', async () => {
  const paused = { running: false, jobs: [], totalJobs: '0', hasMore: false, automaticPaused: true };
  jest.mocked(fileTransfer.status).mockResolvedValue({ ...paused, automaticPaused: false });
  jest.mocked(fileTransfer.pause).mockResolvedValue(paused);
  jest.mocked(fileTransfer.resumeAutomatic).mockClear();
  jest.mocked(fileTransfer.run).mockResolvedValue({ ...paused, running: true });
  const surface = await render(<ActivityPage onBack={() => undefined} />);
  await waitFor(() => expect(surface.getByText(i18n.t('transfer.pauseExplanation'))).toBeTruthy());
  await fireEvent.press(surface.getByText(i18n.t('transfer.pause')));
  await waitFor(() => expect(surface.getByText(i18n.t('transfer.automaticPaused'))).toBeTruthy());
  await fireEvent.press(surface.getByText(i18n.t('transfer.syncNow')));
  await waitFor(() => expect(surface.getByText(i18n.t('transfer.running'))).toBeTruthy());
  expect(fileTransfer.resumeAutomatic).not.toHaveBeenCalled();
  expect(surface.getByText(i18n.t('transfer.automaticPaused'))).toBeTruthy();
  await surface.unmount();
  jest.mocked(fileTransfer.status).mockResolvedValue(paused);
  jest.mocked(fileTransfer.resumeAutomatic).mockResolvedValue({ ...paused, automaticPaused: false });
  const reopened = await render(<ActivityPage onBack={() => undefined} />);
  await waitFor(() => expect(reopened.getByText(i18n.t('transfer.continueAutomatic'))).toBeTruthy());
  jest.mocked(fileTransfer.run).mockClear();
  await fireEvent.press(reopened.getByText(i18n.t('transfer.continueAutomatic')));
  await waitFor(() => expect(reopened.queryByText(i18n.t('transfer.automaticPaused'))).toBeNull());
  expect(fileTransfer.resumeAutomatic).toHaveBeenCalledTimes(1);
  expect(fileTransfer.run).not.toHaveBeenCalled();
  await reopened.unmount();
});

it('keeps automatic backup paused on failed Continue and shows a scheduling error without hiding file state in all languages', async () => {
  try {
    for (const language of ['tr', 'en', 'de']) {
      await i18n.changeLanguage(language);
      jest.mocked(fileTransfer.status).mockResolvedValue({ running: false, jobs: [], totalJobs: '0', hasMore: false,
        automaticPaused: true, automaticError: 'automatic_unavailable' });
      jest.mocked(fileTransfer.resumeAutomatic).mockRejectedValueOnce(new Error('storage_failure'));
      const surface = await render(<ActivityPage onBack={() => undefined} />);
      await waitFor(() => expect(surface.getByText(i18n.t('transfer.errors.automatic_unavailable'))).toBeTruthy());
      await fireEvent.press(surface.getByText(i18n.t('transfer.continueAutomatic')));
      await waitFor(() => expect(surface.getByText(i18n.t('transfer.errors.storage_failure'))).toBeTruthy());
      expect(surface.getByText(i18n.t('transfer.automaticPaused'))).toBeTruthy();
      expect(surface.getByText(i18n.t('transfer.syncNow'))).toBeTruthy();
      await surface.unmount();
    }
  } finally { await act(async () => { await i18n.changeLanguage('tr'); }); }
});


it('continues Sync now and automatic Continue after notification denial without a fake backup failure', async () => {
  let change: ((state: AppStateStatus) => void) | undefined;
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_, listener) => {
    change = listener;
    return { remove: jest.fn() };
  });
  const paused = { running: false, jobs: [], totalJobs: '0', hasMore: false,
    automaticPaused: true, notificationsEnabled: false };
  jest.mocked(fileTransfer.status).mockResolvedValue(paused);
  jest.mocked(fileTransfer.requestNotifications).mockImplementationOnce(async () => {
    change?.('inactive'); change?.('active'); return false;
  });
  jest.mocked(fileTransfer.run).mockClear();
  jest.mocked(fileTransfer.run).mockResolvedValue({ ...paused, running: true });
  const surface = await render(<ActivityPage onBack={() => undefined} />);
  await waitFor(() => expect(surface.getByText(i18n.t('transfer.notificationsDisabled'))).toBeTruthy());
  await fireEvent.press(surface.getByText(i18n.t('transfer.syncNow')));
  await waitFor(() => expect(fileTransfer.run).toHaveBeenCalledTimes(1));
  expect(surface.getByText(i18n.t('transfer.automaticPaused'))).toBeTruthy();
  expect(surface.queryByRole('alert')).toBeNull();
  jest.mocked(fileTransfer.requestNotifications).mockResolvedValueOnce(false);
  jest.mocked(fileTransfer.resumeAutomatic).mockResolvedValueOnce({ ...paused, automaticPaused: false });
  await fireEvent.press(surface.getByText(i18n.t('transfer.continueAutomatic')));
  await waitFor(() => expect(surface.queryByText(i18n.t('transfer.automaticPaused'))).toBeNull());
  expect(surface.getByText(i18n.t('transfer.notificationsDisabled'))).toBeTruthy();
  expect(surface.queryByRole('alert')).toBeNull();
  await surface.unmount();
});

it('does not start backup if the app leaves the foreground during its notification request', async () => {
  let change: ((state: AppStateStatus) => void) | undefined;
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_, listener) => {
    change = listener;
    return { remove: jest.fn() };
  });
  jest.mocked(fileTransfer.status).mockResolvedValue({ running: false, jobs: [], totalJobs: '0', hasMore: false });
  jest.mocked(fileTransfer.requestNotifications).mockImplementationOnce(async () => { change?.('background'); return false; });
  jest.mocked(fileTransfer.run).mockClear();
  const surface = await render(<ActivityPage onBack={() => undefined} />);
  await fireEvent.press(surface.getByText(i18n.t('transfer.syncNow')));
  expect(fileTransfer.run).not.toHaveBeenCalled();
  expect(surface.queryByText(i18n.t('transfer.states.completed'))).toBeNull();
  await surface.unmount();
});

it('separately shows OS attempts and an unresolved automatic result in all three languages', async () => {
  try {
    for (const language of ['tr', 'en', 'de']) {
      await i18n.changeLanguage(language);
      jest.mocked(fileTransfer.status).mockResolvedValue({ running: false, jobs: [], totalJobs: '0', hasMore: false,
        automaticRun: { attempts: 5, state: 'exhausted', updated: 0, errorCode: 'os_interrupted' } });
      const surface = await render(<ActivityPage onBack={() => undefined} />);
      await waitFor(() => expect(surface.getByText(i18n.t('transfer.osAttempt', { attempt: 5 }))).toBeTruthy());
      expect(surface.getByText(i18n.t('transfer.osStates.exhausted'))).toBeTruthy();
      expect(surface.queryByText(i18n.t('transfer.states.completed'))).toBeNull();
      await surface.unmount();
    }
  } finally { await i18n.changeLanguage('tr'); }
});

it('shows real Photos import state alongside iOS Files', async () => {
  jest.replaceProperty(Platform, 'OS', 'ios');
  jest.mocked(fileTransfer.status).mockResolvedValue({ running: false, jobs: [], totalJobs: '0', hasMore: false });
  jest.mocked(fileTransfer.photoStatus).mockClear();
  const surface = await render(<ActivityPage onBack={() => undefined} />);
  await waitFor(() => expect(surface.getByText(i18n.t('transfer.syncNow'))).toBeTruthy());
  expect(fileTransfer.photoStatus).toHaveBeenCalled();
  await surface.unmount();
});

it.each(['tr', 'en', 'de'])('routes iOS Photos actions to the native import flow and preserves review in %s', async (language) => {
  jest.replaceProperty(Platform, 'OS', 'ios');
  const backup = { id: 'AAAAAAAAAAAAAAAAAAAAAA', name: `${photoManifestPrefix}fixture.json`, sha256: 'A'.repeat(43), size: '300' };
  const review = { state: 'review_required' as const, total: '1', completed: '0', review: '1' };
  jest.mocked(fileTransfer.status).mockResolvedValue({ running: false, jobs: [], totalJobs: '0', hasMore: false });
  jest.mocked(fileTransfer.list).mockResolvedValue({ items: [backup], hasMore: false });
  jest.mocked(fileTransfer.restorePhotos).mockClear().mockResolvedValue(review);
  jest.mocked(fileTransfer.restore).mockClear();
  await i18n.changeLanguage(language);
  try {
    const surface = await render(<ActivityPage onBack={() => undefined} />);
    await fireEvent.press(surface.getByText(i18n.t('transfer.backups.load')));
    await waitFor(() => expect(surface.getByText(backup.name)).toBeTruthy());
    await fireEvent.press(surface.getByText(i18n.t('transfer.photos.restore')));
    await waitFor(() => expect(surface.getByText(i18n.t('transfer.photos.review_required', review))).toBeTruthy());
    expect(fileTransfer.restorePhotos).toHaveBeenCalledWith('AAAAAAAAAAAAAAAAAAAAAA', backup);
    expect(fileTransfer.restore).not.toHaveBeenCalled();
    expect(surface.queryByText(i18n.t('transfer.photos.completed', review))).toBeNull();
    await fireEvent.press(surface.getByText(i18n.t('transfer.photos.restoreAll')));
    await waitFor(() => expect(fileTransfer.restorePhotos).toHaveBeenCalledWith('AAAAAAAAAAAAAAAAAAAAAA'));
    await surface.unmount();
  } finally { await i18n.changeLanguage('tr'); }
});
