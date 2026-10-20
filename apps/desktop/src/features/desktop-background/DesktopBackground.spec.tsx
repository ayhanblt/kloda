import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';

import { DesktopBackground } from './DesktopBackground';
import { i18n } from '../../shared/i18n';
import type { BackgroundStatus } from '../../shared/api/desktop';

afterEach(() => { cleanup(); window.kloda = undefined; vi.useRealTimers(); });

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
