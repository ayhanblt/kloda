import { useTranslation } from 'react-i18next';
import { Clock3, Cloud, History, Monitor, Pause, Play, RefreshCw, Server } from 'lucide-react-native';
import { Pressable, ScrollView, View } from 'react-native';
import { Text } from '../../../shared/ui/text';
import { ByteProgress } from '../../../shared/ui/byte-progress';
import { StatusHero } from '../../../shared/ui/status-hero';
import { useThemeColors } from '../../../shared/theme/theme-provider';
import type { NavigateMobile } from '../../../shared/model/mobile-navigation';
import { homeStatus, otherTargetState, type HomeState, type DestinationKind, type StatusProgress } from '../model/home-status';
import { useHomeStatus } from '../model/use-home-status';

interface StatusTarget { id: string; label: string; kind: DestinationKind; state: HomeState | 'disabled'; page: 'computer' | 'storage' | 'connections' }
interface StatusViewProps {
  state: HomeState; progress?: StatusProgress; targets: StatusTarget[]; sourceCount: number; paused: boolean; working: boolean;
  navigate: NavigateMobile; run: () => void; pause: () => void; resume: () => void;
  // The action drives only the PC queue and the original WebDAV run; other destinations start from their own card.
  action?: boolean;
}
export function HomePage({ sourceCount, navigate }: { sourceCount: number; navigate: NavigateMobile }) {
  const { t } = useTranslation();
  const model = useHomeStatus(sourceCount);
  const { transfer, webdav, pcSelected, others } = model;
  // Resume only restarts automatic runs; a paused manual WebDAV run is started again like "Back up now".
  // Never both at once: the automatic run would then fail with backup_busy.
  const manualPaused = transfer.queue?.automaticPaused !== true && webdav.status?.run?.state === 'paused' && !webdav.status.run.automatic;
  const resume = () => manualPaused ? transfer.run() : transfer.resumeAutomatic();
  const targets: StatusTarget[] = [];
  if (pcSelected) targets.push({ id: 'pc', label: t('computer.title'), kind: 'pc', page: 'computer',
    state: homeStatus({ sourceCount, pcSelected, queue: transfer.queue, webdav: { configured: false, enabled: false, running: false }, pcError: transfer.error }).state });
  if (webdav.status?.configured) targets.push({ id: webdav.status.targetId ?? 'webdav', label: webdav.status.config ? new URL(webdav.status.config.endpoint).hostname : t('onboarding.webdavTitle'), kind: 'nas', page: 'storage',
    state: webdav.status.enabled ? homeStatus({ sourceCount, pcSelected: false, queue: null, webdav: webdav.status, webdavError: webdav.error ?? transfer.webdavActionError }).state : 'disabled' });
  for (const target of others) targets.push({ id: target.id, label: target.label, kind: target.kind, page: 'connections', state: target.enabled ? otherTargetState(target) : 'disabled' });
  return <StatusView state={model.state} progress={model.progress} targets={targets} sourceCount={sourceCount}
    paused={transfer.queue?.automaticPaused === true || webdav.status?.run?.state === 'paused'} working={transfer.working || webdav.working}
    action={pcSelected === true || webdav.status?.enabled === true || !others.some(target => target.enabled)}
    navigate={navigate} run={() => { void transfer.run(); }} pause={() => { void transfer.pause(); }} resume={() => { void resume(); }} />;
}

export function StatusView({ state, progress, targets, sourceCount, paused, working, navigate, run, pause, resume, action = true }: StatusViewProps) {
  const { t } = useTranslation();
  const c = useThemeColors();
  const primary = state === 'setup';
  const button = primary ? () => navigate(sourceCount ? 'connections' : 'sources') : state === 'syncing' ? pause : state === 'attention' ? () => navigate('activity') : paused ? resume : run;
  const label = primary ? t(sourceCount ? 'statusUi.chooseTarget' : 'statusUi.chooseSources') : state === 'syncing' ? t('statusUi.pause') : state === 'attention' ? t('statusUi.review') : paused ? t('statusUi.resume') : t('statusUi.backupNow');
  const Icon = state === 'syncing' ? Pause : paused ? Play : RefreshCw;
  return <ScrollView className="flex-1 bg-background" contentContainerClassName="gap-5 px-5 pb-10 pt-5">
    <View className="flex-row items-center justify-between gap-3">
      <Text accessibilityRole="header" className="text-[34px] leading-10 font-inter-bold text-primary-text">{t('statusUi.title')}</Text>
      <Pressable className="min-h-12 min-w-12 items-center justify-center rounded-full border border-border-subtle bg-surface-1" accessibilityRole="button" accessibilityLabel={t('statusUi.history')} onPress={() => navigate('activity')}><History size={21} color={c['text-primary']} /></Pressable>
    </View>
    <StatusHero state={state} destinations={targets.filter(target => target.state !== 'disabled').map(target => target.kind)} />
    <View className="items-center gap-3" accessibilityLiveRegion="polite">
      <Text accessibilityRole="header" className="text-center text-2xl leading-8 font-inter-bold text-primary-text">{t(`statusUi.states.${state}`)}</Text>
      <Text className="max-w-xs text-center text-[15px] leading-5 font-sans text-secondary-text">{t(`statusUi.lines.${state}`)}</Text>
      {progress && <View className="w-full max-w-[280px] gap-2"><ByteProgress label={t('statusUi.progressLabel')} percent={progress.percent} /><Text className="text-center text-xs font-sans text-tertiary-text">{t(`statusUi.progress.${progress.kind}`, { completed: progress.completed, total: progress.total })}</Text></View>}
      {(primary || action) && <Pressable className={`min-h-12 flex-row items-center justify-center gap-2 rounded-xl border px-5 py-3 ${primary ? 'bg-button-brand border-button-brand' : 'bg-surface-2 border-border-subtle'}`}
        accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: working }} disabled={working} onPress={button}>
        {!primary && <Icon size={19} color={c['text-primary']} />}<Text className={`text-sm font-inter-semibold ${primary ? 'text-on-brand' : 'text-primary-text'}`}>{label}</Text>
      </Pressable>}
    </View>
    <View className="gap-2"><View className="flex-row items-center justify-between">
      <Text accessibilityRole="header" className="text-base font-inter-semibold text-primary-text">{t('statusUi.targets')}</Text>
      <Pressable className="min-h-12 justify-center px-2" accessibilityRole="button" onPress={() => navigate('connections')}><Text className="font-sans text-sm text-brand-text">{t('statusUi.allTargets')}</Text></Pressable>
    </View>
      <View className="overflow-hidden rounded-2xl border border-border-subtle bg-surface-1">
        {targets.length ? targets.map((target, i) => {
          const TargetIcon = target.kind === 'pc' ? Monitor : target.kind === 'cloud' ? Cloud : Server;
          return <Pressable key={target.id} className={`min-h-16 flex-row items-center gap-3 px-4 py-3 ${i ? 'border-t border-border-subtle' : ''}`} accessibilityRole="button" onPress={() => navigate(target.page)}>
            <TargetIcon size={22} color={c['text-secondary']} /><View className="min-w-0 flex-1 gap-1"><Text className="font-inter-semibold text-sm text-primary-text">{target.label}</Text>
              <View className="flex-row items-center gap-2"><View className={`h-1.5 w-1.5 rounded-full ${target.state === 'error' ? 'bg-danger' : target.state === 'attention' ? 'bg-attention' : target.state === 'safe' || target.state === 'syncing' ? 'bg-brand' : 'bg-border-strong'}`} /><Text className="font-sans text-xs text-secondary-text">{t(`statusUi.states.${target.state}`)}</Text></View></View>
          </Pressable>;
        }) : <Pressable className="min-h-16 justify-center gap-1 px-4 py-3" accessibilityRole="button" onPress={() => navigate('connections')}><Text className="font-inter-semibold text-sm text-primary-text">{t('statusUi.chooseTarget')}</Text><Text className="font-sans text-xs text-secondary-text">{t('statusUi.explicitTarget')}</Text></Pressable>}
      </View>
    </View>
    <Pressable className="min-h-16 flex-row items-center gap-3 rounded-2xl border border-border-subtle bg-surface-1 px-4 py-3" accessibilityRole="button" onPress={() => navigate('activity')}>
      <Clock3 size={22} color={c['text-secondary']} /><View className="flex-1 gap-1"><Text className="font-inter-semibold text-base text-primary-text">{t('statusUi.activity')}</Text><Text className="font-sans text-sm text-secondary-text">{t('statusUi.activityLine')}</Text></View>
    </Pressable>
  </ScrollView>;
}
