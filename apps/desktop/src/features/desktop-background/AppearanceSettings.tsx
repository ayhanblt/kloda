import { useTranslation } from 'react-i18next';
import type { ThemePreference } from '../../shared/theme/use-appearance';

export function AppearanceSettings({ preference, onChange }: {
  preference: ThemePreference; onChange: (value: ThemePreference) => void;
}) {
  const { t, i18n } = useTranslation();
  return <section className="pairing-card appearance-settings">
    <fieldset role="radiogroup" aria-label={t('appearance.title')}>
      <legend>{t('appearance.title')}</legend>
      {(['dark', 'light', 'system'] as const).map((value) => <label className="pairing-button" key={value}>
        <input type="radio" name="kloda-appearance" value={value} checked={preference === value} onChange={() => onChange(value)} />
        {t(`appearance.${value}`)}
      </label>)}
    </fieldset>
    <fieldset role="radiogroup" aria-label={t('ui.language')}>
      <legend>{t('ui.language')}</legend>
      {(['tr', 'en', 'de'] as const).map((value) => <label className="pairing-button" key={value}>
        <input type="radio" name="kloda-language" value={value} checked={i18n.resolvedLanguage?.split('-')[0] === value}
          onChange={() => { void i18n.changeLanguage(value); }} />{t(`ui.languages.${value}`)}</label>)}
    </fieldset>
  </section>;
}
