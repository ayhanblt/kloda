import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { Platform } from 'react-native';
import { nativeRuntime, restoreNativeRuntime } from './native-runtime.fixture';
import { App } from './App';
import { loadWebDavSettings, testAndSaveWebDavSettings } from '../shared/api/webdav-settings';
import { i18n } from '../shared/i18n';

jest.mock('../shared/api/webdav-settings', () => ({
  loadWebDavSettings: jest.fn().mockResolvedValue(null),
  testAndSaveWebDavSettings: jest.fn().mockResolvedValue(undefined),
}));


describe('App', () => {
  afterAll(restoreNativeRuntime);
  beforeEach(() => { jest.clearAllMocks(); });
  afterEach(() => { jest.restoreAllMocks(); });

  it('discards a successful stale probe before saving credentials and permits only a fresh form result', async () => {
    nativeRuntime.loadDirectorySources.mockResolvedValueOnce([{ id: 'source-1', kind: 'directory', displayName: 'Documents' }]);
    let finishProbe!: () => void;
    const oldProbe = new Promise<Awaited<ReturnType<typeof testAndSaveWebDavSettings>>>((resolve) => { finishProbe = () => resolve({ config: { endpoint: 'https://fixture.example', targetPath: 'Kloda', username: 'fixture' }, testedAt: null }); });
    jest.mocked(testAndSaveWebDavSettings).mockReturnValueOnce(oldProbe);
    const { getByText, getByLabelText, queryAllByText } = await render(<App />);
    await waitFor(() => expect(getByText('Documents')).toBeTruthy());
    await fireEvent.press(getByText(i18n.t('onboarding.saveSchedule')));
    await fireEvent.press(getByText(i18n.t('computer.advanced')));
    await waitFor(() => expect(getByLabelText(i18n.t('onboarding.endpoint'))).toBeTruthy());
    await fireEvent.changeText(getByLabelText(i18n.t('onboarding.endpoint')), 'https://fixture.example');
    await fireEvent.press(getByText(i18n.t('onboarding.testConnection')));
    await waitFor(() => expect(testAndSaveWebDavSettings).toHaveBeenCalledTimes(1));
    await fireEvent.changeText(getByLabelText(i18n.t('onboarding.password')), 'public-fixture-password');
    await act(async () => { finishProbe(); await oldProbe; });
    expect(nativeRuntime.saveStorageConfig).not.toHaveBeenCalled();
    expect(queryAllByText(i18n.t('onboarding.storageTested'))).toHaveLength(0);
    await fireEvent.press(getByText(i18n.t('onboarding.testConnection')));
    await waitFor(() => expect(queryAllByText(i18n.t('onboarding.storageTested'))).not.toHaveLength(0));
    await fireEvent.changeText(getByLabelText(i18n.t('onboarding.targetPath')), 'changed');
    expect(queryAllByText(i18n.t('onboarding.storageTested'))).toHaveLength(0);
  });

  it('loads only the saved profile metadata and labels its test as past evidence, never current PC success', async () => {
    nativeRuntime.loadDirectorySources.mockResolvedValueOnce([{ id: 'source-1', kind: 'directory', displayName: 'Documents' }]);
    jest.mocked(loadWebDavSettings).mockResolvedValueOnce({ config: { endpoint: 'https://fixture.example', targetPath: 'saved', username: 'fixture' }, testedAt: '2026-10-28T00:00:00.000Z', probeWarning: true });
    const surface = await render(<App />);
    await waitFor(() => expect(surface.getByText('Documents')).toBeTruthy());
    await fireEvent.press(surface.getByText(i18n.t('onboarding.saveSchedule')));
    await fireEvent.press(surface.getByText(i18n.t('computer.advanced')));
    await waitFor(() => expect(surface.getByLabelText(i18n.t('onboarding.targetPath')).props.value).toBe('saved'));
    expect(surface.getByLabelText(i18n.t('onboarding.password')).props.value).toBe('');
    expect(surface.getByText(i18n.t('onboarding.storageTested'))).toBeTruthy();
    expect(surface.getByText(i18n.t('onboarding.webdavScope'))).toBeTruthy();
    expect(surface.getByText(i18n.t('onboarding.webdavErrors.webdav_probe_incomplete'))).toBeTruthy();
    await surface.unmount();
  });

  it.each(['tr', 'en', 'de'])('keeps uncertain probe warnings after editing cancels a stale test in %s', async (language) => {
    await i18n.changeLanguage(language);
    try {
      nativeRuntime.loadDirectorySources.mockResolvedValueOnce([{ id: 'source-1', kind: 'directory', displayName: 'Documents' }]);
      let cancel!: () => void;
      const probe = new Promise<Awaited<ReturnType<typeof testAndSaveWebDavSettings>>>((_, reject) => { cancel = () => reject(new Error('webdav_cancelled_probe')); });
      jest.mocked(testAndSaveWebDavSettings).mockReturnValueOnce(probe);
      const surface = await render(<App />);
      await waitFor(() => expect(surface.getByText('Documents')).toBeTruthy());
      await fireEvent.press(surface.getByText(i18n.t('onboarding.saveSchedule')));
      await fireEvent.press(surface.getByText(i18n.t('computer.advanced')));
      await fireEvent.press(surface.getByText(i18n.t('onboarding.testConnection')));
      await fireEvent.changeText(surface.getByLabelText(i18n.t('onboarding.targetPath')), 'new-draft');
      await act(async () => { cancel(); await probe.catch(() => undefined); });
      await waitFor(() => expect(surface.getByText(i18n.t('onboarding.webdavErrors.webdav_probe_incomplete'))).toBeTruthy());
      expect(surface.queryByText(i18n.t('onboarding.storageTested'))).toBeNull();
      await fireEvent.press(surface.getByText(i18n.t('onboarding.testConnection')));
      await waitFor(() => expect(surface.getByText(i18n.t('onboarding.storageTested'))).toBeTruthy());
      expect(surface.getByText(i18n.t('onboarding.webdavErrors.webdav_probe_incomplete'))).toBeTruthy();
      await surface.unmount();
    } finally { await i18n.changeLanguage('tr'); }
  });

  it('lets the user save a 24-hour preference without claiming scheduling is active', async () => {
    const { getByText } = await render(<App />);

    await fireEvent.press(getByText(i18n.t('onboarding.everyHours', { hours: 24 })));

    await waitFor(() => expect(getByText(i18n.t('onboarding.everyHoursSelected', { hours: 24 }))).toBeTruthy());
  });

  it('blocks storage setup until a source is selected', async () => {
    const { getByText } = await render(<App />);

    await fireEvent.press(getByText(i18n.t('onboarding.saveSchedule')));

    await waitFor(() => expect(getByText(i18n.t('onboarding.sourceRequired'))).toBeTruthy());
  });

  it('loads persisted Photos and selects an album through actual native capabilities on Android', async () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    const library = { id: 'photos', kind: 'photos', displayName: 'Photos', reference: 'photos:library' };
    const album = { id: 'album', kind: 'photos', displayName: 'Camera', reference: 'photos:album:external_primary:DCIM%2FCamera%2F' };
    nativeRuntime.loadPhotoSources.mockResolvedValueOnce([library]);
    nativeRuntime.loadPhotoAlbums.mockResolvedValueOnce([{ id: 'native-album', displayName: 'Camera' }]);
    nativeRuntime.selectPhotoAlbum.mockResolvedValueOnce(album);
    const { getByText, getByRole, queryByText } = await render(<App />);
    await waitFor(() => expect(getByText('Photos')).toBeTruthy());
    await fireEvent.press(getByRole('button', { name: new RegExp(i18n.t('onboarding.choosePhotoAlbum'), 'i') }));
    await waitFor(() => expect(getByRole('button', { name: /^Camera$/i })).toBeTruthy());
    await fireEvent.press(getByRole('button', { name: /^Camera$/i }));
    await waitFor(() => expect(getByRole('button', { name: i18n.t('onboarding.removeSource', { name: 'Camera' }) })).toBeTruthy());
    await fireEvent.press(getByRole('button', { name: i18n.t('onboarding.removeSource', { name: 'Photos' }) }));
    await waitFor(() => expect(queryByText('Photos')).toBeNull());
  });

  it('does not treat denied or limited Photos access as a selected library', async () => {
    const { getByText, queryByText } = await render(<App />);
    await fireEvent.press(getByText(i18n.t('onboarding.choosePhotoLibrary')));
    await waitFor(() => expect(getByText(i18n.t('onboarding.sourceUnavailable'))).toBeTruthy());
    expect(queryByText(i18n.t('onboarding.sourcesSelected'))).toBeNull();
  });
  it('continues source setup to the PC flow without requiring WebDAV credentials', async () => {
    nativeRuntime.loadDirectorySources.mockResolvedValueOnce([{ id: 'source-1', kind: 'directory', displayName: 'Documents' }]);
    const surface = await render(<App />);
    await waitFor(() => expect(surface.getByText('Documents')).toBeTruthy());
    await fireEvent.press(surface.getByText(i18n.t('onboarding.saveSchedule')));
    await waitFor(() => expect(surface.getByText(i18n.t('computer.title'))).toBeTruthy());
    expect(surface.getByText(i18n.t('computer.grantDescription'))).toBeTruthy();
    expect(surface.queryByLabelText(i18n.t('onboarding.password'))).toBeNull();
    expect(nativeRuntime.saveStorageConfig).not.toHaveBeenCalled();
    await surface.unmount();
  });

  it('retains setup when saving preferences fails', async () => {
    nativeRuntime.loadDirectorySources.mockResolvedValueOnce([{ id: 'source-1', kind: 'directory', displayName: 'Documents' }]);
    nativeRuntime.saveSchedule.mockRejectedValueOnce(new Error('fixture_storage_failure'));
    const surface = await render(<App />);
    await waitFor(() => expect(surface.getByText('Documents')).toBeTruthy());
    await fireEvent.press(surface.getByText(i18n.t('onboarding.saveSchedule')));
    await waitFor(() => expect(surface.getByText(i18n.t('onboarding.saveError'))).toBeTruthy());
    expect(surface.queryByText(i18n.t('computer.title'))).toBeNull();
    await surface.unmount();
  });

  it('uses the native Live default and saves it without changing the retained scheduled time', async () => {
    nativeRuntime.loadSchedule.mockResolvedValueOnce({ backupMode: 'live', intervalHours: 24, localTime: '23:45' });
    nativeRuntime.loadDirectorySources.mockResolvedValueOnce([{ id: 'source-1', kind: 'directory', displayName: 'Documents' }]);
    const surface = await render(<App />);
    await waitFor(() => expect(surface.getByText(i18n.t('onboarding.liveSelected'))).toBeTruthy());
    expect(surface.queryByLabelText(i18n.t('onboarding.localStartTime'))).toBeNull();
    await fireEvent.press(surface.getByText(i18n.t('onboarding.saveSchedule')));
    await waitFor(() => expect(nativeRuntime.saveLiveSchedule).toHaveBeenCalledTimes(1));
    expect(nativeRuntime.saveSchedule).not.toHaveBeenCalled();
    await surface.unmount();
  });

  it('preserves legacy scheduled preferences and switches from Live to an explicit scheduled choice', async () => {
    nativeRuntime.loadSchedule.mockResolvedValueOnce({ intervalHours: 24, localTime: '06:35' });
    nativeRuntime.loadDirectorySources.mockResolvedValueOnce([{ id: 'source-1', kind: 'directory', displayName: 'Documents' }]);
    const surface = await render(<App />);
    await waitFor(() => expect(surface.getByText(i18n.t('onboarding.everyHoursSelected', { hours: 24 }))).toBeTruthy());
    expect(surface.getByLabelText(i18n.t('onboarding.localStartTime')).props.value).toBe('06:35');
    await fireEvent.press(surface.getByText(i18n.t('onboarding.live')));
    await fireEvent.press(surface.getByText(i18n.t('onboarding.everyHours', { hours: 12 })));
    await fireEvent.press(surface.getByText(i18n.t('onboarding.saveSchedule')));
    await waitFor(() => expect(nativeRuntime.saveSchedule).toHaveBeenCalledWith(12, '06:35'));
    expect(nativeRuntime.saveLiveSchedule).not.toHaveBeenCalled();
    await surface.unmount();
  });

});
