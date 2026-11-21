import { SunMoon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { ThemePreference } from '../../shared/theme/use-appearance';

export function AppearanceSettings({ preference, onChange }: {
  preference: ThemePreference; onChange: (value: ThemePreference) => void;
}) {
  const { t, i18n } = useTranslation();
  return <section className="appearance-settings" aria-label={t('appearance.general')}>
    <h2 className="settings-section-title">{t('appearance.general')}</h2>
    <div className="pairing-card appearance-theme-card">
      <fieldset role="radiogroup" aria-label={t('appearance.title')} aria-describedby="appearance-system-hint">
        <legend><SunMoon aria-hidden="true" size={16} />{t('appearance.title')}</legend>
        <div className="segmented">
          {(['system', 'light', 'dark'] as const).map((value) => <label className="segmented-option" key={value}>
            <input type="radio" name="kloda-appearance" value={value} checked={preference === value} onChange={() => onChange(value)} />
            {t(`appearance.${value}`)}
          </label>)}
        </div>
      </fieldset>
      <p className="appearance-hint" id="appearance-system-hint">{t('appearance.systemHint')}</p>
    </div>
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
