import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Toaster } from 'sonner';

import '../shared/i18n';
import { PairingPage } from '../pages/pairing/PairingPage';
import { DesktopBackground } from '../features/desktop-background/DesktopBackground';
import { DeviceManagement } from '../pages/devices/DeviceManagement';
import { BackupSetup } from '../pages/backup/BackupSetup';
import { ReceiverHome } from '../pages/receiver/ReceiverHome';
import { IncomingActivity } from '../pages/incoming/IncomingActivity';
import { BackupVersions } from '../pages/backups/BackupVersions';
import { DesktopWelcome } from '../pages/welcome/DesktopWelcome';
import { ConnectionsPage } from '../pages/connections/ConnectionsPage';
import { DesktopShell } from '../widgets/desktop-shell/DesktopShell';
import { currentDesktopLocation, desktopHash, type DesktopLocation, type DesktopRoute } from '../shared/navigation/desktop-route';

export function App() {
  const { t } = useTranslation();
  const [location, setLocation] = useState<DesktopLocation>(currentDesktopLocation);
  const route = location.page;
  const protectedDecision = useRef(false);
  const content = useRef<HTMLDivElement>(null);
  const lastRoute = useRef(desktopHash(location));
  const [navigationBlocked, setNavigationBlocked] = useState(false);
  const onProtectedDecisionChange = useCallback((protectedByNativeStatus: boolean) => {
    // This only protects presentation; native candidate/commit validation owns trust.
    protectedDecision.current = protectedByNativeStatus;
    setNavigationBlocked(protectedByNativeStatus);
  }, []);
  const navigateTo = (next: DesktopLocation) => {
    if (protectedDecision.current) return;
    window.location.hash = desktopHash(next);
    setLocation(next);
  };
  const navigate = (page: DesktopRoute) => navigateTo({ page });

  useEffect(() => {
    const onRouteChange = () => {
      if (protectedDecision.current && window.location.hash !== '#/pairing') {
        window.history.replaceState(window.history.state, '', '#/pairing');
        return;
      }
      setLocation(currentDesktopLocation());
    };
    window.addEventListener('hashchange', onRouteChange);
    return () => window.removeEventListener('hashchange', onRouteChange);
  }, []);

  useEffect(() => {
    const next = desktopHash(location);
    if (lastRoute.current === next) return;
    lastRoute.current = next;
    const heading = Array.from(content.current?.querySelectorAll('h1') ?? []).find((item) => !item.closest('[hidden]'));
    if (heading) { heading.tabIndex = -1; heading.focus(); }
  }, [location]);

  const backupVisible = route === 'backup' || route === 'jobs';
  return <>
    <DesktopShell location={location} blocked={navigationBlocked} onNavigate={navigate}>
      <div className="desktop-content" ref={content}>
        {route === 'welcome' && <DesktopWelcome onStart={() => navigate('pairing')} onSkip={() => navigate('receiver')} onAccess={() => navigate('devices')} />}
        {route === 'receiver' && <header className="pairing-page-header receiver-heading">
          <h1>{t('receiver.title')}</h1><p>{t('receiver.description')}</p>
        </header>}
        {route === 'settings' && <h1 className="receiver-settings-title">{t('receiver.settingsNavigation')}</h1>}
        <div hidden={route === 'welcome'}><DesktopBackground settings={route === 'settings'} /></div>
        {route === 'receiver' && <ReceiverHome onNavigate={navigate} />}
        {backupVisible && <p className="advanced-notice">{t('receiver.advancedDescription')}</p>}
        <div hidden={!backupVisible}><BackupSetup visible={backupVisible} showActivity={route === 'jobs'} /></div>
        {route === 'pairing' && <PairingPage onProtectedDecisionChange={onProtectedDecisionChange} />}
        {route === 'incoming' && <IncomingActivity />}
        {route === 'devices' && <DeviceManagement />}
        {(route === 'backups' || route === 'trash') && <BackupVersions key={route} initialTrash={route === 'trash'} onViewChange={(trash) => navigate(trash ? 'trash' : 'backups')} />}
        {(route === 'connections' || route === 'connection-add' || route === 'connection-detail') && <ConnectionsPage location={location} onNavigate={navigateTo} />}
        {route === 'tray' && <main className="pairing-card"><h1 className="text-3xl font-semibold">{t('ui.tray')}</h1><p className="mt-4 text-muted">{t('ui.trayDescription')}</p></main>}
      </div>
    </DesktopShell>
    <Toaster closeButton containerAriaLabel={t('pairing.notificationsLabel')} hotkey={[]} position="bottom-right" theme="light"
      toastOptions={{ closeButtonAriaLabel: t('pairing.dismissNotification') }} />
  </>;
}
