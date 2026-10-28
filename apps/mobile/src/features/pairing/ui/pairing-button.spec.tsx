import { fireEvent, render } from '@testing-library/react-native';
import { Text } from 'react-native';
import { PairingButton } from './pairing-button';
import { i18n } from '../../../shared/i18n';
import { colors } from '../../../shared/ui/tokens';

it.each(['tr', 'en', 'de'])('keeps an exact accessible label, wrapped uncapped text and a48px target in %s', async (language) => {
  await i18n.changeLanguage(language);
  try {
    const label = i18n.t('computer.advanced');
    const pressed = jest.fn();
    const view = await render(<PairingButton label={label} icon={<Text>fixture icon</Text>} onPress={pressed} />);
    const button = view.getByRole('button', { name: label });
    expect(button.props.className).toContain('min-h-[48px]');
    const text = view.getByText(label);
    expect(text.props.className).toContain('min-w-0');
    expect(text.props.className).toContain('shrink');
    expect(text.props.numberOfLines).toBeUndefined();
    expect(text.props.allowFontScaling).not.toBe(false);
    expect(text.props.maxFontSizeMultiplier).toBeUndefined();
    await fireEvent.press(button); expect(pressed).toHaveBeenCalledTimes(1);
    await view.unmount();
  } finally { await i18n.changeLanguage('tr'); }
});

it('exposes disabled state and does not invoke the action', async () => {
  const pressed = jest.fn();
  const view = await render(<PairingButton label="fixture disabled" disabled onPress={pressed} />);
  const button = view.getByRole('button', { name: 'fixture disabled' });
  expect(button.props.accessibilityState.disabled).toBe(true);
  await fireEvent.press(button); expect(pressed).not.toHaveBeenCalled();
});

it('keeps normal text colors at WCAG AA contrast on their existing Stitch backgrounds', () => {
  const luminance = (hex: string) => {
    const rgb = [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16) / 255)
      .map((v) => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
    return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
  };
  for (const [foreground, background] of [[colors.ink, colors.surface], [colors.muted, colors.surface],
    [colors.ink, colors.elevated], [colors.error, colors.elevated], [colors.elevated, colors.primary]]) {
    const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
    expect((values[0] + 0.05) / (values[1] + 0.05)).toBeGreaterThanOrEqual(4.5);
  }
});
