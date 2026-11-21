import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';

import { DesktopBackground } from './DesktopBackground';
import { i18n } from '../../shared/i18n';
import type { BackgroundStatus } from '../../shared/api/desktop';

afterEach(async () => { cleanup(); window.kloda = undefined; vi.useRealTimers(); await i18n.changeLanguage('tr'); });

function fixture(initial: BackgroundStatus) {
  let current = initial;
  const background = {
    status: vi.fn(async () => current),
    setAutostart: vi.fn(async (enabled: boolean) => {
      current = { ...current, autostartChoice: enabled, autostart: { enabled, supported: true } };
      return current;
    }),
    quit: vi.fn().mockResolvedValue(undefined),
  };
  window.kloda = { background, getDraft: vi.fn(), getProgress: vi.fn(), pickSources: vi.fn(),
    saveSchedule: vi.fn(), saveStorage: vi.fn(), startSync: vi.fn(), testStorage: vi.fn() };
  return { background, update: (next: BackgroundStatus) => { current = next; } };
}

const initial: BackgroundStatus = {
  receiver: { available: true, activeTransfers: 0 }, backup: { active: false, failed: false },
  autostart: { enabled: false, supported: true }, autostartChoice: null, canHide: true,
  environmentLimited: false, shutdownError: false,
};

it('asks before enabling login start, shows observed OS state, and offers explicit quit', async () => {
  const { background } = fixture(initial);
  render(<DesktopBackground />);
  await screen.findByText(i18n.t('background.loginQuestion'));
  expect(background.setAutostart).not.toHaveBeenCalled();
  const checkbox = screen.getByRole('checkbox', { name: i18n.t('background.loginLabel') });
  expect(checkbox).not.toBeChecked();
  fireEvent.click(checkbox);
  await waitFor(() => expect(checkbox).toBeChecked());
  expect(background.setAutostart).toHaveBeenCalledWith(true);
  fireEvent.click(screen.getByRole('button', { name: i18n.t('background.quit') }));
  expect(background.quit).toHaveBeenCalledOnce();
});

it('shows unsupported Linux controls and real errors, then observes external login disable and recovery', async () => {
  vi.useFakeTimers();
  const { update } = fixture({ ...initial, environmentLimited: true, canHide: false,
    receiver: { available: false, activeTransfers: 0, errorCode: 'native_unsupported' },
    autostartChoice: true, autostart: { enabled: false, supported: false, reason: 'unsupported' } });
  await act(async () => { render(<DesktopBackground />); });
  expect(screen.getByRole('checkbox')).toBeDisabled();
  expect(screen.getByText(i18n.t('background.environmentLimited'))).toBeInTheDocument();
  expect(screen.getByRole('alert')).toHaveTextContent(i18n.t('pairing.errors.native_unsupported'));
  expect(screen.getByText(i18n.t('background.loginNotApplied'))).toBeInTheDocument();
  update({ ...initial, autostartChoice: true });
  await act(async () => { await vi.advanceTimersByTimeAsync(1500); });
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(screen.getByRole('checkbox')).not.toBeChecked();
  expect(screen.getByText(i18n.t('background.loginNotApplied'))).toBeInTheDocument();
});

async function tick() { await act(async () => { await vi.advanceTimersByTimeAsync(1500); }); }
const trayMenu = () => screen.getByRole('group', { name: i18n.t('tray.menuLabel') });
const trayPill = () => within(trayMenu()).getByRole('status');

it('G23-01 shows the observed tray state with errors first and no synthetic progress', async () => {
  vi.useFakeTimers();
  const { update } = fixture({ ...initial, receiver: { available: true, activeTransfers: 0, errorCode: 'lan_unavailable' } });
  await act(async () => { render(<DesktopBackground settings={false} tray onOpen={vi.fn()} />); });
  expect(trayPill()).toHaveTextContent(i18n.t('tray.state.error'));
  expect(within(trayMenu()).getByRole('alert')).toHaveTextContent(i18n.t('pairing.errors.lan_unavailable'));
  expect(trayMenu()).not.toHaveTextContent(i18n.t('tray.state.listening'));
  const sequence: [BackgroundStatus, string][] = [
    [initial, 'tray.state.listening'],
    [{ ...initial, receiver: { available: true, activeTransfers: 2 } }, 'tray.state.active'],
    [{ ...initial, backup: { active: true, failed: false } }, 'tray.state.active'],
    [{ ...initial, backup: { active: false, failed: true } }, 'tray.state.error'],
    [{ ...initial, shutdownError: true }, 'tray.state.error'],
    [{ ...initial, receiver: { available: false, activeTransfers: 0 } }, 'tray.state.unavailable'],
    [initial, 'tray.state.listening'],
  ];
  for (const [next, key] of sequence) {
    update(next); await tick();
    expect(trayPill()).toHaveTextContent(i18n.t(key));
  }
  expect(within(trayMenu()).queryByRole('alert')).not.toBeInTheDocument();
  expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  expect(trayMenu()).not.toHaveTextContent('2');
});

it('G23-R1 keeps observed activity independent of the error-priority pill', async () => {
  vi.useFakeTimers();
  const fileFailure = { ...initial, receiver: { available: true, activeTransfers: 1 }, backup: { active: false, failed: true } };
  const { background, update } = fixture(initial);
  await act(async () => { render(<DesktopBackground settings={false} tray onOpen={vi.fn()} />); });
  const expectTray = (pill: string, activity: string) => {
    expect(trayPill()).toHaveTextContent(i18n.t(pill));
    expect(trayMenu()).toHaveTextContent(i18n.t(activity));
  };
  const sequence: [BackgroundStatus, string, string][] = [
    [fileFailure, 'tray.state.error', 'background.active'],
    [{ ...fileFailure, backup: { active: false, failed: false } }, 'tray.state.active', 'background.active'],
    [initial, 'tray.state.listening', 'background.idle'],
    [{ ...initial, backup: { active: true, failed: false }, receiver: { available: false, activeTransfers: 0, errorCode: 'lan_unavailable' } },
      'tray.state.error', 'background.active'],
    [{ ...initial, receiver: { available: true, activeTransfers: 2 }, shutdownError: true }, 'tray.state.error', 'background.active'],
  ];
  for (const [next, pill, activity] of sequence) {
    update(next); await tick();
    expectTray(pill, activity);
    if (pill === 'tray.state.error') expect(within(trayMenu()).getAllByRole('alert').length).toBeGreaterThan(0);
  }
  background.status.mockRejectedValueOnce(new Error('bridge failed')); await tick();
  expect(trayPill()).toHaveTextContent(i18n.t('tray.state.unknown'));
  expect(trayMenu()).not.toHaveTextContent(i18n.t('background.active'));
  expect(trayMenu()).not.toHaveTextContent(i18n.t('background.idle'));
  expect(within(trayMenu()).queryByRole('alert')).not.toBeInTheDocument();
});

it('G23-02 keeps one poller across tray/settings and ignores replies after unmount', async () => {
  vi.useFakeTimers();
  const { background } = fixture(initial);
  const view = await act(async () => render(<DesktopBackground settings={false} tray onOpen={vi.fn()} />));
  expect(background.status).toHaveBeenCalledOnce();
  view.rerender(<DesktopBackground settings />);
  view.rerender(<DesktopBackground settings={false} tray onOpen={vi.fn()} />);
  expect(background.status).toHaveBeenCalledOnce();
  let finish!: (status: BackgroundStatus) => void;
  background.status.mockReturnValueOnce(new Promise<BackgroundStatus>((resolve) => { finish = resolve; }));
  await tick();
  view.unmount();
  await act(async () => { finish({ ...initial, shutdownError: true }); await vi.advanceTimersByTimeAsync(4500); });
  expect(background.status).toHaveBeenCalledTimes(2);
});

it('G23-03/04 opens the window, quits through the single bridge path, and keeps both pauses inert', async () => {
  const { background } = fixture({ ...initial, receiver: { available: true, activeTransfers: 1 } });
  const onOpen = vi.fn();
  render(<DesktopBackground settings={false} tray onOpen={onOpen} />);
  await waitFor(() => expect(trayPill()).toHaveTextContent(i18n.t('tray.state.active')));
  for (const key of ['tray.pauseIncoming', 'tray.pauseOutgoing']) {
    const pause = screen.getByRole('button', { name: i18n.t(key) });
    expect(pause).toBeDisabled();
    expect(pause).toHaveAccessibleDescription(i18n.t('tray.pauseUnavailable'));
    fireEvent.click(pause);
  }
  expect(background.quit).not.toHaveBeenCalled();
  expect(background.setAutostart).not.toHaveBeenCalled();
  expect(onOpen).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: i18n.t('tray.open') }));
  expect(onOpen).toHaveBeenCalledOnce();
  background.quit.mockRejectedValueOnce(new Error('quit failed'));
  fireEvent.click(screen.getByRole('button', { name: i18n.t('background.quit') }));
  expect(background.quit).toHaveBeenCalledOnce();
  await waitFor(() => expect(trayPill()).toHaveTextContent(i18n.t('tray.state.unknown')));
  expect(screen.getByRole('button', { name: i18n.t('background.quit') })).toBeEnabled();
});

it('G23-05 shows the main-process version and read-only close behavior, unknown on failure', async () => {
  vi.useFakeTimers();
  const { background, update } = fixture({ ...initial, appVersion: '0.0.0' });
  await act(async () => { render(<DesktopBackground />); });
  expect(screen.getByText('0.0.0')).toBeInTheDocument();
  expect(screen.getByText(i18n.t('background.closeHides'))).toBeInTheDocument();
  expect(screen.getByText(i18n.t('background.closeAutomatic'))).toBeInTheDocument();
  expect(screen.queryByRole('radio')).not.toBeInTheDocument();
  expect(screen.getAllByRole('checkbox')).toHaveLength(1);
  update({ ...initial, appVersion: '0.0.0', canHide: false, environmentLimited: true }); await tick();
  expect(screen.getByText(i18n.t('background.closeStaysVisible'))).toBeInTheDocument();
  background.status.mockRejectedValueOnce(new Error('bridge failed')); await tick();
  expect(screen.getByText(i18n.t('background.versionUnknown'))).toBeInTheDocument();
  expect(screen.queryByText('0.0.0')).not.toBeInTheDocument();
  expect(screen.queryByText(/prototype/)).not.toBeInTheDocument();
  expect(screen.queryByText(i18n.t('background.closeStaysVisible'))).not.toBeInTheDocument();
  expect(background.setAutostart).not.toHaveBeenCalled();
});

it.each(['tr', 'en', 'de'] as const)('G23-07 translates tray and settings names in %s', async (language) => {
  await i18n.changeLanguage(language);
  fixture({ ...initial, appVersion: '0.0.0' });
  const view = render(<DesktopBackground settings={false} tray onOpen={vi.fn()} />);
  await waitFor(() => expect(trayPill()).toHaveTextContent(i18n.t('tray.state.listening')));
  for (const key of ['tray.open', 'tray.pauseIncoming', 'tray.pauseOutgoing', 'background.quit']) {
    expect(screen.getByRole('button', { name: i18n.t(key) })).toBeInTheDocument();
    expect(i18n.t(key)).not.toBe(key);
  }
  view.rerender(<DesktopBackground settings />);
  expect(screen.getByText(i18n.t('background.version'))).toBeInTheDocument();
  expect(i18n.t('background.closeHides')).not.toBe('background.closeHides');
});

it('does not let an older status reply undo the observed explicit login-start choice', async () => {
  vi.useFakeTimers();
  const { background } = fixture(initial);
  await act(async () => { render(<DesktopBackground />); });
  let finish!: (status: BackgroundStatus) => void;
  background.status.mockReturnValueOnce(new Promise<BackgroundStatus>((resolve) => { finish = resolve; }));
  await act(async () => { await vi.advanceTimersByTimeAsync(1500); });
  const checkbox = screen.getByRole('checkbox');
  await act(async () => { fireEvent.click(checkbox); });
  expect(checkbox).toBeChecked();
  await act(async () => { finish(initial); });
  expect(checkbox).toBeChecked();
});
