import { useTranslation } from 'react-i18next';

export function Brand({ large = false }: { large?: boolean }) {
  const { t } = useTranslation();
  return <span className={`kloda-brand ${large ? 'kloda-brand-large' : ''}`}>
    <span className="kloda-mark" aria-hidden="true">
      <svg viewBox="0 0 120 120" fill="none">
        <circle cx="60" cy="60" r="26" strokeWidth="10" strokeLinecap="round" strokeDasharray="122 41" transform="rotate(-90 60 60)" className="kloda-ring" />
        <circle cx="60" cy="60" r="7" className="kloda-dot" />
      </svg>
    </span>
    <span>{t('ui.brand')}</span>
  </span>;
}
