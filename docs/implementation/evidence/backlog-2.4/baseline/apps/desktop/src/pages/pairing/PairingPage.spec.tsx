/// <reference lib="es2024.promise" />
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';

import { PairingPage } from './PairingPage';
import { i18n } from '../../shared/i18n';
import type { DesktopPairingBridge, PairingStatus } from '../../shared/api/pairing';
import { useDesktopPairing } from '../../features/pair-device/useDesktopPairing';

function nativeStatus(initial: PairingStatus) {
  let current = initial;
  const bridge: DesktopPairingBridge = {
    status: vi.fn(async () => current),
    createInvitation: vi.fn().mockRejectedValue({ code: 'native_unsupported' }),
    approve: vi.fn().mockRejectedValue({ code: 'native_unsupported' }),
    deny: vi.fn().mockRejectedValue({ code: 'native_unsupported' }),
    cancel: vi.fn().mockRejectedValue({ code: 'native_unsupported' }),
    resume: vi.fn().mockRejectedValue({ code: 'native_unsupported' }),
    approveBackup: vi.fn().mockRejectedValue({ code: 'native_unsupported' }),
    revokeBackup: vi.fn().mockRejectedValue({ code: 'native_unsupported' }),
    close: vi.fn().mockResolvedValue(undefined),
  };
  window.kloda = {
    pairing: bridge,
    getDraft: vi.fn(), pickSources: vi.fn(), saveSchedule: vi.fn(),
    getProgress: vi.fn().mockResolvedValue(null),
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
    vi.useRealTimers();
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
    expect(bridge.approveBackup).not.toHaveBeenCalled();
    expect(bridge.revokeBackup).not.toHaveBeenCalled();
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

  it.each([
    { phase: 'complete' },
    { phase: 'consumed_pending_ack', recordId: 'retained-1' },
  ] satisfies PairingStatus[])('does not grant file permission without a complete retained peer: %j', async (status) => {
    const { bridge } = nativeStatus(status);
    render(<PairingPage />);
    await screen.findAllByText(i18n.t(`pairing.phases.${status.phase}`));
    const approve = screen.queryByRole('button', { name: i18n.t('pairing.approveBackup') });
    if (approve) {
      expect(approve).toBeDisabled();
      fireEvent.click(approve);
    }
    expect(bridge.approveBackup).not.toHaveBeenCalled();
  });

  it.each(['approved', 'unavailable'] as const)('revokes %s file permission without revoking trust or granting another folder', async (state) => {
    const { bridge } = nativeStatus({
      phase: 'complete', recordId: 'retained-1', operationId: 'operation-1',
      backupScope: { state, folder: '/Photos' },
    });
    vi.mocked(bridge.revokeBackup).mockResolvedValue({
      phase: 'complete', recordId: 'retained-1', operationId: 'operation-1', backupScope: { state: 'revoked' },
    });
    render(<PairingPage />);
    fireEvent.click(await screen.findByRole('button', { name: i18n.t('pairing.revokeBackup') }));
    await waitFor(() => expect(screen.queryByRole('button', { name: i18n.t('pairing.revokeBackup') })).not.toBeInTheDocument());
    expect(bridge.revokeBackup).toHaveBeenCalledTimes(1);
    expect(bridge.revokeBackup).toHaveBeenCalledWith('retained-1');
    expect(bridge.cancel).not.toHaveBeenCalled();
    expect(bridge.approveBackup).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: i18n.t('pairing.revokeLocalTrust') })).toBeEnabled();
  });

  it('blocks duplicate folder approval and uncertain outcomes until native status is refreshed', async () => {
    const { bridge } = nativeStatus({ phase: 'complete', recordId: 'retained-1' });
    const { promise, reject } = Promise.withResolvers<PairingStatus>();
    vi.mocked(bridge.approveBackup).mockReturnValue(promise);
    render(<PairingPage />);
    const approve = await screen.findByRole('button', { name: i18n.t('pairing.approveBackup') });
    fireEvent.click(approve);
    expect(approve).toBeDisabled();
    fireEvent.click(approve);
    vi.mocked(bridge.status).mockRejectedValueOnce({ code: 'acl_unavailable' });
    await act(async () => { reject({ code: 'outcome_unknown' }); });
    await waitFor(() => expect(screen.getByRole('button', { name: i18n.t('pairing.refreshStatus') })).toBeEnabled());
    expect(approve).toBeDisabled();
    expect(bridge.approveBackup).toHaveBeenCalledTimes(1);
    expect(bridge.approveBackup).toHaveBeenCalledWith('retained-1');
    expect(bridge.status).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getByRole('button', { name: i18n.t('pairing.refreshStatus') }));
    await waitFor(() => expect(approve).toBeEnabled());
    expect(bridge.approveBackup).toHaveBeenCalledTimes(1);
    expect(bridge.cancel).not.toHaveBeenCalled();
  });

  it('rejects stale controller calls against a different retained native peer', async () => {
    const { bridge, update } = nativeStatus({
      phase: 'complete', recordId: 'retained-1', backupScope: { state: 'approved' },
    });
    const { result } = renderHook(() => useDesktopPairing());
    await waitFor(() => expect(result.current.status?.recordId).toBe('retained-1'));
    const stale = result.current;
    update({ phase: 'complete', recordId: 'retained-2', backupScope: { state: 'approved' } });
    await act(async () => { await result.current.refresh(); });
    await act(async () => {
      await stale.approveBackup('retained-1');
      await stale.revokeBackup('retained-1');
    });
    expect(bridge.approveBackup).not.toHaveBeenCalled();
    expect(bridge.revokeBackup).not.toHaveBeenCalled();
    update({ phase: 'pending', recordId: 'retained-2' });
    await act(async () => {
      await result.current.refresh();
      await result.current.approveBackup('retained-2');
    });
    expect(bridge.approveBackup).not.toHaveBeenCalled();
  });

  it('reselects a failed native scope using only the retained peer without resetting trust', async () => {
    const { bridge } = nativeStatus({
      phase: 'complete', recordId: 'retained-1', operationId: 'operation-1',
      backupScope: { state: 'unavailable', folder: '/OldPhotos', errorCode: 'backup_scope_changed' },
    });
    vi.mocked(bridge.approveBackup).mockResolvedValue({
      phase: 'complete', recordId: 'retained-1', operationId: 'operation-1',
      backupScope: { state: 'approved', folder: '/NewPhotos' },
    });
    render(<PairingPage />);
    fireEvent.click(await screen.findByRole('button', { name: i18n.t('pairing.reselectBackup') }));
    await screen.findByRole('button', { name: i18n.t('pairing.revokeBackup') });
    expect(bridge.approveBackup).toHaveBeenCalledTimes(1);
    expect(bridge.approveBackup).toHaveBeenCalledWith('retained-1');
    expect(bridge.cancel).not.toHaveBeenCalled();
    expect(bridge.createInvitation).not.toHaveBeenCalled();
    expect(bridge.revokeBackup).not.toHaveBeenCalled();
  });

  it('observes post-pairing folder failures and remote revocation without another user action', async () => {
    vi.useFakeTimers();
    const complete: PairingStatus = {
      phase: 'complete', recordId: 'retained-1', backupScope: { state: 'approved', folder: '/Photos' },
    };
    const { bridge, update } = nativeStatus(complete);
    await act(async () => { render(<PairingPage />); });
    expect(screen.getByText(i18n.t('pairing.backupStates.approved'))).toBeInTheDocument();
    update({ ...complete, backupScope: { state: 'unavailable', errorCode: 'backup_unavailable' } });
    await act(async () => { await vi.advanceTimersByTimeAsync(1500); });
    expect(screen.getByText(i18n.t('pairing.backupStates.unavailable'))).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(i18n.t('pairing.errors.backup_unavailable'));
    update({ phase: 'revoked', recordId: 'retained-1' });
    await act(async () => { await vi.advanceTimersByTimeAsync(1500); });
    expect(screen.queryByRole('button', { name: i18n.t('pairing.reselectBackup') })).not.toBeInTheDocument();
    expect(screen.getAllByText(i18n.t('pairing.phases.revoked'))).toHaveLength(2);
    await act(async () => { await vi.advanceTimersByTimeAsync(3000); });
    expect(bridge.status).toHaveBeenCalledTimes(3);
    expect(bridge.approveBackup).not.toHaveBeenCalled();
  });

  it('replaces stale permission success with uncertainty and recovers without overlapping polls', async () => {
    vi.useFakeTimers();
    const { bridge } = nativeStatus({ phase: 'complete', recordId: 'retained-1', backupScope: { state: 'approved' } });
    let view!: ReturnType<typeof render>;
    await act(async () => { view = render(<PairingPage />); });
    const pending = Promise.withResolvers<PairingStatus>();
    vi.mocked(bridge.status).mockReturnValueOnce(pending.promise);
    await act(async () => { await vi.advanceTimersByTimeAsync(4500); });
    expect(bridge.status).toHaveBeenCalledTimes(2);
    await act(async () => { pending.reject({ code: 'connection_closed' }); });
    expect(screen.queryByText(i18n.t('pairing.backupStates.approved'))).not.toBeInTheDocument();
    expect(screen.getByText(i18n.t('pairing.backupStates.unknown'))).toBeInTheDocument();
    expect(screen.getByRole('button', { name: i18n.t('pairing.reselectBackup') })).toBeDisabled();
    await act(async () => { await vi.advanceTimersByTimeAsync(1500); });
    expect(screen.getByText(i18n.t('pairing.backupStates.approved'))).toBeInTheDocument();
    expect(screen.getByRole('button', { name: i18n.t('pairing.reselectBackup') })).toBeEnabled();
    view.unmount();
    await act(async () => { await vi.advanceTimersByTimeAsync(3000); });
    expect(bridge.status).toHaveBeenCalledTimes(3);
    expect(bridge.close).toHaveBeenCalledOnce();
  });
});
