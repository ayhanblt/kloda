import { act, fireEvent, render, screen } from '@testing-library/react-native';
import '../../../shared/i18n';
import i18n from 'i18next';
import { SettingsPage } from './settings-page';
import { ThemeProvider } from '../../../shared/theme/theme-provider';
import { gallery } from '../../../shared/api/gallery';
import { fileTransfer } from '../../../shared/api/file-transfer';
import { configuredAppVersion, parseConfiguredVersion } from '../../../shared/config/app-version';

jest.mock('expo-secure-store', () => ({ getItemAsync: jest.fn(async () => null), setItemAsync: jest.fn(async () => undefined) }));
jest.mock('nativewind', () => ({ ...jest.requireActual('nativewind'), useColorScheme: () => ({ setColorScheme: jest.fn() }) }));
jest.mock('../../../shared/api/gallery');
jest.mock('../../../shared/api/file-transfer');
jest.mock('../../../shared/config/app-version', () => {
  const actual = jest.requireActual('../../../shared/config/app-version');
  return { ...actual, configuredAppVersion: jest.fn(actual.configuredAppVersion) };
});

const actualVersion = jest.requireActual('../../../shared/config/app-version').configuredAppVersion as () => string | null;
const t = (key: string) => i18n.t(key);
const show = async (navigate = jest.fn()) => ({ navigate, view: await render(<ThemeProvider><SettingsPage navigate={navigate} /></ThemeProvider>) });
const sideEffectCalls = () => [...Object.values(gallery), ...Object.values(fileTransfer)].flatMap(fn => (fn as jest.Mock).mock.calls);

beforeEach(async () => {
  jest.mocked(configuredAppVersion).mockImplementation(actualVersion);
  await i18n.changeLanguage('en');
});

test('G456-01 cellular is a visible, disabled, unchecked switch with no side effect', async () => {
  const { navigate } = await show();
  const cellular = screen.getByRole('switch', { name: 'Cellular backup' });
  expect(cellular.props.accessibilityState).toMatchObject({ checked: false, disabled: true });
  expect(cellular.props['aria-checked']).toBe(false);
  expect(screen.getByText('This version has no cellular backup option.')).toBeTruthy();
  await fireEvent.press(cellular);
  expect(navigate).not.toHaveBeenCalled();
  expect(sideEffectCalls()).toHaveLength(0);
});

test('G456-02 photo access has no status pill and only navigates to sources once', async () => {
  const { navigate } = await show();
  expect(screen.getByText('Manage photo source selection in Sources.')).toBeTruthy();
  expect(screen.queryByText(/granted|limited|denied/i)).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Photo access' }));
  expect(navigate).toHaveBeenCalledTimes(1);
  expect(navigate).toHaveBeenCalledWith('sources');
  expect(sideEffectCalls()).toHaveLength(0);
});

test('G456-03 notifications has no switch and only navigates to activity once', async () => {
  const { navigate } = await show();
  expect(screen.getByText('Backup notifications are requested within the existing transfer flow; open Activity.')).toBeTruthy();
  expect(screen.getAllByRole('switch')).toHaveLength(1);
  await fireEvent.press(screen.getByRole('button', { name: 'Notifications' }));
  expect(navigate).toHaveBeenCalledTimes(1);
  expect(navigate).toHaveBeenCalledWith('activity');
  expect(sideEffectCalls()).toHaveLength(0);
});

test('G456-04 shows the configured version and a translated unknown for invalid config', async () => {
  const first = await show();
  expect(screen.getByText('Configuration version')).toBeTruthy();
  expect(screen.getByText('1.0.0')).toBeTruthy();
  expect(screen.queryByText(/prototype|installed|build|release/i)).toBeNull();
  await first.view.unmount();
  for (const raw of ['', '  ', undefined, null, 7, {}]) expect(parseConfiguredVersion(raw)).toBeNull();
  expect(parseConfiguredVersion('1.2.3')).toBe('1.2.3');
  expect(actualVersion()).toBe('1.0.0');
  jest.mocked(configuredAppVersion).mockReturnValue(null);
  await show();
  expect(screen.getByText('Unknown')).toBeTruthy();
  expect(screen.queryByText('1.0.0')).toBeNull();
});

test('G456-05 keeps theme/language selection and every existing navigation target', async () => {
  const { navigate, view } = await show();
  await fireEvent.press(screen.getByRole('radio', { name: 'Light' }));
  expect(screen.getByRole('radio', { name: 'Light' }).props.accessibilityState).toMatchObject({ checked: true });
  await fireEvent.press(screen.getByRole('radio', { name: 'Deutsch' }));
  expect(await screen.findByText('Datenschutz')).toBeTruthy();
  await act(async () => { await i18n.changeLanguage('en'); });
  const targets: [string, string][] = [[t('ui.sources.title'), 'sources'], [t('ui.schedule.title'), 'schedule'], [t('ui.nav.backups'), 'backups'], [t('recovery.settingsEntry'), 'recovery'], [t('transfer.title'), 'activity'], [t('ui.settings.rerunSetup'), 'welcome']];
  for (const [name, target] of targets) { navigate.mockClear(); await fireEvent.press(screen.getByRole('button', { name })); expect(navigate).toHaveBeenCalledTimes(1); expect(navigate).toHaveBeenCalledWith(target); }
  navigate.mockClear();
  await view.unmount();
  await show(navigate);
  expect(navigate).not.toHaveBeenCalled();
  expect(sideEffectCalls()).toHaveLength(0);
});

test.each(['tr', 'en', 'de'])('G456-07 renders all groups in %s with no missing keys and an accessible disabled switch', async (lng) => {
  await i18n.changeLanguage(lng);
  await show();
  expect(JSON.stringify(screen.toJSON())).not.toMatch(/ui\.settings\.|statusUi\./);
  for (const key of ['backup', 'privacy', 'about', 'background']) expect(screen.getByText(t(`ui.settings.${key}`))).toBeTruthy();
  const cellular = screen.getByRole('switch', { name: t('ui.settings.cellular') });
  expect(cellular.props.accessible).toBe(true);
  expect(cellular.props.accessibilityState).toMatchObject({ checked: false, disabled: true });
  expect(screen.getByText(t('ui.settings.cellularDesc'))).toBeTruthy();
  expect(screen.getByText('1.0.0')).toBeTruthy();
});
