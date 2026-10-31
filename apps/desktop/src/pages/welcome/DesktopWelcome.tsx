import { useTranslation } from 'react-i18next';
import { FolderLock } from 'lucide-react';

import { WelcomeIllustration } from '../../shared/ui/WelcomeIllustration';
import { Brand } from '../../shared/ui/Brand';

export function DesktopWelcome({ onStart, onSkip, onAccess }: { onStart(): void; onSkip(): void; onAccess(): void }) {
  const { t } = useTranslation();
  return <main className="desktop-welcome">
    <section className="welcome-introduction">
      <Brand large />
      <h1>{t('ui.welcomeTitle')}</h1>
      <p>{t('ui.welcomeDescription')}</p>
      <WelcomeIllustration className="welcome-illustration" />
    </section>
    <section className="pairing-card welcome-actions" aria-label={t('ui.setup')}>
      <FolderLock size={28} aria-hidden="true" />
      <h2>{t('receiver.accessTitle')}</h2>
      <p>{t('receiver.accessDescription')}</p>
      <button className="pairing-button" onClick={onAccess} type="button">{t('receiver.accessAction')}</button>
      <p className="pairing-permission-note">{t('receiver.trustBoundary')}</p>
      <button className="pairing-button pairing-button-primary" onClick={onStart} type="button">{t('ui.startSetup')}</button>
      <button className="pairing-button pairing-button-quiet" onClick={onSkip} type="button">{t('ui.skipSetup')}</button>
      <p className="pairing-caption">{t('ui.skipDescription')}</p>
    </section>
  </main>;
}
