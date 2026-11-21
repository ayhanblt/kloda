// Test-only capture protocol (2.5 / D25-M). Not part of the product bundle or navigation.
// The host announces one allowlisted phase at a time; the entry reports measured state
// for exactly that runID/phase/nonce and never forwards native payloads or error text.

export const captureLocales = ['tr', 'en', 'de'] as const;
export const captureThemes = ['light', 'dark'] as const;
export const captureSizes = ['normal', 'large'] as const;

export interface CapturePhase {
  runID: string;
  phase: number;
  nonce: string;
  /** Host token, replaced after each screenshot; echoed by reports measured from this phase. */
  probe: string;
  screen: string;
  locale: (typeof captureLocales)[number];
  theme: (typeof captureThemes)[number];
  size: (typeof captureSizes)[number];
}

export interface CaptureReport {
  runID: string;
  phase: number;
  nonce: string;
  probe: string;
  screen: string;
  language: string;
  themeMode: string;
  fontScale: number;
  fontsLoaded: boolean;
  fontError: boolean;
  appState: string;
  layoutReady: boolean;
  width: number;
  height: number;
  /** Measured vertical scroll state for scroll screens; null for every other screen. */
  scroll: { offset: number; content: number; visible: number; atEnd: boolean } | null;
  /** Why `scroll` is absent on a scroll screen; null on other screens. */
  scrollNote: string | null;
}

const token = /^[a-f0-9]{16,64}$/;
const oneOf = <T extends string>(values: readonly T[], value: unknown): value is T =>
  typeof value === 'string' && (values as readonly string[]).includes(value);

/** Strict parse: unknown keys, foreign runID or non-allowlisted values yield null. */
export function parsePhase(value: unknown, runID: string, screens: readonly string[]): CapturePhase | null {
  if (typeof value !== 'object' || value === null) return null;
  const phase = value as Record<string, unknown>;
  const keys = ['runID', 'phase', 'nonce', 'probe', 'screen', 'locale', 'theme', 'size'];
  if (Object.keys(phase).some((key) => !keys.includes(key))) return null;
  if (phase.runID !== runID || typeof phase.nonce !== 'string' || !token.test(phase.nonce)) return null;
  if (typeof phase.probe !== 'string' || !token.test(phase.probe)) return null;
  if (typeof phase.phase !== 'number' || !Number.isInteger(phase.phase) || phase.phase < 1) return null;
  if (!oneOf(screens, phase.screen) || !oneOf(captureLocales, phase.locale)) return null;
  if (!oneOf(captureThemes, phase.theme) || !oneOf(captureSizes, phase.size)) return null;
  return phase as unknown as CapturePhase;
}

export interface CaptureHost {
  runID: string;
  phaseUrl: string;
  reportUrl: string;
}

/** Bundle-time host binding from the owned Metro process; absent values disable the entry. */
export function captureHost(port: string | undefined, runID: string | undefined): CaptureHost | null {
  if (!port || !/^[0-9]{2,5}$/.test(port) || !runID || !token.test(runID)) return null;
  const base = `http://127.0.0.1:${port}`;
  return { runID, phaseUrl: `${base}/phase`, reportUrl: `${base}/report` };
}
