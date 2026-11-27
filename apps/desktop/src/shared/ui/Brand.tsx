import { useTranslation } from 'react-i18next';
import { KlodaAppIcon } from './Kit';

export function Brand({ large = false, showDot = true }: { large?: boolean; showDot?: boolean }) {
  const { t } = useTranslation();
  if (large) {
    return (
      <span className="kloda-brand kloda-brand-large">
        <KlodaAppIcon sizeClass="size-24" showDot={showDot} animated />
        <span className="sr-only">{t('ui.brand')}</span>
      </span>
    );
  }
  return (
    <span className="kloda-brand">
      <KlodaAppIcon sizeClass="size-9" showDot={showDot} />
      <span>{t('ui.brand')}</span>
    </span>
  );
}
