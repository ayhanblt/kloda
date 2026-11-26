import { fireEvent, render, screen } from '@testing-library/react-native';
import '../../../shared/i18n';
import i18n from 'i18next';
import { ThemeProvider } from '../../../shared/theme/theme-provider';
import { IntroPage } from './intro-page';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => undefined),
}));
jest.mock('nativewind', () => ({
  ...jest.requireActual('nativewind'),
  useColorScheme: () => ({ setColorScheme: jest.fn() }),
}));

describe('IntroPage', () => {
  afterEach(async () => {
    await i18n.changeLanguage('tr');
  });

  it.each(['tr', 'en', 'de'])('renders intro copy and start action cleanly in %s', async (lng) => {
    await i18n.changeLanguage(lng);
    const onStart = jest.fn();
    await render(
      <ThemeProvider>
        <IntroPage onStart={onStart} />
      </ThemeProvider>,
    );
    expect(screen.getByRole('header', { name: i18n.t('ui.setup.introTitle') })).toBeTruthy();
    expect(screen.getByText(i18n.t('ui.setup.introBody'))).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: i18n.t('ui.setup.introStart') }));
    expect(onStart).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(screen.toJSON())).not.toMatch(/ui\.setup\./);
  });
});
