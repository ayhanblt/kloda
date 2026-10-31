import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Pressable, processColor } from 'react-native';
import '../../../shared/i18n';
import i18n from 'i18next';
import { StatusView } from './home-page';
import { ThemeProvider, useTheme } from '../../../shared/theme/theme-provider';
import { themeColors } from '../../../shared/theme/tokens';
import { Text } from '../../../shared/ui/text';
import { useReducedMotion } from 'react-native-reanimated';

jest.mock('react-native-reanimated', () => ({ ...jest.requireActual('react-native-reanimated'), useReducedMotion: jest.fn(() => false) }));
jest.mock('expo-secure-store', () => ({ getItemAsync: jest.fn(async () => null), setItemAsync: jest.fn(async () => undefined) }));
jest.mock('nativewind', () => ({ ...jest.requireActual('nativewind'), useColorScheme: () => ({ setColorScheme: jest.fn() }) }));
function AppearanceSwitch() {
  const theme = useTheme();
  return <Pressable accessibilityRole="button" accessibilityLabel="fixture light" onPress={() => theme.setPreference('light')}><Text>fixture</Text></Pressable>;
}
beforeEach(async () => { jest.mocked(useReducedMotion).mockReturnValue(false); await i18n.changeLanguage('en'); });
test('safe/syncing render without demo claims, and secondary actions keep their real handlers', async () => {
  const run = jest.fn(), pause = jest.fn(), navigate = jest.fn();
  const props = { targets: [{ id: 'owned', label: 'Owned PC', kind: 'pc' as const, state: 'safe' as const, page: 'computer' as const }], sourceCount: 1, paused: false, working: false, navigate, run, pause, resume: jest.fn() };
  const view = await render(<ThemeProvider><AppearanceSwitch /><StatusView {...props} state="safe" /></ThemeProvider>);
  expect(screen.getByRole('header', { name: 'Last run completed' })).toBeTruthy();
  expect(screen.queryByText(/100%|MacBook|14:06|MB\/s/)).toBeNull();
  expect((JSON.stringify(screen.toJSON()).match(/"payload":\d+/g) ?? [])).toContain(`"payload":${Number(processColor(themeColors('dark')['brand-base'])) >>> 0}`);
  await fireEvent.press(screen.getByRole('button', { name: 'fixture light' }));
  await waitFor(() => expect((JSON.stringify(screen.toJSON()).match(/"payload":\d+/g) ?? [])).toContain(`"payload":${Number(processColor(themeColors('light')['brand-base'])) >>> 0}`));
  await fireEvent.press(screen.getByRole('button', { name: 'Back up now' })); expect(run).toHaveBeenCalledTimes(1);
  await fireEvent.press(screen.getByRole('button', { name: 'Activity history' })); expect(navigate).toHaveBeenCalledWith('activity');
  await view.rerender(<ThemeProvider><StatusView {...props} state="syncing" progress={{ kind: 'bytes', completed: '5', total: '10', percent: 50 }} /></ThemeProvider>);
  expect(screen.getByRole('progressbar').props.accessibilityValue.now).toBe(50);
  await fireEvent.press(screen.getByRole('button', { name: 'Pause' })); expect(pause).toHaveBeenCalledTimes(1);
});

test('Reduce Motion keeps the syncing illustration static', async () => {
  jest.mocked(useReducedMotion).mockReturnValue(true);
  await render(<ThemeProvider><StatusView state="syncing" targets={[{ id: 'owned', label: 'Fixture PC', kind: 'pc', state: 'syncing', page: 'computer' }]}
    sourceCount={1} paused={false} working={false} navigate={jest.fn()} run={jest.fn()} pause={jest.fn()} resume={jest.fn()} /></ThemeProvider>);
  expect(screen.getByRole('header', { name: 'Backing up' })).toBeTruthy();
  expect(JSON.stringify(screen.toJSON())).not.toContain('animate-pulse');
});
