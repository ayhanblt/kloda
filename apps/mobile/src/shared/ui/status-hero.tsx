import { View } from 'react-native';
import Svg, { Circle, G, Path, Rect } from 'react-native-svg';
import { useReducedMotion } from 'react-native-reanimated';
import type { HomeState, DestinationKind } from '../model/home-status';
import { useThemeColors } from '../theme/theme-provider';

export function StatusHero({ state, destinations }: { state: HomeState; destinations: DestinationKind[] }) {
  const c = useThemeColors();
  const reduced = useReducedMotion();
  const brand = c['brand-base'], line = c['illus-line'];
  const shade = state === 'safe' ? c['brand-line'] : line;
  const badge = state === 'error' ? c['danger-base'] : state === 'attention' ? c['attention-base'] : state === 'safe' ? brand : line;
  const kind = destinations[0] ?? 'pc';
  return <View className="mx-auto w-full max-w-[358px]" accessible={false}>
    <Svg width="100%" height={200} viewBox="0 0 358 200" accessible={false}>
      <Circle cx={179} cy={100} r={88} fill="none" stroke={line} strokeWidth={1} strokeDasharray="1 5" strokeLinecap="round" />
      {state === 'safe' && <G><Circle cx={179} cy={100} r={70} fill={c['brand-halo-2']} /><Circle cx={179} cy={100} r={50} fill={c['brand-halo-1']} /></G>}
      <Path d="M98 100 Q121 76 145 100" fill="none" stroke={shade} strokeWidth={1.5} strokeDasharray={state === 'syncing' ? '1 6' : state === 'waiting' || state === 'setup' ? '4 5' : undefined} />
      <Path d={state === 'error' ? 'M213 100 Q220 91 227 89 M240 89 Q246 91 252 96' : 'M213 100 Q233 76 252 96'} fill="none" stroke={shade} strokeWidth={1.5} />
      <Rect x={40} y={52} width={54} height={96} rx={11} fill={c['illus-body']} stroke={line} strokeWidth={1.5} />
      <Rect x={45} y={60} width={44} height={80} rx={6} fill={c['illus-screen']} />
      {(['1','2','3','4','5','6'] as const).map((n, i) => <Rect key={n} x={49 + i % 2 * 19} y={65 + Math.floor(i / 2) * 24} width={17} height={21} rx={3} fill={c[`illus-photo-${n}`]} />)}
      <Rect x={147} y={68} width={64} height={64} rx={18} fill={c.tile} stroke={line} strokeWidth={1.5} />
      <Circle cx={179} cy={100} r={14} fill="none" stroke={state === 'syncing' ? brand : c['tile-ring']} strokeWidth={5} strokeLinecap="round" strokeDasharray={state === 'syncing' ? '58 88' : '64 24'} transform="rotate(-90 179 100)" />
      <Circle cx={179} cy={100} r={4.5} fill={brand} />
      {destinations.slice(1, 3).map((other, i) => <G key={other + i} transform={`translate(${282 + i * 18} ${38 - i * 8}) scale(${0.68 - i * 0.06})`} opacity={0.6}>
        <Rect x={6} y={2} width={80} height={54} rx={5} fill={c['illus-body']} stroke={line} strokeWidth={1.5} />
      </G>)}
      <G transform="translate(250 56)" opacity={state === 'waiting' ? 0.5 : 1}>
        {kind === 'pc' ? <G>
          <Rect x={10} y={6} width={76} height={52} rx={5} fill={c['illus-body']} stroke={line} strokeWidth={1.5} strokeDasharray={state === 'setup' ? '4 4' : undefined} />
          <Rect x={15} y={11} width={66} height={42} rx={2} fill={c['illus-screen']} />
          <Rect x={20} y={16} width={20} height={13} rx={2} fill={c['illus-photo-2']} />
          <Path d="M46 19h22M46 25h14" stroke={line} strokeWidth={1.5} />
          <Rect x={20} y={34} width={11} height={9} rx={1.5} fill={c['illus-photo-1']} />
          <Rect x={34} y={34} width={11} height={9} rx={1.5} fill={c['illus-photo-3']} />
          <Path d="M2 62h92l-5 6H7z" fill={c['illus-body']} stroke={line} strokeWidth={1.5} />
        </G> : kind === 'nas' ? <G><Rect x={20} y={4} width={52} height={64} rx={6} fill={c['illus-body']} stroke={line} strokeWidth={1.5} /><Rect x={28} y={16} width={36} height={12} rx={2} fill={c['illus-screen']} /><Rect x={28} y={34} width={36} height={12} rx={2} fill={c['illus-screen']} /><Circle cx={36} cy={56} r={2.5} fill={brand} /></G> : <Path d="M22 62h50a15 15 0 0 0 2-30 23 23 0 0 0-44-4 17 17 0 0 0-8 34z" fill={c['illus-body']} stroke={line} strokeWidth={1.5} />}
        {state !== 'setup' && state !== 'syncing' && <G><Circle cx={82} cy={12} r={11} fill={badge} />
          {state === 'safe' && <Path d="m77 12 3.5 3.5L87 9" stroke={c.tile} strokeWidth={2} fill="none" strokeLinecap="round" />}
          {(state === 'attention' || state === 'error') && <Path d={state === 'error' ? 'm78 8 8 8m0-8-8 8' : 'M82 6v8m0 3v.5'} fill="none" stroke={c.tile} strokeWidth={2} />}
        </G>}
      </G>
    </Svg>
    {state === 'syncing' && <View className={`absolute left-1/2 -ml-1 top-[96px] h-2 w-2 rounded-full bg-brand ${reduced ? '' : 'animate-pulse motion-reduce:animate-none'}`} />}
  </View>;
}
