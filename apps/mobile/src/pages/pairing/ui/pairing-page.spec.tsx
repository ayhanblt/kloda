import { fireEvent, render } from '@testing-library/react-native';
import { PairingPage } from './pairing-page';
import type { PairingSnapshot } from '../../../features/pairing/model/pairing-controller';
import { i18n } from '../../../shared/i18n';

let mockSnapshot: PairingSnapshot;
let mockForeground = true;
jest.mock('sonner-native', () => ({ toast: { error: jest.fn(), success: jest.fn() } }));
jest.mock('../../../features/pairing/model/use-pairing', () => ({ usePairing: () => ({
  snapshot: mockSnapshot, foreground: mockForeground, armScan: jest.fn(), scan: jest.fn(), stopScanning: jest.fn(),
  cancel: jest.fn(), resume: jest.fn(), refresh: jest.fn(), decide: jest.fn(), removePairing: jest.fn(),
}) }));
beforeEach(() => {
  mockForeground = true;
  mockSnapshot = { status: { phase: 'complete', recordId: 'AAAAAAAAAAAAAAAAAAAAAA', peerFingerprint: 'fixture-pc' },
    error: null, uncertain: false, action: null, scanLocked: true };
});

it('opens Activity explicitly after verified pairing without granting access or starting an upload', async () => {
  const next = jest.fn();
  const surface = await render(<PairingPage onBack={jest.fn()} onContinue={next} />);
  expect(surface.getByText(i18n.t('pairing.noFileGrant'))).toBeTruthy();
  expect(next).not.toHaveBeenCalled();
  await fireEvent.press(surface.getByText(i18n.t('computer.continue')));
  expect(next).toHaveBeenCalledTimes(1);
  await surface.unmount();
});

it.each(['background', 'error', 'uncertain', 'repair', 'missingRecord', 'missingIdentity', 'pending'])('hides continuation for %s state', async (condition) => {
  if (condition === 'background') mockForeground = false;
  if (condition === 'error') mockSnapshot.error = 'outcome_unknown';
  if (condition === 'uncertain') mockSnapshot.uncertain = true;
  if (condition === 'repair') mockSnapshot.status!.repairRequired = true;
  if (condition === 'missingRecord') delete mockSnapshot.status!.recordId;
  if (condition === 'missingIdentity') delete mockSnapshot.status!.peerFingerprint;
  if (condition === 'pending') mockSnapshot.status!.phase = 'pending';
  const surface = await render(<PairingPage onBack={jest.fn()} onContinue={jest.fn()} />);
  expect(surface.queryByText(i18n.t('computer.continue'))).toBeNull();
  await surface.unmount();
});
