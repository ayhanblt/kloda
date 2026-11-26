import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, G, Path, Rect } from 'react-native-svg';
import Reanimated, {
  Easing,
  cancelAnimation,
  createAnimatedComponent,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import type { HomeState, DestinationKind } from '../model/home-status';
import { useThemeColors } from '../theme/theme-provider';

const AnimatedView =
  Reanimated?.View ??
  (typeof createAnimatedComponent === 'function' ? createAnimatedComponent(View) : View);

const SAMPLE_TS = [0, 0.25, 0.5, 0.75, 1];
const SAMPLE_ALPHA = [0, 1, 1, 1, 0];

function curveXs(x0: number, x1: number, x2: number) {
  return SAMPLE_TS.map((t) => (1 - t) * (1 - t) * x0 + 2 * (1 - t) * t * x1 + t * t * x2);
}

function curveYs(y0: number, y1: number, y2: number) {
  return SAMPLE_TS.map((t) => (1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * y1 + t * t * y2);
}

const LEFT_XS = curveXs(98, 121, 145);
const LEFT_YS = curveYs(100, 76, 100);
const RIGHT_XS = curveXs(213, 233, 252);
const RIGHT_YS = curveYs(100, 76, 96);

const styles = StyleSheet.create({
  stage: {
    width: '100%',
    maxWidth: 358,
    aspectRatio: 358 / 200,
    alignSelf: 'center',
    position: 'relative',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    zIndex: 2,
  },
  rippleWrap: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    width: 64,
    height: 64,
    marginLeft: -32,
    marginTop: -32,
  },
  rippleCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1.25,
  },
  dotWrap: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: 6,
    height: 6,
    marginLeft: -3,
    marginTop: -3,
  },
  dotCircle: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  centerWrap: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    width: 10,
    height: 10,
    marginLeft: -5,
    marginTop: -5,
  },
  centerCircle: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
});

function RippleRing({ active, delayMs, borderColor }: { active: boolean; delayMs: number; borderColor: string }) {
  const phase = useSharedValue(0);
  useEffect(() => {
    if (!active) {
      cancelAnimation(phase);
      phase.value = 0;
      return;
    }
    phase.value = 0;
    phase.value = withDelay(delayMs, withRepeat(withTiming(1, { duration: 2800, easing: Easing.out(Easing.ease) }), -1, false));
    return () => cancelAnimation(phase);
  }, [active, delayMs, phase]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(phase.value, [0, 1], [0.6, 0]),
    transform: [{ scale: interpolate(phase.value, [0, 1], [1, 1.85]) }],
  }));

  return (
    <View pointerEvents="none" style={styles.rippleWrap}>
      <AnimatedView collapsable={false} style={animatedStyle}>
        <View style={[styles.rippleCircle, { borderColor }]} />
      </AnimatedView>
    </View>
  );
}

function TravelDot({
  active,
  delayMs,
  curve,
  fill,
  stageW,
  stageH,
}: {
  active: boolean;
  delayMs: number;
  curve: 'left' | 'right';
  fill: string;
  stageW: SharedValue<number>;
  stageH: SharedValue<number>;
}) {
  const progress = useSharedValue(0);
  const xs = curve === 'left' ? LEFT_XS : RIGHT_XS;
  const ys = curve === 'left' ? LEFT_YS : RIGHT_YS;

  useEffect(() => {
    if (!active) {
      cancelAnimation(progress);
      progress.value = 0;
      return;
    }
    progress.value = 0;
    progress.value = withDelay(delayMs, withRepeat(withTiming(1, { duration: 1600, easing: Easing.linear }), -1, false));
    return () => cancelAnimation(progress);
  }, [active, delayMs, progress]);

  const animatedStyle = useAnimatedStyle(() => {
    const x = interpolate(progress.value, SAMPLE_TS, xs) * (stageW.value / 358);
    const y = interpolate(progress.value, SAMPLE_TS, ys) * (stageH.value / 200);
    return {
      opacity: interpolate(progress.value, SAMPLE_TS, SAMPLE_ALPHA),
      transform: [{ translateX: x }, { translateY: y }],
    };
  });

  return (
    <View pointerEvents="none" style={styles.dotWrap}>
      <AnimatedView collapsable={false} style={animatedStyle}>
        <View style={[styles.dotCircle, { backgroundColor: fill }]} />
      </AnimatedView>
    </View>
  );
}

function PulseCenter({ active, fill }: { active: boolean; fill: string }) {
  const pulse = useSharedValue(0);
  useEffect(() => {
    if (!active) {
      cancelAnimation(pulse);
      pulse.value = 0;
      return;
    }
    pulse.value = 0;
    pulse.value = withRepeat(withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) }), -1, true);
    return () => cancelAnimation(pulse);
  }, [active, pulse]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(pulse.value, [0, 1], [1, 0.4]),
  }));

  return (
    <View pointerEvents="none" style={styles.centerWrap}>
      <AnimatedView collapsable={false} style={animatedStyle}>
        <View style={[styles.centerCircle, { backgroundColor: fill }]} />
      </AnimatedView>
    </View>
  );
}

export function StatusHero({
  state,
  destinations,
  className,
}: {
  state: HomeState;
  destinations: DestinationKind[];
  className?: string;
}) {
  const c = useThemeColors();
  const reduced = useReducedMotion();
  const animating = state === 'syncing' && !reduced;
  const stageW = useSharedValue(358);
  const stageH = useSharedValue(200);

  const brand = c['brand-base'], line = c['illus-line'];
  const shade = state === 'safe' ? c['brand-line'] : line;
  const badge = state === 'error' ? c['danger-base'] : state === 'attention' ? c['attention-base'] : state === 'safe' ? brand : line;
  const kind = destinations[0] ?? 'pc';

  return (
    <View
      style={styles.stage}
      className={className}
      accessible={false}
      onLayout={(event) => {
        const { width, height } = event.nativeEvent.layout;
        if (width > 0 && height > 0) {
          stageW.value = width;
          stageH.value = height;
        }
      }}
    >
      <Svg width="100%" height="100%" viewBox="0 0 358 200" accessible={false}>
        <Circle cx={179} cy={100} r={88} fill="none" stroke={line} strokeWidth={1} strokeDasharray="1 5" strokeLinecap="round" />
        {state === 'safe' && (
          <G>
            <Circle cx={179} cy={100} r={70} fill={c['brand-halo-2']} />
            <Circle cx={179} cy={100} r={50} fill={c['brand-halo-1']} />
          </G>
        )}
        <Path d="M98 100 Q121 76 145 100" fill="none" stroke={shade} strokeWidth={1.5} strokeDasharray={state === 'syncing' ? '1 6' : state === 'waiting' || state === 'setup' ? '4 5' : undefined} />
        <Path d={state === 'error' ? 'M213 100 Q220 91 227 89 M240 89 Q246 91 252 96' : 'M213 100 Q233 76 252 96'} fill="none" stroke={shade} strokeWidth={1.5} strokeDasharray={state === 'syncing' ? '1 6' : state === 'waiting' || state === 'setup' ? '4 5' : undefined} />
        <Rect x={40} y={52} width={54} height={96} rx={11} fill={c['illus-body']} stroke={line} strokeWidth={1.5} />
        <Rect x={45} y={60} width={44} height={80} rx={6} fill={c['illus-screen']} />
        {(['1', '2', '3', '4', '5', '6'] as const).map((n, i) => (
          <Rect
            key={n}
            x={49 + (i % 2) * 19}
            y={65 + Math.floor(i / 2) * 24}
            width={17}
            height={21}
            rx={3}
            fill={c[`illus-photo-${n}`]}
            stroke={state === 'syncing' && i >= 4 ? brand : undefined}
            strokeWidth={state === 'syncing' && i >= 4 ? 1.5 : 0}
          />
        ))}
        {state === 'syncing' && <Circle cx={179} cy={100} r={14} fill="none" stroke={c['tile-ring']} strokeWidth={5} opacity={0.25} />}
        <Circle cx={179} cy={100} r={14} fill="none" stroke={state === 'syncing' ? brand : c['tile-ring']} strokeWidth={5} strokeLinecap="round" strokeDasharray={state === 'syncing' ? '58 88' : '64 24'} transform="rotate(-90 179 100)" />
        <Circle cx={179} cy={100} r={4.5} fill={brand} />
        {destinations.slice(1, 3).map((other, i) => (
          <G key={other + i} transform={`translate(${282 + i * 18} ${38 - i * 8}) scale(${0.68 - i * 0.06})`} opacity={0.6}>
            <Rect x={6} y={2} width={80} height={54} rx={5} fill={c['illus-body']} stroke={line} strokeWidth={1.5} />
          </G>
        ))}
        <G transform="translate(250 56)" opacity={state === 'waiting' ? 0.5 : 1}>
          {kind === 'pc' ? (
            <G>
              <Rect x={10} y={6} width={76} height={52} rx={5} fill={c['illus-body']} stroke={line} strokeWidth={1.5} strokeDasharray={state === 'setup' ? '4 4' : undefined} />
              <Rect x={15} y={11} width={66} height={42} rx={2} fill={c['illus-screen']} />
              <Rect x={20} y={16} width={20} height={13} rx={2} fill={c['illus-photo-2']} />
              <Path d="M46 19h22M46 25h14" stroke={line} strokeWidth={1.5} />
              <Rect x={20} y={34} width={11} height={9} rx={1.5} fill={c['illus-photo-1']} />
              <Rect x={34} y={34} width={11} height={9} rx={1.5} fill={c['illus-photo-3']} />
              <Path d="M2 62h92l-5 6H7z" fill={c['illus-body']} stroke={line} strokeWidth={1.5} />
            </G>
          ) : kind === 'nas' ? (
            <G>
              <Rect x={20} y={4} width={52} height={64} rx={6} fill={c['illus-body']} stroke={line} strokeWidth={1.5} />
              <Rect x={28} y={16} width={36} height={12} rx={2} fill={c['illus-screen']} />
              <Rect x={28} y={34} width={36} height={12} rx={2} fill={c['illus-screen']} />
              <Circle cx={36} cy={56} r={2.5} fill={brand} />
            </G>
          ) : (
            <Path d="M22 62h50a15 15 0 0 0 2-30 23 23 0 0 0-44-4 17 17 0 0 0-8 34z" fill={c['illus-body']} stroke={line} strokeWidth={1.5} />
          )}
          {state !== 'setup' && state !== 'syncing' && (
            <G>
              <Circle cx={82} cy={12} r={11} fill={badge} />
              {state === 'safe' && <Path d="m77 12 3.5 3.5L87 9" stroke={c.tile} strokeWidth={2} fill="none" strokeLinecap="round" />}
              {(state === 'attention' || state === 'error') && <Path d={state === 'error' ? 'm78 8 8 8m0-8-8 8' : 'M82 6v8m0 3v.5'} fill="none" stroke={c.tile} strokeWidth={2} />}
            </G>
          )}
        </G>
      </Svg>
      {animating && (
        <View pointerEvents="none" collapsable={false} style={styles.overlay}>
          <RippleRing active={animating} delayMs={0} borderColor={c['brand-line']} />
          <RippleRing active={animating} delayMs={1400} borderColor={c['brand-line']} />
          <TravelDot active={animating} delayMs={0} curve="left" fill={brand} stageW={stageW} stageH={stageH} />
          <TravelDot active={animating} delayMs={530} curve="left" fill={brand} stageW={stageW} stageH={stageH} />
          <TravelDot active={animating} delayMs={1060} curve="left" fill={brand} stageW={stageW} stageH={stageH} />
          <TravelDot active={animating} delayMs={250} curve="right" fill={brand} stageW={stageW} stageH={stageH} />
          <TravelDot active={animating} delayMs={780} curve="right" fill={brand} stageW={stageW} stageH={stageH} />
          <TravelDot active={animating} delayMs={1310} curve="right" fill={brand} stageW={stageW} stageH={stageH} />
          <PulseCenter active={animating} fill={brand} />
        </View>
      )}
    </View>
  );
}
