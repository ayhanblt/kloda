/// <reference lib="es2024.promise" />
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';

import { PairingPage } from './PairingPage';
import { i18n } from '../../shared/i18n';
import type { DesktopPairingBridge, PairingStatus } from '../../shared/api/pairing';

function nativeStatus(initial: PairingStatus) {
  let current = initial;
  const bridge: DesktopPairingBridge = {
    status: vi.fn(async () => current),
    createInvitation: vi.fn().mockRejectedValue({ code: 'native_unsupported' }),
    approve: vi.fn().mockRejectedValue({ code: 'native_unsupported' }),
    deny: vi.fn().mockRejectedValue({ code: 'native_unsupported' }),
    cancel: vi.fn().mockRejectedValue({ code: 'native_unsupported' }),
    resume: vi.fn().mockRejectedValue({ code: 'native_unsupported' }),
    close: vi.fn().mockResolvedValue(undefined),
  };
  window.kloda = {
    pairing: bridge,
    getDraft: vi.fn(), pickSources: vi.fn(), saveSchedule: vi.fn(),
    saveStorage: vi.fn(), startSync: vi.fn(), testStorage: vi.fn(),
  };
  return { bridge, update: (next: PairingStatus) => { current = next; } };
}

const reserved: PairingStatus = {
  phase: 'reserved', operationId: 'operation-1', candidateGeneration: 'generation-1',
  peerFingerprint: 'public-phone-fingerprint', remainingMs: 60000,
};

describe('desktop pairing behavior', () => {
  afterEach(async () => {
    cleanup();
    await Promise.resolve();
    window.kloda = undefined;
    toast.dismiss();
    vi.restoreAllMocks();
  });

  it('visibly refuses browser pairing instead of inventing a QR or success', async () => {
    window.kloda = undefined;
    render(<PairingPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent(i18n.t('pairing.errors.native_unsupported'));
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: i18n.t('pairing.createInvitation') })).not.toBeInTheDocument();
    expect(screen.queryByText(i18n.t('pairing.phases.complete'))).not.toBeInTheDocument();
  });

  it('keeps consumed pending ACK distinct from completion and requires explicit resume', async () => {
    const { bridge } = nativeStatus({ phase: 'consumed_pending_ack', recordId: 'retained-1', operationId: 'operation-1' });
    vi.mocked(bridge.resume).mockResolvedValue({ phase: 'complete', recordId: 'retained-1', operationId: 'operation-1' });
    render(<PairingPage />);
    const resume = await screen.findByRole('button', { name: i18n.t('pairing.resume') });
    expect(screen.getByText(i18n.t('pairing.phaseDescriptions.consumed_pending_ack'))).toBeInTheDocument();
    expect(screen.queryByText(i18n.t('pairing.phases.complete'))).not.toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(bridge.resume).not.toHaveBeenCalled();
    fireEvent.click(resume);
    await waitFor(() => expect(screen.getAllByText(i18n.t('pairing.phases.complete')).length).toBeGreaterThan(0));
    expect(screen.getAllByText(i18n.t('pairing.noFileGrant')).length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: i18n.t('pairing.resume') })).not.toBeInTheDocument();
  });

  it('does not expose raw native errors or assume completion after an uncertain write', async () => {
    const { bridge } = nativeStatus(reserved);
    vi.mocked(bridge.approve).mockRejectedValue(new Error('SECRET_QR_PAYLOAD /private/native/store.db'));
    render(<PairingPage />);
    const dialog = await screen.findByRole('dialog');
    vi.mocked(bridge.status).mockRejectedValueOnce({ code: 'outcome_unknown' });
    fireEvent.click(within(dialog).getByRole('button', { name: i18n.t('pairing.approve') }));
    await waitFor(() => expect(within(dialog).getByRole('alert')).toBeInTheDocument());
    expect(document.body).not.toHaveTextContent('SECRET_QR_PAYLOAD');
    expect(document.body).not.toHaveTextContent('/private/native/store.db');
    expect(screen.queryByText(i18n.t('pairing.phases.complete'))).not.toBeInTheDocument();
  });

  it('never approves or dismisses a reserved candidate through backdrop, Escape or Enter', async () => {
    const { bridge } = nativeStatus({ ...reserved, qr: 'private-invitation-must-not-be-visible' });
    render(<PairingPage />);
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(dialog.parentElement!);
    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.keyDown(document, { key: 'Enter' });
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(bridge.approve).not.toHaveBeenCalled();
    expect(bridge.deny).not.toHaveBeenCalled();
    expect(bridge.cancel).not.toHaveBeenCalled();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(document.body).not.toHaveTextContent('private-invitation-must-not-be-visible');
    const buttons = within(dialog).getAllByRole('button');
    buttons[buttons.length - 1].focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(buttons[0]).toHaveFocus();
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(buttons[buttons.length - 1]).toHaveFocus();
  });

  it.each(['deny', 'cancel'] as const)('only an explicit %s action invalidates the invitation', async (decision) => {
    const { bridge } = nativeStatus(reserved);
    vi.mocked(bridge[decision]).mockResolvedValue({ phase: 'invalid' });
    render(<PairingPage />);
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', {
      name: i18n.t(decision === 'deny' ? 'pairing.deny' : 'pairing.cancelInvitation'),
    }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByText(i18n.t('pairing.phaseDescriptions.invalid'))).toBeInTheDocument();
    expect(screen.queryByText(i18n.t('pairing.phases.complete'))).not.toBeInTheDocument();
    expect(bridge.approve).not.toHaveBeenCalled();
  });

  it('replaces stale candidate consent and does not turn a rejected old generation into trust', async () => {
    const { bridge, update } = nativeStatus(reserved);
    const { promise, reject: rejectApproval } = Promise.withResolvers<PairingStatus>();
    vi.mocked(bridge.approve).mockReturnValue(promise);
    render(<PairingPage />);
    const firstDialog = await screen.findByRole('dialog');
    fireEvent.click(within(firstDialog).getByRole('button', { name: i18n.t('pairing.approve') }));
    await waitFor(() => expect(within(firstDialog).getByRole('button', { name: i18n.t('pairing.approve') })).toBeDisabled());
    update({ ...reserved, candidateGeneration: 'generation-2', peerFingerprint: 'replacement-public-fingerprint', repairRequired: true });
    await act(async () => { rejectApproval({ code: 'candidate_stale' }); });
    const replacement = await screen.findByRole('dialog', { name: i18n.t('pairing.repairTitle') });
    expect(within(replacement).getByText('replacement-public-fingerprint')).toBeInTheDocument();
    expect(within(replacement).queryByRole('button', { name: i18n.t('pairing.approve') })).not.toBeInTheDocument();
    expect(within(replacement).getByText(i18n.t('pairing.repairDescription'))).toBeInTheDocument();
    expect(bridge.approve).toHaveBeenCalledTimes(1);
    expect(bridge.approve).toHaveBeenCalledWith('operation-1', 'generation-1');
    vi.mocked(bridge.approve).mockResolvedValue({ phase: 'consumed_pending_ack', recordId: 'retained-2' });
    fireEvent.click(within(replacement).getByRole('button', { name: i18n.t('pairing.pairAgain') }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(bridge.approve).toHaveBeenLastCalledWith('operation-1', 'generation-2');
    expect(screen.queryByText(i18n.t('pairing.phases.complete'))).not.toBeInTheDocument();
  });

  it('disables approval after native invitation expiry and closes native ownership on departure', async () => {
    const { bridge } = nativeStatus({ ...reserved, remainingMs: 0 });
    const view = render(<PairingPage />);
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('button', { name: i18n.t('pairing.approve') })).toBeDisabled();
    expect(within(dialog).getByRole('alert')).toHaveTextContent(i18n.t('pairing.errors.invitation_expired'));
    view.unmount();
    await act(async () => { await Promise.resolve(); });
    expect(bridge.close).toHaveBeenCalledOnce();
    expect(bridge.approve).not.toHaveBeenCalled();
  });
});
