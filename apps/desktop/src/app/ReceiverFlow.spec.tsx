import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';

import { App } from './App';
import { i18n } from '../shared/i18n';
import type { BackgroundStatus } from '../shared/api/desktop';

const initial: BackgroundStatus = {
  receiver: { available: true, activeTransfers: 0 }, backup: { active: false, failed: false },
  autostart: { enabled: false, supported: true }, autostartChoice: false, canHide: true,
  environmentLimited: false, shutdownError: false,
};
function fixture(status = initial) {
  window.history.replaceState(null, '', '/');
  const pairing = { status: vi.fn().mockResolvedValue({ phase: 'idle' }), createInvitation: vi.fn(),
    approve: vi.fn(), deny: vi.fn(), cancel: vi.fn(), resume: vi.fn(), close: vi.fn().mockResolvedValue(undefined),
    approveBackup: vi.fn(), revokeBackup: vi.fn() };
  const background = { status: vi.fn().mockResolvedValue(status), setAutostart: vi.fn(), quit: vi.fn(),
    activity: vi.fn().mockResolvedValue({ receiverAvailable: true, items: [] }) };
  const devices = { list: vi.fn().mockResolvedValue({ items: [] }), approveBackup: vi.fn(), revokeBackup: vi.fn() };
  window.kloda = { background, pairing, devices, getDraft: vi.fn().mockResolvedValue({ intervalHours: 12,
    localTime: '12:00', sources: [], storage: null, storageTested: false }), getProgress: vi.fn().mockResolvedValue(null),
    pickSources: vi.fn(), saveSchedule: vi.fn(), saveStorage: vi.fn(), startSync: vi.fn(), testStorage: vi.fn() };
  return { background, pairing, devices };
}
afterEach(() => { cleanup(); vi.useRealTimers(); window.kloda = undefined; window.history.replaceState(null, '', '/'); });

it('starts with the actual receiver, distinct trust/access steps, and no automatic invitation or grant', async () => {
  const { background, pairing, devices } = fixture({ ...initial, receiver: { available: false, activeTransfers: 0, errorCode: 'storage_failure' } });
  render(<App />);
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(i18n.t('receiver.title'));
  expect(await screen.findByText(i18n.t('pairing.errors.storage_failure'))).toHaveAttribute('role', 'alert');
  expect(screen.queryByText(i18n.t('background.listening'))).not.toBeInTheDocument();
  expect(screen.getByText(i18n.t('receiver.trustBoundary'))).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: i18n.t('onboarding.continue') })).not.toBeInTheDocument();
  expect(pairing.createInvitation).not.toHaveBeenCalled(); expect(pairing.approveBackup).not.toHaveBeenCalled();
  expect(devices.approveBackup).not.toHaveBeenCalled(); expect(background.setAutostart).not.toHaveBeenCalled();
});

it('replaces previously available status with unknown on query failure and recovers from a real response', async () => {
  const { background } = fixture();
  vi.useFakeTimers();
  await act(async () => { render(<App />); });
  expect(screen.getByText(i18n.t('background.listening'))).toBeInTheDocument();
  background.status.mockRejectedValueOnce(new Error('fixture unavailable'));
  await act(async () => { await vi.advanceTimersByTimeAsync(1500); });
  expect(screen.getByText(i18n.t('background.unknown'))).toHaveAttribute('role', 'alert');
  expect(screen.queryByText(i18n.t('background.listening'))).not.toBeInTheDocument();
  await act(async () => { await vi.advanceTimersByTimeAsync(1500); });
  expect(screen.getByText(i18n.t('background.listening'))).toBeInTheDocument();
});

it('connects QR, separate permissions, history and settings without granting or closing background receipt', async () => {
  const { pairing, devices, background } = fixture();
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: i18n.t('receiver.pairAction') }));
  expect(await screen.findByRole('heading', { level: 1, name: i18n.t('pairing.title') })).toHaveFocus();
  expect(pairing.createInvitation).not.toHaveBeenCalled();
  const nav = within(screen.getByRole('navigation'));
  fireEvent.click(nav.getByRole('button', { name: i18n.t('receiver.navigation') }));
  fireEvent.click(screen.getByRole('button', { name: i18n.t('receiver.accessAction') }));
  await screen.findByText(i18n.t('devices.empty'));
  expect(devices.approveBackup).not.toHaveBeenCalled();
  fireEvent.click(nav.getByRole('button', { name: i18n.t('incoming.navigation') }));
  await screen.findByText(i18n.t('incoming.empty'));
  fireEvent.click(nav.getByRole('button', { name: i18n.t('receiver.settingsNavigation') }));
  expect(await screen.findByRole('checkbox', { name: i18n.t('background.loginLabel') })).not.toBeChecked();
  expect(background.setAutostart).not.toHaveBeenCalled();
  expect(background.quit).not.toHaveBeenCalled();
  expect(pairing.close).toHaveBeenCalled(); // Existing foreground suspension API; it retains the native owner.
});

it('shows unknown instead of a successful setup when the native bridge is absent', () => {
  window.history.replaceState(null, '', '/');
  render(<App />);
  expect(screen.getByText(i18n.t('background.unknown'))).toHaveAttribute('role', 'alert');
  expect(screen.queryByText(i18n.t('background.listening'))).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: i18n.t('background.quit') })).toBeDisabled();
});


it.each(['tr', 'en', 'de'])('keeps the receiver flow and navigation translated in %s', async (language) => {
  await i18n.changeLanguage(language);
  fixture();
  render(<App />);
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(i18n.t('receiver.title'));
  expect(screen.getByRole('button', { name: i18n.t('receiver.accessAction') })).toBeInTheDocument();
  expect(within(screen.getByRole('navigation')).getByRole('button', { name: i18n.t('receiver.settingsNavigation') })).toBeInTheDocument();
  expect(screen.queryByText(/receiver\./)).not.toBeInTheDocument();
  cleanup();
  await i18n.changeLanguage('tr');
});
