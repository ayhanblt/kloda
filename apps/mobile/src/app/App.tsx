import { useEffect, useState } from 'react';
import { BackHandler, View } from 'react-native';
import type { DestinationProviderId } from '@kloda/sync-core';
import { providerLabel, type CloudProvider } from '../shared/api/cloud-destinations';
import '../shared/i18n';
import type { MobilePage } from '../shared/model/mobile-navigation';
import { loadIntroSeen, saveIntroSeen } from '../shared/model/intro-storage';
import { useBackupSetup } from '../features/backup-setup/model/use-backup-setup';
import { MobileShell } from '../widgets/mobile-shell/ui';
import { IntroPage } from '../pages/intro/ui/intro-page';
import { WelcomePage } from '../pages/welcome/ui/welcome-page';
import { PhotosPage } from '../pages/photos/ui/photos-page';
import { HomePage } from '../pages/home/ui/home-page';
import { SourcePage } from '../pages/setup/ui/source-page';
import { SchedulePage } from '../pages/setup/ui/schedule-page';
import { WebDavPage } from '../pages/setup/ui/webdav-page';
import { ConnectionsPage } from '../pages/connections/ui/connections-page';
import { SmbPage } from '../pages/connections/ui/smb-page';
import { SftpPage } from '../pages/connections/ui/sftp-page';
import { S3Page } from '../pages/connections/ui/s3-page';
import { FtpsPage } from '../pages/connections/ui/ftps-page';
import { ProviderPage } from '../pages/connections/ui/provider-page';
import { CloudProviderPage, cloudProviderFor } from '../pages/connections/ui/cloud-provider-page';
import { SettingsPage } from '../pages/settings/ui/settings-page';
import { RecoveryPage } from '../pages/settings/ui/recovery-page';
import { ComputerPage } from '../pages/computer/ui/computer-page';
import { ActivityPage } from '../pages/activity/ui/activity-page';

const rootTabs = new Set<MobilePage>(['home', 'photos', 'connections', 'settings']);
const ownedBackPages = new Set<MobilePage>(['intro', 'welcome', 'home', 'photos', 'computer', 'pairing', 'activity', 'backups']);

export function App({ initialIntroSeen }: { initialIntroSeen?: boolean } = {}) {
  const model = useBackupSetup();
  const [introReady, setIntroReady] = useState(initialIntroSeen !== undefined);
  const [history, setHistory] = useState<MobilePage[]>([initialIntroSeen === false ? 'intro' : 'welcome']);
  const page = history[history.length - 1] ?? 'home';
  const [provider, setProvider] = useState<DestinationProviderId>('webdav');
  const [backupTarget, setBackupTarget] = useState<{ id: string; provider: CloudProvider } | undefined>();
  const navigate = (next: MobilePage) => {
    const resolved: MobilePage = next === 'pairing' ? 'computer' : next;
    if (page === 'storage' && resolved !== 'storage') model.leaveStorage();
    setBackupTarget(undefined);
    setHistory((prev) => {
      const current = prev[prev.length - 1] ?? 'home';
      if (resolved === current) return prev;
      if (rootTabs.has(resolved) || resolved === 'intro' || resolved === 'welcome' || current === 'intro' || current === 'welcome') {
        return [resolved];
      }
      return [...prev, resolved];
    });
  };
  const goBack = (fallback: MobilePage = 'home') => {
    if (page === 'storage') model.leaveStorage();
    setBackupTarget(undefined);
    setHistory((prev) => (prev.length > 1 ? prev.slice(0, -1) : [fallback]));
  };
  const openBackups = (id: string, target: CloudProvider) => { navigate('backups'); setBackupTarget({ id, provider: target }); };
  useEffect(() => {
    if (initialIntroSeen !== undefined) return;
    let active = true;
    void loadIntroSeen().then((seen) => {
      if (!active) return;
      if (!seen) setHistory(['intro']);
      setIntroReady(true);
    });
    return () => { active = false; };
  }, [initialIntroSeen]);
  useEffect(() => {
    if (ownedBackPages.has(page)) return;
    const listener = BackHandler.addEventListener('hardwareBackPress', () => { goBack('home'); return true; });
    return () => listener.remove();
  }, [page]);
  if (!introReady) return <View className="flex-1 bg-background" />;
  if (page === 'intro') return <IntroPage onStart={() => { void saveIntroSeen(); navigate('welcome'); }} />;
  if (page === 'welcome') return <WelcomePage onStart={() => navigate('sources')} onSkip={() => navigate('home')} />;
  const back = () => goBack('home');
  const cloudProvider = cloudProviderFor(provider);
  const openProvider = (id: DestinationProviderId) => { setProvider(id); navigate(id === 'webdav' ? 'storage' : 'provider'); };
  // A destination's own Backups view belongs to the Destinations tab it was opened from.
  return <MobileShell page={page} navigate={navigate} section={page === 'backups' && backupTarget ? 'connections' : undefined}>
    {page === 'home' && <HomePage sourceCount={model.sources.length} navigate={navigate} />}
    {page === 'photos' && <PhotosPage navigate={navigate} />}
    {page === 'sources' && <SourcePage model={model} onBack={back} onNext={() => navigate('schedule')} />}
    {page === 'schedule' && <SchedulePage model={model} onBack={() => goBack('sources')} onSaved={() => navigate('computer')} />}
    {page === 'storage' && <WebDavPage model={model} onBack={() => goBack('connections')} />}
    {(page === 'computer' || page === 'pairing') && <ComputerPage embedded onBack={() => goBack('connections')} onActivity={() => navigate('activity')} />}
    {page === 'activity' && <ActivityPage embedded onBack={back} />}
    {page === 'backups' && <ActivityPage embedded view="backups" target={backupTarget?.id} targetLabel={backupTarget && providerLabel(backupTarget.provider)} onBack={() => goBack(backupTarget ? 'connections' : 'home')} />}
    {(page === 'connections' || page === 'add-connection') && <ConnectionsPage adding={page === 'add-connection'} navigate={navigate} onBack={() => goBack(page === 'add-connection' ? 'connections' : 'home')} openProvider={openProvider} openBackups={openBackups} saved={model.savedStorage} />}
    {page === 'provider' && (provider === 'smb' ? <SmbPage onBack={() => goBack('add-connection')} /> : provider === 'sftp' ? <SftpPage onBack={() => goBack('add-connection')} />
      : provider === 'ftp' ? <FtpsPage onBack={() => goBack('add-connection')} />
      : provider === 'amazon-s3' || provider === 's3-compatible' ? <S3Page key={provider} provider={provider} onBack={() => goBack('add-connection')} />
      : cloudProvider ? <CloudProviderPage provider={cloudProvider} onBack={() => goBack('add-connection')} onSaved={() => navigate('connections')} /> : <ProviderPage provider={provider} onBack={() => goBack('add-connection')} />)}
    {page === 'settings' && <SettingsPage navigate={navigate} />}
    {page === 'recovery' && <RecoveryPage onBack={() => goBack('settings')} />}
  </MobileShell>;
}
