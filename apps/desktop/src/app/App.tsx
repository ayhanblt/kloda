import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Archive, ArrowDownToLine, HardDrive, Monitor, Settings, Smartphone } from 'lucide-react';
import { Toaster } from 'sonner';

import '../shared/i18n';
import { PairingPage } from '../pages/pairing/PairingPage';
import { DesktopBackground } from '../features/desktop-background/DesktopBackground';
import { DeviceManagement } from '../pages/devices/DeviceManagement';
import { BackupSetup } from '../pages/backup/BackupSetup';
import { ReceiverHome } from '../pages/receiver/ReceiverHome';
import { IncomingActivity } from '../pages/incoming/IncomingActivity';
import { BackupVersions } from '../pages/backups/BackupVersions';

type DesktopRoute = 'receiver' | 'backup' | 'pairing' | 'incoming' | 'devices' | 'settings' | 'backups';
function currentRoute(): DesktopRoute {
  const route = window.location.hash.slice(2);
  return ['backup', 'pairing', 'incoming', 'devices', 'settings', 'backups'].includes(route) ? route as DesktopRoute : 'receiver';
}

export function App() {
  const { t } = useTranslation();
  const [route, setRoute] = useState<DesktopRoute>(currentRoute);
  const protectedDecision = useRef(false);
  const content = useRef<HTMLDivElement>(null);
  const lastRoute = useRef(route);
  const [navigationBlocked, setNavigationBlocked] = useState(false);
  const onProtectedDecisionChange = useCallback((protectedByNativeStatus: boolean) => {
    // This only protects presentation; native candidate/commit validation owns trust.
    protectedDecision.current = protectedByNativeStatus;
    setNavigationBlocked(protectedByNativeStatus);
  }, []);
  const navigate = (next: DesktopRoute) => {
    if (protectedDecision.current) return;
    window.location.hash = `/${next}`;
    setRoute(next);
  };

  useEffect(() => {
    const onRouteChange = () => {
      if (protectedDecision.current && window.location.hash !== '#/pairing') {
        window.history.replaceState(window.history.state, '', '#/pairing');
        return;
      }
      setRoute(currentRoute());
    };
    window.addEventListener('hashchange', onRouteChange);
    return () => window.removeEventListener('hashchange', onRouteChange);
  }, []);

  useEffect(() => {
    if (lastRoute.current === route) return;
    lastRoute.current = route;
    const heading = Array.from(content.current?.querySelectorAll('h1') ?? []).find((item) => !item.closest('[hidden]'));
    if (heading) { heading.tabIndex = -1; heading.focus(); }
  }, [route]);

  return <>
    <nav aria-label={t('pairing.navigationLabel')} className="desktop-navigation">
      <span className="desktop-navigation-brand">Kloda: Secure Photos &amp; Sync</span>
      {([
        ['receiver', Monitor, 'receiver.navigation'],
        ['pairing', Smartphone, 'pairing.pairingNavigation'],
        ['devices', Smartphone, 'devices.navigation'],
        ['incoming', ArrowDownToLine, 'incoming.navigation'],
        ['backups', Archive, 'backups.navigation'],
        ['settings', Settings, 'receiver.settingsNavigation'],
        ['backup', HardDrive, 'receiver.advancedNavigation'],
      ] as const).map(([destination, Icon, label]) => <button aria-current={route === destination ? 'page' : undefined}
        disabled={navigationBlocked} key={destination} onClick={() => navigate(destination)} type="button">
        <Icon aria-hidden="true" size={18} />{t(label)}
      </button>)}
    </nav>
    <div className="desktop-content" ref={content}>
      {route === 'receiver' && <header className="pairing-page-header receiver-heading">
        <p className="pairing-eyebrow">{t('pairing.lanOnly')}</p>
        <h1>{t('receiver.title')}</h1><p>{t('receiver.description')}</p>
      </header>}
      {route === 'settings' && <h1 className="receiver-settings-title">{t('receiver.settingsNavigation')}</h1>}
      <DesktopBackground settings={route === 'settings'} />
      {route === 'receiver' && <ReceiverHome onNavigate={navigate} />}
      {route === 'backup' && <p className="advanced-notice">{t('receiver.advancedDescription')}</p>}
      <div hidden={route !== 'backup'}><BackupSetup visible={route === 'backup'} /></div>
      {route === 'pairing' && <PairingPage onProtectedDecisionChange={onProtectedDecisionChange} />}
      {route === 'incoming' && <IncomingActivity />}
      {route === 'devices' && <DeviceManagement />}
      {route === 'backups' && <BackupVersions />}
    </div>
    <Toaster closeButton containerAriaLabel={t('pairing.notificationsLabel')} hotkey={[]} position="bottom-right" theme="light"
      toastOptions={{ closeButtonAriaLabel: t('pairing.dismissNotification') }} />
  </>;
}
