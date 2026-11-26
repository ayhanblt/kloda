import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { History, Lock, Pause, Play, RefreshCw } from 'lucide-react-native';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { Text } from '../../../shared/ui/text';
import { RichCard } from '../../../shared/ui/rich';
import { HeroEmptyVisual } from '../../../shared/ui/hero-empty-visual';
import { gallery, type GalleryPage } from '../../../shared/api/gallery';
import { useThemeColors } from '../../../shared/theme/theme-provider';
import type { NavigateMobile } from '../../../shared/model/mobile-navigation';
import { homeStatus, otherTargetState, type HomeState, type StatusProgress } from '../model/home-status';
import { useHomeStatus } from '../model/use-home-status';
import { HeroMosaic, type HeroPhoto } from './hero-mosaic';
import { ConfiguredHomeSection, SetupHomeSection, type StatusTarget } from './status-sections';

interface StatusViewProps {
  state: HomeState;
  progress?: StatusProgress;
  targets: StatusTarget[];
  sourceCount: number;
  paused: boolean;
  working: boolean;
  navigate: NavigateMobile;
  run: () => void;
  pause: () => void;
  resume: () => void;
  // The action drives only the PC queue and the original WebDAV run; other destinations start from their own card.
  action?: boolean;
  heroPhotos?: HeroPhoto[];
  heroPermission?: GalleryPage['permission'] | null;
}

const styles = StyleSheet.create({
  fadeContainer: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 84 },
});

export function HomePage({ sourceCount, navigate }: { sourceCount: number; navigate: NavigateMobile }) {
  const { t } = useTranslation();
  const model = useHomeStatus(sourceCount);
  const { transfer, webdav, pcSelected, others } = model;
  const [heroPhotos, setHeroPhotos] = useState<HeroPhoto[]>([]);
  const [heroPermission, setHeroPermission] = useState<GalleryPage['permission'] | null>(null);

  useEffect(() => {
    let alive = true;
    const loadHero = async () => {
      try {
        const sources = await gallery.sources();
        if (!alive) return;
        const first = sources[0];
        if (!first) { setHeroPhotos([]); setHeroPermission(null); return; }
        const page = await gallery.page(first.id, 0);
        if (!alive) return;
        setHeroPermission(page.permission);
        if (page.permission === 'denied' || page.items.length === 0) { setHeroPhotos([]); return; }
        const top = page.items.slice(0, 4);
        const previews = await Promise.all(top.map(async (item) => {
          const uri = await gallery.preview(first.id, item.id);
          return uri ? { id: item.id, uri } : null;
        }));
        if (alive) setHeroPhotos(previews.filter((item): item is HeroPhoto => item !== null));
      } catch {
        if (alive) setHeroPhotos([]);
      }
    };
    void loadHero();
    return () => { alive = false; };
  }, [sourceCount]);

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
  return (
    <StatusView
      state={model.state}
      progress={model.progress}
      targets={targets}
      sourceCount={sourceCount}
      paused={transfer.queue?.automaticPaused === true || webdav.status?.run?.state === 'paused'}
      working={transfer.working || webdav.working}
      action={pcSelected === true || webdav.status?.enabled === true || !others.some(target => target.enabled)}
      navigate={navigate}
      run={() => { void transfer.run(); }}
      pause={() => { void transfer.pause(); }}
      resume={() => { void resume(); }}
      heroPhotos={heroPhotos}
      heroPermission={heroPermission}
    />
  );
}

export function StatusView({
  state,
  progress,
  targets,
  sourceCount,
  paused,
  working,
  navigate,
  run,
  pause,
  resume,
  action = true,
  heroPhotos = [],
  heroPermission = null,
}: StatusViewProps) {
  const { t } = useTranslation();
  const c = useThemeColors();
  const primary = state === 'setup';
  const buttonBrand = primary || state === 'safe' || state === 'error' || state === 'attention';
  const button = primary ? () => navigate(sourceCount ? 'computer' : 'sources') : state === 'syncing' ? pause : state === 'attention' ? () => navigate('activity') : paused ? resume : run;
  const label = primary ? t(sourceCount ? 'statusUi.chooseTarget' : 'statusUi.chooseSources') : state === 'syncing' ? t('statusUi.pause') : state === 'attention' ? t('statusUi.review') : paused ? t('statusUi.resume') : t('statusUi.backupNow');
  const Icon = state === 'syncing' ? Pause : paused ? Play : RefreshCw;
  const heroDotClass = state === 'error' ? 'bg-danger' : state === 'attention' ? 'bg-attention' : state === 'safe' || state === 'syncing' ? 'bg-brand' : 'bg-tertiary-text';
  const activeDestinations = targets.filter((target) => target.state !== 'disabled').map((target) => target.kind);
  const filledSegments = progress ? Math.max(1, Math.min(12, Math.round((progress.percent / 100) * 12))) : 0;

  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="gap-4 px-4 pb-28 pt-4">
      <View className="min-h-11 flex-row items-center justify-between gap-3 px-1">
        <Text className="text-xl font-inter-semibold text-primary-text">{t('statusUi.title')}</Text>
        {!primary && (
          <Pressable
            className="h-10 w-10 items-center justify-center rounded-full border border-border-subtle bg-surface-2 active:opacity-80"
            accessibilityRole="button"
            accessibilityLabel={t('statusUi.history')}
            onPress={() => navigate('activity')}
          >
            <History size={19} color={c['text-primary']} />
          </Pressable>
        )}
      </View>

      <RichCard>
        <View className="relative bg-surface-2">
          {heroPhotos.length > 0 ? (
            <HeroMosaic photos={heroPhotos} dimmed={primary} />
          ) : (
            <HeroEmptyVisual
              visual={primary || heroPermission === 'denied' ? { kind: 'reason', reason: 'lock' } : { kind: 'path' }}
              state={state}
              destinations={activeDestinations}
              className="aspect-[1.75] w-full"
            />
          )}
          <View pointerEvents="none" style={styles.fadeContainer}>
            <Svg width="100%" height={84} viewBox="0 0 100 84" preserveAspectRatio="none" accessible={false}>
              <Defs>
                <LinearGradient id="heroFade" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor={c['surface-1']} stopOpacity="0" />
                  <Stop offset="0.55" stopColor={c['surface-1']} stopOpacity="0.65" />
                  <Stop offset="1" stopColor={c['surface-1']} stopOpacity="1" />
                </LinearGradient>
              </Defs>
              <Rect x={0} y={0} width={100} height={84} fill="url(#heroFade)" />
            </Svg>
          </View>
          <View className="absolute left-3 top-3 flex-row items-center gap-2 rounded-full border border-border-subtle bg-background/90 px-3 py-1.5">
            <View className={`h-[7px] w-[7px] rounded-full ${heroDotClass}`} />
            <Text className="font-inter-medium text-xs text-primary-text">
              {primary ? t('statusUi.chipSetup') : t(`statusUi.states.${state}`)}
            </Text>
          </View>
          {primary && heroPhotos.length > 0 && (
            <View pointerEvents="none" className="absolute inset-0 items-center justify-center">
              <View className="flex-row items-center gap-2 rounded-full border border-border-subtle bg-surface-1/95 px-4 py-2">
                <Lock size={14} color={c['brand-text']} />
                <Text className="text-xs font-inter-semibold text-primary-text">{t('statusUi.setupWaitingPill')}</Text>
              </View>
            </View>
          )}
        </View>

        <View className="gap-2 px-5 pb-5 pt-1" accessibilityLiveRegion="polite">
          <Text accessibilityRole="header" className="text-[28px] font-inter-semibold leading-9 text-primary-text">
            {t(`statusUi.states.${state}`)}
          </Text>
          <Text className="font-sans text-sm leading-5 text-secondary-text">
            {t(`statusUi.lines.${state}`)}
          </Text>

          {(heroPermission === 'denied' || (primary && heroPhotos.length === 0)) && (
            <View className="mt-2 flex-row items-center gap-3 rounded-2xl bg-surface-2 p-3.5">
              <View className="min-w-0 flex-1 gap-0.5">
                <Text className="text-sm font-inter-semibold text-primary-text">{t('statusUi.heroNoPermTitle')}</Text>
                <Text className="font-sans text-xs text-secondary-text">{t('statusUi.heroNoPermBody')}</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('statusUi.heroAllow')}
                onPress={() => navigate('sources')}
                className="min-h-9 shrink-0 justify-center rounded-full border border-border-strong bg-surface-1 px-3.5 py-1.5 active:opacity-80"
              >
                <Text className="text-xs font-inter-semibold text-primary-text">{t('statusUi.heroAllow')}</Text>
              </Pressable>
            </View>
          )}

          {progress && (
            <View className="mt-2 gap-2">
              <View
                accessible
                accessibilityRole="progressbar"
                accessibilityLabel={t('statusUi.progressLabel')}
                accessibilityValue={{ min: 0, max: 100, now: Math.round(progress.percent) }}
                className="flex-row gap-1"
              >
                {Array.from({ length: 12 }, (_, index) => (
                  <View
                    key={index}
                    className={`h-1.5 flex-1 rounded-full ${index < filledSegments ? 'bg-brand' : 'bg-surface-2'}`}
                  />
                ))}
              </View>
              <Text className="font-sans text-xs text-tertiary-text">
                {t(`statusUi.progress.${progress.kind}`, { completed: progress.completed, total: progress.total })}
              </Text>
            </View>
          )}

          {!primary && action && (
            <View className="mt-2 flex-row items-center justify-between gap-3">
              <Text className="min-w-0 flex-1 font-sans text-xs text-secondary-text">
                {t(`statusUi.states.${state}`)}
              </Text>
              <Pressable
                className={`min-h-10 shrink-0 flex-row items-center justify-center gap-2 rounded-full border px-4 py-2 ${buttonBrand ? 'border-button-brand bg-button-brand' : 'border-border-strong bg-surface-2'} ${working ? 'opacity-50' : ''}`}
                accessibilityRole="button"
                accessibilityLabel={label}
                accessibilityState={{ disabled: working }}
                disabled={working}
                onPress={button}
              >
                <Icon size={16} color={buttonBrand ? c['on-brand'] : c['text-primary']} />
                <Text className={`text-sm font-inter-semibold ${buttonBrand ? 'text-on-brand' : 'text-primary-text'}`}>{label}</Text>
              </Pressable>
            </View>
          )}
        </View>
      </RichCard>

      {primary ? (
        <SetupHomeSection
          sourceCount={sourceCount}
          targetsCount={targets.length}
          label={label}
          working={working}
          onPrimary={button}
          navigate={navigate}
        />
      ) : (
        <ConfiguredHomeSection state={state} targets={targets} navigate={navigate} />
      )}
    </ScrollView>
  );
}
