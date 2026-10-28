// UI-only disposable Simulator fixture. All peer/jobs below are synthetic, never authority proof.
import React from 'react';
import { AppState, Platform, StatusBar, View, useWindowDimensions } from 'react-native';
import { registerRootComponent, requireNativeModule } from 'expo';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import '../../../../apps/mobile/global.css';
import { i18n } from '../../../../apps/mobile/src/shared/i18n';
import { pairing } from '../../../../apps/mobile/src/shared/api/pairing';
import { fileTransfer } from '../../../../apps/mobile/src/shared/api/file-transfer';
import { App } from '../../../../apps/mobile/src/app/App';
import { ComputerPage } from '../../../../apps/mobile/src/pages/computer/ui/computer-page';
import { ActivityPage } from '../../../../apps/mobile/src/pages/activity/ui/activity-page';
import * as SecureStore from 'expo-secure-store';
import { loadWebDavSettings } from '../../../../apps/mobile/src/shared/api/webdav-settings';

async function bootstrap() {
const key = 'kloda.webdav.profile.v1';
const options = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };
const raw = await SecureStore.getItemAsync(key, options);
let value = raw;
if (value === null && Platform.OS === 'android') {
  value = JSON.stringify({ version: 1, storage: { endpoint: 'https://fixture.invalid/dav/', targetPath: 'test-only', username: 'public-fixture', password: 'synthetic-not-a-user-secret' }, testedAt: null, probeWarning: true });
  await SecureStore.setItemAsync(key, value, options);
}
if (value === null) throw new Error('missing_owned_fixture_profile');
const profile = JSON.parse(value);
if (profile.storage?.username !== 'public-fixture' || profile.storage?.endpoint !== 'https://fixture.invalid/dav/') throw new Error('fixture_profile_collision');
if (profile.probeWarning !== true) await SecureStore.setItemAsync(key, JSON.stringify({ ...profile, probeWarning: true }), options);
const runtime = requireNativeModule('KlodaSyncRuntime');
// Module functions are shadowed in this test JS runtime only; no native sources, prefs or trust are written.
Object.defineProperty(runtime, 'loadDirectorySources', { value: async () => [{ id: 'ui-fixture-source', kind: 'directory', displayName: 'UI TEST folder' }], configurable: true });
Object.defineProperty(runtime, 'loadPhotoSources', { value: async () => [], configurable: true });
Object.defineProperty(runtime, 'validateDirectorySources', { value: async () => [{ id: 'ui-fixture-source', accessible: true }], configurable: true });
Object.defineProperty(runtime, 'loadSchedule', { value: async () => ({ backupMode: 'live', intervalHours: 12, localTime: '12:00' }), configurable: true });
Object.defineProperty(runtime, 'saveSchedule', { value: async () => undefined, configurable: true });
Object.defineProperty(runtime, 'saveLiveSchedule', { value: async () => undefined, configurable: true });
pairing.status = async () => ({ phase: 'complete', recordId: 'AAAAAAAAAAAAAAAAAAAAAA', peerFingerprint: 'TEST ONLY / no LAN / no file grant', repairRequired: false });
let phase = { id: -1, stage: 'sources', language: 'tr' };
fileTransfer.status = async () => ({ running: phase.stage === 'activity-progress', totalJobs: '2', hasMore: false, automaticPaused: phase.stage !== 'activity-progress',
  jobs: [{ id: 'fixture-upload', sourceId: 'ui-fixture-source', recordId: 'AAAAAAAAAAAAAAAAAAAAAA', name: 'UI TEST original.bin', state: phase.stage === 'activity-progress' ? 'uploading' : 'paused', acknowledgedBytes: '65536', totalBytes: '131072' },
    { id: 'fixture-unknown', sourceId: 'ui-fixture-source', recordId: 'AAAAAAAAAAAAAAAAAAAAAA', name: 'UI TEST uncertain.bin', state: 'paused', errorCode: 'outcome_unknown', acknowledgedBytes: '0', totalBytes: '131072' }],
  run: { id: 'ui-fixture-run', recordId: 'AAAAAAAAAAAAAAAAAAAAAA', state: phase.stage === 'activity-progress' ? 'running' : 'needs_attention', attempts: 2,
    ...(phase.stage !== 'activity-progress' ? { errorCode: 'outcome_unknown' } : {}) } });
fileTransfer.photoStatus = async () => ({ state: 'idle', total: '0', completed: '0', review: '0' });
function Checks() {
  const [config, setConfig] = React.useState(phase);
  const dimensions = useWindowDimensions();
  React.useEffect(() => {
    let live = true;
    const poll = async () => {
      const next = await (await fetch('http://127.0.0.1:18887/phase')).json();
      if (live && next.id !== phase.id) { phase = next; await i18n.changeLanguage(next.language); setConfig(next); }
    };
    void poll(); const timer = setInterval(() => { void poll(); }, 500);
    return () => { live = false; clearInterval(timer); };
  }, []);
  React.useEffect(() => {
    if (config.id < 0) return;
    const timer = setTimeout(async () => {
      const saved = await loadWebDavSettings();
      await fetch('http://127.0.0.1:18887/result', { method: 'POST', body: JSON.stringify({ result: 'READY', id: config.id,
        stage: config.stage, language: config.language, platform: Platform.OS, profilePreexisting: raw !== null, initialProbeWarning: profile.probeWarning === true, dimensions, active: AppState.currentState === 'active',
        durableProbeWarning: saved?.probeWarning === true, scope: 'UI fixtures only; no actual peer or file transfer' }) });
    }, 600);
    return () => clearTimeout(timer);
  }, [config, dimensions.width, dimensions.fontScale]);
  const content = config.stage === 'computer' ? <ComputerPage onBack={() => undefined} onPair={() => undefined} onActivity={() => undefined} onAdvanced={() => undefined} />
    : config.stage.startsWith('activity') ? <ActivityPage onBack={() => undefined} /> : <App key={config.id} />;
  return <SafeAreaProvider><GestureHandlerRootView style={{ flex: 1 }}><View style={{ flex: 1 }}><StatusBar barStyle="dark-content" />{content}</View></GestureHandlerRootView></SafeAreaProvider>;
}
return Checks;
}
function Entry() {
  const [Content, setContent] = React.useState(null);
  React.useEffect(() => {
    void bootstrap().then((Component) => setContent(() => Component)).catch(async (error) => {
      await fetch('http://127.0.0.1:18887/result', { method: 'POST', body: JSON.stringify({ result: 'FAIL', code: error.code ?? error.message }) });
    });
  }, []);
  return Content ? <Content /> : <View />;
}
registerRootComponent(Entry);
