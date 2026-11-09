import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Appearance, Pressable, Text } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { ThemeProvider, useTheme } from './theme-provider';

const mockSetColorScheme = jest.fn();
jest.mock('nativewind', () => ({ ...jest.requireActual('nativewind'),
  useColorScheme: () => ({ setColorScheme: mockSetColorScheme }) }));
jest.mock('expo-secure-store', () => ({ getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => undefined) }));
function Controls() {
  const { setPreference } = useTheme();
  return <><Pressable accessibilityRole="button" accessibilityLabel="system" onPress={() => setPreference('system')}><Text>system</Text></Pressable>
    <Pressable accessibilityRole="button" accessibilityLabel="light" onPress={() => setPreference('light')}><Text>light</Text></Pressable></>;
}
beforeEach(() => {
  mockSetColorScheme.mockClear();
  jest.mocked(SecureStore.getItemAsync).mockResolvedValue(null);
});
afterEach(() => jest.restoreAllMocks());
test('system uses the non-null RN value; explicit themes still use NativeWind', async () => {
  const native = jest.spyOn(Appearance, 'setColorScheme').mockImplementation(() => {});
  await render(<ThemeProvider><Controls /></ThemeProvider>);
  expect(mockSetColorScheme).toHaveBeenCalledWith('dark');
  await fireEvent.press(screen.getByRole('button', { name: 'system' }));
  expect(native).toHaveBeenCalledWith('unspecified');
  expect(mockSetColorScheme).not.toHaveBeenCalledWith('system');
  expect(native).not.toHaveBeenCalledWith(null);
  await fireEvent.press(screen.getByRole('button', { name: 'light' }));
  expect(mockSetColorScheme).toHaveBeenCalledWith('light');
});
test('restoring saved system preference also avoids NativeWind null', async () => {
  jest.mocked(SecureStore.getItemAsync).mockResolvedValue('system');
  const native = jest.spyOn(Appearance, 'setColorScheme').mockImplementation(() => {});
  await render(<ThemeProvider><Controls /></ThemeProvider>);
  await waitFor(() => expect(native).toHaveBeenCalledWith('unspecified'));
  expect(mockSetColorScheme).not.toHaveBeenCalledWith('system');
});
