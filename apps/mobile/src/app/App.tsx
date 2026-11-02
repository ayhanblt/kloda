import { useEffect, useState } from 'react';
import { BackHandler } from 'react-native';
import type { DestinationProviderId } from '@kloda/sync-core';
import '../shared/i18n';
import type { MobilePage } from '../shared/model/mobile-navigation';
import { useBackupSetup } from '../features/backup-setup/model/use-backup-setup';
import { MobileShell } from '../widgets/mobile-shell/ui';
import { WelcomePage } from '../pages/welcome/ui/welcome-page';
import { PhotosPage } from '../pages/photos/ui/photos-page';
import { HomePage } from '../pages/home/ui/home-page';
import { SourcePage } from '../pages/setup/ui/source-page';
import { SchedulePage } from '../pages/setup/ui/schedule-page';
import { WebDavPage } from '../pages/setup/ui/webdav-page';
import { ConnectionsPage } from '../pages/connections/ui/connections-page';
import { SmbPage } from '../pages/connections/ui/smb-page';
import { SftpPage } from '../pages/connections/ui/sftp-page';
import { ProviderPage } from '../pages/connections/ui/provider-page';
import { SettingsPage } from '../pages/settings/ui/settings-page';
import { ComputerPage } from '../pages/computer/ui/computer-page';
import { PairingPage } from '../pages/pairing/ui/pairing-page';
import { ActivityPage } from '../pages/activity/ui/activity-page';

export function App() {
  const model = useBackupSetup();
  const [page, setPage] = useState<MobilePage>('welcome');
  const [provider, setProvider] = useState<DestinationProviderId>('webdav');
  const navigate = (next: MobilePage) => { if (page === 'storage') model.leaveStorage(); setPage(next); };
  useEffect(() => {
    if (page === 'pairing' || page === 'welcome' || page === 'home' || page === 'photos') return;
    const listener = BackHandler.addEventListener('hardwareBackPress', () => { navigate('home'); return true; });
    return () => listener.remove();
  }, [page]);
  if (page === 'welcome') return <WelcomePage onStart={() => navigate('sources')} onSkip={() => navigate('home')} />;
  // Pairing owns its protected foreground/camera/pending back actions; no global tab can bypass them.
  if (page === 'pairing') return <PairingPage onBack={() => navigate('computer')} onContinue={() => navigate('activity')} />;
  const back = () => navigate('home');
  const openProvider = (id: DestinationProviderId) => { setProvider(id); navigate(id === 'webdav' ? 'storage' : 'provider'); };
  return <MobileShell page={page} navigate={navigate}>
    {page === 'home' && <HomePage sourceCount={model.sources.length} navigate={navigate} />}
    {page === 'photos' && <PhotosPage navigate={navigate} />}
    {page === 'sources' && <SourcePage model={model} onBack={back} onNext={() => navigate('schedule')} />}
    {page === 'schedule' && <SchedulePage model={model} onBack={() => navigate('sources')} onSaved={() => navigate('computer')} />}
    {page === 'storage' && <WebDavPage model={model} onBack={() => navigate('connections')} />}
    {page === 'computer' && <ComputerPage embedded onBack={() => navigate('connections')} onPair={() => navigate('pairing')} onActivity={() => navigate('activity')} onAdvanced={() => navigate('storage')} />}
    {page === 'activity' && <ActivityPage embedded onBack={back} />}
    {page === 'backups' && <ActivityPage embedded view="backups" onBack={back} />}
    {(page === 'connections' || page === 'add-connection') && <ConnectionsPage adding={page === 'add-connection'} navigate={navigate} openProvider={openProvider} saved={model.savedStorage} />}
    {page === 'provider' && (provider === 'smb' ? <SmbPage onBack={() => navigate('add-connection')} /> : provider === 'sftp' ? <SftpPage onBack={() => navigate('add-connection')} /> : <ProviderPage provider={provider} onBack={() => navigate('add-connection')} />)}
    {page === 'settings' && <SettingsPage navigate={navigate} />}
  </MobileShell>;
}
