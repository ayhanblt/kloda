// Test-only screen registry for the capture entry. Each adapter opens a real product page
// through its public props only; navigation and actions are inert, so no tab press, save,
// test, run, scan or permission request can start from a capture phase.
import type { ReactElement } from 'react';
import type { MobilePage } from '../src/shared/model/mobile-navigation';
import { MobileShell } from '../src/widgets/mobile-shell/ui';
import { WelcomePage } from '../src/pages/welcome/ui/welcome-page';
import { ProviderPage } from '../src/pages/connections/ui/provider-page';
import { SettingsPage } from '../src/pages/settings/ui/settings-page';

const inert = () => undefined;

interface CaptureScreenAdapter {
  // Pages the product renders inside MobileShell; welcome is shell-free as in App.tsx.
  page?: MobilePage;
  render: () => ReactElement;
}

// Keys must equal the `screen` of every ready ios-native-entry matrix row (checked by the runner).
const captureScreens: Record<string, CaptureScreenAdapter> = {
  'welcome': { render: () => <WelcomePage onStart={inert} onSkip={inert} /> },
  'settings': { page: 'settings', render: () => <SettingsPage navigate={inert} /> },
  'provider-generic': { page: 'provider', render: () => <ProviderPage provider="box" onBack={inert} /> },
};

export const captureScreenNames: readonly string[] = Object.keys(captureScreens);

export function CaptureScreen({ name }: { name: string }) {
  const screen = captureScreens[name];
  if (!screen) return null;
  if (!screen.page) return screen.render();
  return <MobileShell page={screen.page} navigate={inert}>{screen.render()}</MobileShell>;
}
