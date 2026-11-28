import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { nativeRuntime, restoreNativeRuntime } from './native-runtime.fixture';
import { App } from './App';
import { i18n } from '../shared/i18n';

jest.mock('../shared/model/intro-storage', () => ({
  loadIntroSeen: jest.fn().mockResolvedValue(true),
  saveIntroSeen: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../shared/api/webdav-settings', () => ({
  loadWebDavSettings: jest.fn().mockResolvedValue(null),
  testAndSaveWebDavSettings: jest.fn(),
}));

describe('App navigation stack', () => {
  afterAll(restoreNativeRuntime);
  beforeEach(() => { jest.clearAllMocks(); });

  it('pops through real navigation history on Back instead of jumping straight to home', async () => {
    void nativeRuntime;
    const surface = await render(<App />);
    await fireEvent.press(surface.getByText(i18n.t('ui.common.skip')));
    await fireEvent.press(surface.getByRole('tab', { name: i18n.t('statusUi.targets') }));
    await fireEvent.press(surface.getByText(i18n.t('ui.conn.add')));
    await fireEvent.press(surface.getByRole('button', { name: i18n.t('ui.providers.smb') }));
    await waitFor(() => expect(surface.getByText(i18n.t('ui.common.back'))).toBeTruthy());
    await fireEvent.press(surface.getByText(i18n.t('ui.common.back')));
    await waitFor(() => expect(surface.getByText(i18n.t('ui.conn.clouds'))).toBeTruthy());
    await fireEvent.press(surface.getByText(i18n.t('ui.common.back')));
    await waitFor(() => expect(surface.getByText(i18n.t('ui.conn.computers'))).toBeTruthy());
    await surface.unmount();
  });
});
