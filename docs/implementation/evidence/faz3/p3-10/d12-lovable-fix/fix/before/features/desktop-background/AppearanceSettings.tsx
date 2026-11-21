import { useTranslation } from 'react-i18next';
import type { ThemePreference } from '../../shared/theme/use-appearance';

export function AppearanceSettings({ preference, onChange }: {
  preference: ThemePreference; onChange: (value: ThemePreference) => void;
}) {
  const { t, i18n } = useTranslation();
  return <section className="appearance-settings" aria-label={t('appearance.general')}>
    <h2 className="settings-section-title">{t('appearance.general')}</h2>
    <fieldset role="radiogroup" aria-label={t('appearance.title')}>
      <legend>{t('appearance.title')}</legend>
      <div className="segmented">
        {(['dark', 'light', 'system'] as const).map((value) => <label className="segmented-option" key={value}>
          <input type="radio" name="kloda-appearance" value={value} checked={preference === value} onChange={() => onChange(value)} />
          {t(`appearance.${value}`)}
        </label>)}
      </div>
    </fieldset>
    <fieldset role="radiogroup" aria-label={t('ui.language')}>
      <legend>{t('ui.language')}</legend>
      <div className="segmented">
        {(['tr', 'en', 'de'] as const).map((value) => <label className="segmented-option" key={value}>
          <input type="radio" name="kloda-language" value={value} checked={i18n.resolvedLanguage?.split('-')[0] === value}
            onChange={() => { void i18n.changeLanguage(value); }} />{t(`ui.languages.${value}`)}</label>)}
      </div>
    </fieldset>
  </section>;
}
