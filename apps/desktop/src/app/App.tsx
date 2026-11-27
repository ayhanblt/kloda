import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Toaster } from 'sonner';

import '../shared/i18n';
import { PairingPage } from '../pages/pairing/PairingPage';
import { DesktopBackground, type ReceiverSummary } from '../features/desktop-background/DesktopBackground';
import { DeviceManagement } from '../pages/devices/DeviceManagement';
import { BackupSetup } from '../pages/backup/BackupSetup';
import { ReceiverHome } from '../pages/receiver/ReceiverHome';
import { IncomingActivity } from '../pages/incoming/IncomingActivity';
import { BackupVersions } from '../pages/backups/BackupVersions';
import { DesktopWelcome } from '../pages/welcome/DesktopWelcome';
import { ConnectionsPage } from '../pages/connections/ConnectionsPage';
import { DesktopShell } from '../widgets/desktop-shell/DesktopShell';
import { currentDesktopLocation, desktopHash, type DesktopLocation, type DesktopRoute } from '../shared/navigation/desktop-route';
import type { BackgroundStatus } from '../shared/api/desktop';
import { PageHeader } from '../shared/ui/Kit';

import { useAppearance } from '../shared/theme/use-appearance';
import { AppearanceSettings } from '../features/desktop-background/AppearanceSettings';

export function App() {
  const appearance = useAppearance();
  const { t, i18n } = useTranslation();
  useEffect(() => {
    document.documentElement.lang = i18n.resolvedLanguage ?? 'tr';
  }, [i18n.resolvedLanguage]);
  const [location, setLocation] = useState<DesktopLocation>(currentDesktopLocation);
  const route = location.page;
  const protectedDecision = useRef(false);
  const content = useRef<HTMLDivElement>(null);
  const lastRoute = useRef(desktopHash(location));
  const [navigationBlocked, setNavigationBlocked] = useState(false);
  const [bgState, setBgState] = useState<{ status: BackgroundStatus | null; failed: boolean }>({ status: null, failed: false });
  const [summaryCounts, setSummaryCounts] = useState<{ devicesTotal: number | null; devicesGranted: number; incomingCount: number | null }>({
    devicesTotal: null,
    devicesGranted: 0,
    incomingCount: null,
  });

  const onProtectedDecisionChange = useCallback((protectedByNativeStatus: boolean) => {
    // This only protects presentation; native candidate/commit validation owns trust.
    protectedDecision.current = protectedByNativeStatus;
    setNavigationBlocked(protectedByNativeStatus);
  }, []);

  const navigateTo = useCallback((next: DesktopLocation) => {
    if (protectedDecision.current) return;
    window.location.hash = desktopHash(next);
    setLocation(next);
  }, []);
  const navigate = useCallback((page: DesktopRoute) => navigateTo({ page }), [navigateTo]);

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
    if (heading) {
      heading.tabIndex = -1;
      heading.focus();
    }
  }, [location]);

  const onStatusChange = useCallback((status: BackgroundStatus | null, failed: boolean) => {
    setBgState({ status, failed });
  }, []);

  const receiverSummary: ReceiverSummary = {
    ...summaryCounts,
    onNavigate: navigate,
  };

  const backgroundMode =
    route === 'settings' ? 'settings' : route === 'tray' ? 'tray' : route === 'receiver' ? 'receiver' : 'silent';
  const backupVisible = route === 'backup' || route === 'jobs';

  return (
    <>
      <DesktopShell bgFailed={bgState.failed} bgStatus={bgState.status} blocked={navigationBlocked} location={location} onNavigate={navigate}>
        <div className="desktop-content" ref={content}>
          {route === 'welcome' && (
            <DesktopWelcome
              autostartEnabled={bgState.status?.autostart.enabled}
              autostartReason={bgState.status?.autostart.reason}
              autostartSupported={bgState.status?.autostart.supported}
              onAccess={() => navigate('devices')}
              onSkip={() => navigate('receiver')}
              onStart={() => navigate('pairing')}
            />
          )}
          {route === 'receiver' && <PageHeader body={t('receiver.description')} title={t('receiver.title')} />}
          {route === 'settings' && <h1 className="receiver-settings-title">{t('receiver.settingsNavigation')}</h1>}
          {route === 'tray' && <PageHeader body={t('ui.trayDescription')} title={t('ui.tray')} />}
          <div className={route === 'settings' ? 'max-w-3xl' : undefined} hidden={route === 'welcome'}>
            <DesktopBackground
              general={route === 'settings' ? <AppearanceSettings preference={appearance.preference} onChange={appearance.choose} /> : undefined}
              mode={backgroundMode}
              onOpen={() => navigate('receiver')}
              onRestartSetup={() => navigate('welcome')}
              onStatusChange={onStatusChange}
              receiverSummary={receiverSummary}
              settings={route === 'settings'}
              tray={route === 'tray'}
            />
          </div>
          {route === 'receiver' && <ReceiverHome onNavigate={navigate} onSummaryChange={setSummaryCounts} />}
          {backupVisible && (
            <PageHeader body={t('receiver.advancedDescription')} title={t(route === 'jobs' ? 'ui.jobs' : 'receiver.advancedNavigation')} />
          )}
          <div hidden={!backupVisible}>
            <BackupSetup showActivity={route === 'jobs'} visible={backupVisible} />
          </div>
          {route === 'pairing' && <PairingPage onProtectedDecisionChange={onProtectedDecisionChange} />}
          {route === 'incoming' && <IncomingActivity />}
          {route === 'devices' && <DeviceManagement onPair={() => navigate('pairing')} />}
          {(route === 'backups' || route === 'trash') && (
            <BackupVersions
              initialTrash={route === 'trash'}
              key={route}
              onViewChange={(trash) => navigate(trash ? 'trash' : 'backups')}
            />
          )}
          {(route === 'connections' || route === 'connection-add' || route === 'connection-detail') && (
            <ConnectionsPage location={location} onNavigate={navigateTo} />
          )}
        </div>
      </DesktopShell>
      <Toaster
        closeButton
        containerAriaLabel={t('pairing.notificationsLabel')}
        hotkey={[]}
        position="bottom-right"
        theme={appearance.mode}
        toastOptions={{ closeButtonAriaLabel: t('pairing.dismissNotification') }}
      />
    </>
  );
}
