import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { Platform } from 'react-native';
import { nativeRuntime, restoreNativeRuntime } from './native-runtime.fixture';
import { App } from './App';
import { saveWebDavCredentials, testWebDavWriteAccess } from '../shared/api/webdav';
import { i18n } from '../shared/i18n';

jest.mock('../shared/api/webdav', () => ({
  saveWebDavCredentials: jest.fn().mockResolvedValue(undefined),
  testWebDavWriteAccess: jest.fn().mockResolvedValue(undefined),
}));


describe('App', () => {
  afterAll(restoreNativeRuntime);
  beforeEach(() => { jest.clearAllMocks(); });
  afterEach(() => { jest.restoreAllMocks(); });

  it('discards a successful stale probe before saving credentials and permits only a fresh form result', async () => {
    nativeRuntime.loadDirectorySources.mockResolvedValueOnce([{ id: 'source-1', kind: 'directory', displayName: 'Documents' }]);
    let finishProbe!: () => void;
    const oldProbe = new Promise<void>((resolve) => { finishProbe = resolve; });
    jest.mocked(testWebDavWriteAccess).mockReturnValueOnce(oldProbe);
    const { getByText, getByLabelText, queryAllByText } = await render(<App />);
    await waitFor(() => expect(getByText('Documents')).toBeTruthy());
    await fireEvent.press(getByText(i18n.t('onboarding.saveSchedule')));
    await waitFor(() => expect(getByLabelText(i18n.t('onboarding.endpoint'))).toBeTruthy());
    await fireEvent.changeText(getByLabelText(i18n.t('onboarding.endpoint')), 'https://fixture.example');
    await fireEvent.press(getByText(i18n.t('onboarding.testConnection')));
    await waitFor(() => expect(testWebDavWriteAccess).toHaveBeenCalledTimes(1));
    await fireEvent.changeText(getByLabelText(i18n.t('onboarding.password')), 'public-fixture-password');
    await act(async () => { finishProbe(); await oldProbe; });
    expect(saveWebDavCredentials).not.toHaveBeenCalled();
    expect(nativeRuntime.saveStorageConfig).not.toHaveBeenCalled();
    expect(queryAllByText(i18n.t('onboarding.storageTested'))).toHaveLength(0);
    await fireEvent.press(getByText(i18n.t('onboarding.testConnection')));
    await waitFor(() => expect(queryAllByText(i18n.t('onboarding.storageTested'))).not.toHaveLength(0));
    await fireEvent.changeText(getByLabelText(i18n.t('onboarding.targetPath')), 'changed');
    expect(queryAllByText(i18n.t('onboarding.storageTested'))).toHaveLength(0);
  });

  it('lets the user choose the 24-hour automatic schedule', async () => {
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
    await waitFor(() => expect(getByRole('button', { name: i18n.t('onboarding.removeSource', { name: 'Camera' }).toUpperCase() })).toBeTruthy());
    await fireEvent.press(getByRole('button', { name: i18n.t('onboarding.removeSource', { name: 'Photos' }).toUpperCase() }));
    await waitFor(() => expect(queryByText('Photos')).toBeNull());
  });

  it('does not treat denied or limited Photos access as a selected library', async () => {
    const { getByText, queryByText } = await render(<App />);
    await fireEvent.press(getByText(i18n.t('onboarding.choosePhotoLibrary')));
    await waitFor(() => expect(getByText(i18n.t('onboarding.sourceUnavailable'))).toBeTruthy());
    expect(queryByText(i18n.t('onboarding.sourcesSelected'))).toBeNull();
  });
});
