// Test-only capture entry (2.5 / D25-M). Loaded only by the owned capture Metro process
// into a disposable fixture bundle on a run-created Simulator; the product entry is unchanged.
import 'react-native-gesture-handler';
import '../global.css';
import { i18n } from '../src/shared/i18n';
import { registerRootComponent } from 'expo';
import { useFonts } from 'expo-font';
import { cssInterop } from 'nativewind';
import { useEffect, useState } from 'react';
import { AppState, View, useWindowDimensions } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider, useTheme } from '../src/shared/theme/theme-provider';
import interRegular from '../../../assets/fonts/inter/Inter-Regular.ttf';
import interMedium from '../../../assets/fonts/inter/Inter-Medium.ttf';
import interSemiBold from '../../../assets/fonts/inter/Inter-SemiBold.ttf';
import interBold from '../../../assets/fonts/inter/Inter-Bold.ttf';
import { captureHost, parsePhase, type CaptureHost, type CapturePhase, type CaptureReport } from './protocol';
import { CaptureScreen, captureScreenNames } from './screens';

const host = captureHost(process.env.EXPO_PUBLIC_KLODA_CAPTURE_PORT, process.env.EXPO_PUBLIC_KLODA_CAPTURE_RUN);
const GestureRoot = cssInterop(GestureHandlerRootView, { className: 'style' });
const pollMs = 500;

function usePhase(binding: CaptureHost | null): CapturePhase | null {
  const [phase, setPhase] = useState<CapturePhase | null>(null);
  useEffect(() => {
    if (!binding) return;
    let alive = true;
    const poll = async () => {
      try {
        const response = await fetch(binding.phaseUrl);
        const next = parsePhase(await response.json(), binding.runID, captureScreenNames);
        if (alive) setPhase((current) => (current?.nonce === next?.nonce && current?.probe === next?.probe ? current : next));
      } catch {
        if (alive) setPhase(null);
      }
    };
    void poll();
    const timer = setInterval(() => void poll(), pollMs);
    return () => { alive = false; clearInterval(timer); };
  }, [binding]);
  return phase;
}

function useAppState(): string {
  const [state, setState] = useState<string>(AppState.currentState);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', setState);
    return () => subscription.remove();
  }, []);
  return state;
}

// Resend tick so a lost report is retried; not part of the report itself.
function useTick(nonce: string | undefined): number {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!nonce) return;
    const timer = setInterval(() => setTick((value) => value + 1), pollMs);
    return () => clearInterval(timer);
  }, [nonce]);
  return tick;
}

function Presented({ phase, binding }: { phase: CapturePhase | null; binding: CaptureHost | null }) {
  const theme = useTheme();
  const { fontScale, width, height } = useWindowDimensions();
  const [fontsLoaded, fontError] = useFonts({
    KlodaInterRegular: interRegular, KlodaInterMedium: interMedium,
    KlodaInterSemiBold: interSemiBold, KlodaInterBold: interBold,
  });
  const [applied, setApplied] = useState<string | null>(null);
  const [laidOut, setLaidOut] = useState<string | null>(null);
  const nonce = phase?.nonce;
  const appState = useAppState();
  const tick = useTick(nonce);
  useEffect(() => {
    if (!phase) return;
    let alive = true;
    theme.setPreference(phase.theme);
    void i18n.changeLanguage(phase.locale).then(() => { if (alive) setApplied(phase.nonce); });
    return () => { alive = false; };
    // Applying a phase is keyed by its nonce only; later renders must not re-apply it.
  }, [nonce]);
  useEffect(() => {
    if (!phase || !binding || applied !== phase.nonce || laidOut !== phase.nonce) return;
    const report: CaptureReport = {
      runID: phase.runID, phase: phase.phase, nonce: phase.nonce, probe: phase.probe, screen: phase.screen,
      language: i18n.language, themeMode: theme.mode, fontScale, fontsLoaded,
      fontError: Boolean(fontError), appState, layoutReady: true, width, height,
    };
    // Re-measured on every probe, tick and AppState change, from state rendered after the phase
    // carrying that probe was fetched; two frames after layout so it is the state on screen.
    const frame = requestAnimationFrame(() => requestAnimationFrame(() => {
      void fetch(binding.reportUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(report) }).catch(() => undefined);
    }));
    return () => cancelAnimationFrame(frame);
  }, [phase, binding, applied, laidOut, tick, appState, theme.mode, fontScale, fontsLoaded, fontError, width,
    height]);
  if (!phase || !(fontsLoaded || fontError)) return <View className="flex-1 bg-background" />;
  return <SafeAreaProvider>
    <GestureRoot className="flex-1">
      <View key={phase.nonce} className="flex-1" onLayout={() => setLaidOut(phase.nonce)}>
        <CaptureScreen name={phase.screen} />
      </View>
    </GestureRoot>
  </SafeAreaProvider>;
}

function CaptureRoot() {
  const phase = usePhase(host);
  return <ThemeProvider><Presented phase={phase} binding={host} /></ThemeProvider>;
}

registerRootComponent(CaptureRoot);
