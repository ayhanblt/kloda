import { fireEvent, render, screen } from '@testing-library/react-native';
import '../../../shared/i18n';
import i18n from 'i18next';
import { HomePage } from './home-page';
import { ThemeProvider } from '../../../shared/theme/theme-provider';
import { useHomeStatus } from '../model/use-home-status';

jest.mock('../model/use-home-status', () => ({ useHomeStatus: jest.fn() }));
jest.mock('expo-secure-store', () => ({ getItemAsync: jest.fn(async () => null), setItemAsync: jest.fn(async () => undefined) }));
jest.mock('nativewind', () => ({ ...jest.requireActual('nativewind'), useColorScheme: () => ({ setColorScheme: jest.fn() }) }));

const run = jest.fn(async () => undefined), resumeAutomatic = jest.fn(async () => undefined);
async function show(automaticPaused: boolean, automatic: boolean) {
  jest.mocked(useHomeStatus).mockReturnValue({ state: 'waiting', pcSelected: false,
    transfer: { queue: { automaticPaused }, working: false, run, pause: jest.fn(), resumeAutomatic },
    webdav: { working: false, status: { configured: false, enabled: true, running: false, run: { state: 'paused', automatic } } },
  } as unknown as ReturnType<typeof useHomeStatus>);
  await render(<ThemeProvider><HomePage sourceCount={1} navigate={jest.fn()} /></ThemeProvider>);
  await fireEvent.press(screen.getByRole('button', { name: 'Resume' }));
}
beforeEach(async () => { run.mockClear(); resumeAutomatic.mockClear(); await i18n.changeLanguage('en'); });
test('Resume starts a paused manual WebDAV run again, without also resuming automatic backup', async () => {
  await show(false, false);
  expect(run).toHaveBeenCalledTimes(1);
  expect(resumeAutomatic).not.toHaveBeenCalled();
});
test('Resume after a user pause only resumes automatic backup', async () => {
  await show(true, false);
  expect(resumeAutomatic).toHaveBeenCalledTimes(1);
  expect(run).not.toHaveBeenCalled();
});
test('Resume of a paused automatic run stays on the automatic path', async () => {
  await show(false, true);
  expect(resumeAutomatic).toHaveBeenCalledTimes(1);
  expect(run).not.toHaveBeenCalled();
});
