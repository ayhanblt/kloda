import { useEffect, useState } from 'react';
import { Camera, Folder, Lock } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import Reanimated, {
  Easing,
  cancelAnimation,
  createAnimatedComponent,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import type { DestinationKind, HomeState } from '../model/home-status';
import { useThemeColors } from '../theme/theme-provider';
import { StatusHero } from './status-hero';

const AnimatedView =
  Reanimated?.View ??
  (typeof createAnimatedComponent === 'function' ? createAnimatedComponent(View) : View);

export type HeroReason = 'lock' | 'folder' | 'camera';
export type HeroVisual =
  | { kind: 'path' }
  | { kind: 'frames' }
  | { kind: 'reason'; reason: HeroReason };

function wave(y: number, a: number) {
  return `M-180 ${y} q45 ${-a} 90 0${' t90 0'.repeat(11)} L900 200 L-180 200 Z`;
}

const styles = StyleSheet.create({
  fill: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' },
  waveLayer: { position: 'absolute', top: 0, left: 0, height: '100%' },
});

/** Soft sand-toned backdrop with gently drifting waves; stays static under Reduce Motion. */
export function CalmTexture() {
  const c = useThemeColors();
  const reduced = useReducedMotion();
  const [size, setSize] = useState({ width: 358, height: 200 });
  const drift1 = useSharedValue(0);
  const drift2 = useSharedValue(0);
  const shift = size.width * (180 / 358);

  useEffect(() => {
    if (reduced) {
      cancelAnimation(drift1);
      cancelAnimation(drift2);
      drift1.value = 0;
      drift2.value = 0;
      return;
    }
    drift1.value = 0;
    drift2.value = -shift;
    drift1.value = withRepeat(withTiming(-shift, { duration: 22000, easing: Easing.linear }), -1, false);
    drift2.value = withRepeat(withTiming(0, { duration: 34000, easing: Easing.linear }), -1, false);
    return () => {
      cancelAnimation(drift1);
      cancelAnimation(drift2);
    };
  }, [reduced, shift, drift1, drift2]);

  const wave1Style = useAnimatedStyle(() => ({ transform: [{ translateX: drift1.value }] }));
  const wave2Style = useAnimatedStyle(() => ({ transform: [{ translateX: drift2.value }] }));
  const svgWidth = size.width * 2;

  return (
    <View
      style={styles.fill}
      className="overflow-hidden bg-surface-2"
      accessible={false}
      onLayout={(event) => {
        const { width, height } = event.nativeEvent.layout;
        if (width > 0 && height > 0 && (Math.abs(width - size.width) > 1 || Math.abs(height - size.height) > 1)) {
          setSize({ width, height });
        }
      }}
    >
      <View pointerEvents="none" style={[styles.waveLayer, { width: svgWidth }]}>
        <AnimatedView collapsable={false} style={wave1Style}>
          <Svg width={svgWidth} height={size.height} viewBox="0 0 716 200" preserveAspectRatio="none" accessible={false}>
            <Rect x={0} y={0} width={716} height={200} fill={c['surface-2']} />
            <Path d={wave(132, 26)} fill={c['brand-halo-2']} />
            <Path d={wave(184, 12)} fill={c['brand-halo-2']} />
          </Svg>
        </AnimatedView>
      </View>
      <View pointerEvents="none" style={[styles.waveLayer, { width: svgWidth }]}>
        <AnimatedView collapsable={false} style={wave2Style}>
          <Svg width={svgWidth} height={size.height} viewBox="0 0 716 200" preserveAspectRatio="none" accessible={false}>
            <Path d={wave(160, 18)} fill={c['brand-halo-1']} />
          </Svg>
        </AnimatedView>
      </View>
    </View>
  );
}

/** 4-frame dashed skeleton mosaic shown while discovering gallery sources. */
export function EmptyFrames() {
  const reduced = useReducedMotion();
  const pulse = useSharedValue(0.85);

  useEffect(() => {
    if (reduced) {
      cancelAnimation(pulse);
      pulse.value = 1;
      return;
    }
    pulse.value = 0.85;
    pulse.value = withRepeat(withTiming(0.45, { duration: 1300, easing: Easing.inOut(Easing.ease) }), -1, true);
    return () => cancelAnimation(pulse);
  }, [reduced, pulse]);

  const cellStyle = useAnimatedStyle(() => ({ flex: 1, opacity: pulse.value }));

  return (
    <View style={styles.fill} accessible={false}>
      <AnimatedView collapsable={false} style={cellStyle}>
        <View className="flex-1 flex-row gap-1 p-1.5">
          <View className="flex-1 rounded-xl border border-dashed border-border-strong bg-surface-1/70" />
          <View className="flex-1 gap-1">
            <View className="flex-1 rounded-xl border border-dashed border-border-strong bg-surface-1/70" />
            <View className="flex-1 flex-row gap-1">
              <View className="flex-1 rounded-xl border border-dashed border-border-strong bg-surface-1/70" />
              <View className="flex-1 rounded-xl border border-dashed border-border-strong bg-surface-1/70" />
            </View>
          </View>
        </View>
      </AnimatedView>
    </View>
  );
}

const reasonIcons = { lock: Lock, folder: Folder, camera: Camera } as const;

/** Centered reason icon on a warm halo when photos cannot be shown. */
export function ReasonMark({ reason }: { reason: HeroReason }) {
  const c = useThemeColors();
  const Icon = reasonIcons[reason];
  return (
    <View style={styles.fill} className="items-center justify-center" accessible={false}>
      <View className="relative h-16 w-16 items-center justify-center rounded-3xl border border-border-subtle bg-surface-1">
        <View className="absolute -inset-4 rounded-full bg-brand-subtle" />
        <Icon size={28} strokeWidth={1.5} color={c['brand-text']} />
      </View>
    </View>
  );
}

/** Photo-less hero: calm drifting texture underneath, situation-specific visual on top. */
export function HeroEmptyVisual({
  visual,
  state = 'syncing',
  destinations = [],
  className,
}: {
  visual: HeroVisual;
  state?: HomeState;
  destinations?: DestinationKind[];
  className?: string;
}) {
  return (
    <View className={`relative justify-center overflow-hidden bg-surface-2 ${className ?? ''}`} accessible={false}>
      <CalmTexture />
      {visual.kind === 'frames' && <EmptyFrames />}
      {visual.kind === 'reason' && <ReasonMark reason={visual.reason} />}
      {visual.kind === 'path' && <StatusHero state={state} destinations={destinations} />}
    </View>
  );
}
