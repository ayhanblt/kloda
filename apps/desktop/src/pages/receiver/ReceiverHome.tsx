import { useTranslation } from 'react-i18next';
import { Archive, ArrowDownToLine, FolderLock, QrCode, Settings, Smartphone } from 'lucide-react';

export function ReceiverHome({ onNavigate }: {
  onNavigate(route: 'pairing' | 'devices' | 'incoming' | 'settings' | 'backups'): void;
}) {
  const { t } = useTranslation();
  return <main className="receiver-home" aria-label={t('receiver.stepsTitle')}>
    <h2>{t('receiver.stepsTitle')}</h2>
    <div className="receiver-steps">
      <section className="pairing-card">
        <p className="pairing-eyebrow">{t('receiver.step', { number: 1 })}</p>
        <div className="pairing-section-heading"><QrCode aria-hidden="true" size={22} /><h3>{t('receiver.pairTitle')}</h3></div>
        <p className="pairing-caption">{t('receiver.pairDescription')}</p>
        <button className="pairing-button pairing-button-primary" onClick={() => onNavigate('pairing')} type="button">{t('receiver.pairAction')}</button>
      </section>
      <section className="pairing-card">
        <p className="pairing-eyebrow">{t('receiver.step', { number: 2 })}</p>
        <div className="pairing-section-heading"><FolderLock aria-hidden="true" size={22} /><h3>{t('receiver.accessTitle')}</h3></div>
        <p className="pairing-caption">{t('receiver.accessDescription')}</p>
        <button className="pairing-button" onClick={() => onNavigate('devices')} type="button">{t('receiver.accessAction')}</button>
      </section>
    </div>
    <p className="pairing-permission-note">{t('receiver.trustBoundary')}</p>
    <div className="receiver-destinations">
      {([
        ['devices', Smartphone, 'devicesTitle', 'devicesDescription'],
        ['incoming', ArrowDownToLine, 'incomingTitle', 'incomingDescription'],
        ['backups', Archive, 'backupsTitle', 'backupsDescription'],
        ['settings', Settings, 'settingsNavigation', 'settingsDescription'],
      ] as const).map(([route, Icon, title, description]) => <button className="pairing-card receiver-destination" key={route}
        onClick={() => onNavigate(route)} type="button">
        <Icon aria-hidden="true" size={22} /><span><strong>{t(`receiver.${title}`)}</strong><span className="pairing-caption">{t(`receiver.${description}`)}</span></span>
      </button>)}
    </div>
  </main>;
}
