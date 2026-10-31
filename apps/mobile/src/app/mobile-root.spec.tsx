import { render } from '@testing-library/react-native';
import { useFonts } from 'expo-font';
import { i18n } from '../shared/i18n';
import MobileApp from '../../App';

jest.mock('react-native-safe-area-context', () => jest.requireActual('react-native-safe-area-context/jest/mock').default);
jest.mock('../../global.css', () => ({}));
jest.mock('react-native-gesture-handler', () => ({ GestureHandlerRootView: jest.requireActual('react-native').View }));
jest.mock('nativewind', () => ({ ...jest.requireActual('nativewind'), useColorScheme: () => ({ setColorScheme: jest.fn() }) }));
jest.mock('expo-secure-store', () => ({ getItemAsync: jest.fn(async () => null), setItemAsync: jest.fn(async () => undefined) }));
jest.mock('expo-font', () => ({ useFonts: jest.fn() }));
jest.mock('./App', () => ({ App: () => null }));
jest.mock('sonner-native', () => ({ Toaster: () => null }));

describe('local design font loading', () => {
  it('waits for local fonts without mounting the application', async () => {
    jest.mocked(useFonts).mockReturnValue([false, null]);
    const surface = await render(<MobileApp />);
    expect(surface.getByLabelText(i18n.t('pairing.loading'))).toBeTruthy();
    expect(surface.queryByRole('alert')).toBeNull();
  });

  it('keeps the application reachable and reports a font error', async () => {
    jest.mocked(useFonts).mockReturnValue([false, new Error('fixture-font-failure')]);
    const surface = await render(<MobileApp />);
    expect(surface.getByText(i18n.t('ui.fontUnavailable'))).toBeTruthy();
    expect(surface.queryByLabelText(i18n.t('pairing.loading'))).toBeNull();
  });
});
