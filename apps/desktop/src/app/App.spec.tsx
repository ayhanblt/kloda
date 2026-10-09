import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';

import { App } from './App';
import { i18n } from '../shared/i18n';

describe('App', () => {
  afterEach(() => { cleanup(); window.kloda = undefined; window.location.hash = ''; toast.dismiss(); });

  it('blocks storage setup until a source is selected', async () => {
    window.kloda = {
      getDraft: vi.fn().mockResolvedValue({ intervalHours: 12, localTime: '12:00', sources: [], storage: null, storageTested: false }),
      pickSources: vi.fn().mockResolvedValue([{ displayName: 'DCIM', id: 'source-1' }]),
      saveSchedule: vi.fn(), saveStorage: vi.fn(), startSync: vi.fn(), testStorage: vi.fn(),
    };
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: i18n.t('onboarding.continue') }));
    expect(await screen.findByRole('alert')).toHaveTextContent(i18n.t('onboarding.sourceRequired'));
    fireEvent.click(screen.getByRole('button', { name: i18n.t('onboarding.chooseFolders') }));
    expect(await screen.findByText('DCIM')).toBeInTheDocument();
  });

  it('preserves the WebDAV form while navigating to the actual pairing route and back', async () => {
    window.kloda = {
      getDraft: vi.fn().mockResolvedValue({
        intervalHours: 12, localTime: '12:00', sources: [{ displayName: 'Documents', id: 'source-1' }],
        storage: null, storageTested: false,
      }),
      pickSources: vi.fn(), saveSchedule: vi.fn().mockResolvedValue(undefined),
      saveStorage: vi.fn(), startSync: vi.fn(), testStorage: vi.fn(),
    };
    render(<App />);
    await screen.findByText('Documents');
    fireEvent.click(screen.getByRole('button', { name: i18n.t('onboarding.continue') }));
    const endpoint = await screen.findByRole('textbox', { name: i18n.t('onboarding.endpoint') });
    fireEvent.change(endpoint, { target: { value: 'https://personal.example/webdav' } });
    fireEvent.click(screen.getByRole('button', { name: i18n.t('pairing.pairingNavigation') }));
    expect(window.location.hash).toBe('#/pairing');
    await waitFor(() => expect(screen.getAllByText(i18n.t('pairing.errors.native_unsupported')).length).toBeGreaterThan(0));
    expect(screen.queryByRole('textbox', { name: i18n.t('onboarding.endpoint') })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: i18n.t('pairing.backupNavigation') }));
    expect(window.location.hash).toBe('#/backup');
    expect(screen.getByRole('textbox', { name: i18n.t('onboarding.endpoint') })).toHaveValue('https://personal.example/webdav');
  });

  it.each(['approve', 'deny', 'cancel'] as const)('keeps a reserved candidate mounted across Back and navigation until %s resolves', async (decision) => {
    const reserved = {
      phase: 'reserved' as const, operationId: 'AAAAAAAAAAAAAAAAAAAAAA', candidateGeneration: '1',
      peerFingerprint: 'ab'.repeat(32), remainingMs: 120000,
    };
    let resolveDecision!: (status: { phase: 'invalid' }) => void;
    const result = new Promise<{ phase: 'invalid' }>((resolve) => { resolveDecision = resolve; });
    const pairing = {
      status: vi.fn().mockResolvedValue(reserved), createInvitation: vi.fn(),
      approve: vi.fn().mockReturnValue(result), deny: vi.fn().mockReturnValue(result),
      cancel: vi.fn().mockReturnValue(result), resume: vi.fn(), close: vi.fn().mockResolvedValue(undefined),
    };
    window.kloda = {
      getDraft: vi.fn().mockResolvedValue({ intervalHours: 12, localTime: '12:00', sources: [], storage: null, storageTested: false }),
      pickSources: vi.fn(), saveSchedule: vi.fn(), saveStorage: vi.fn(), startSync: vi.fn(), testStorage: vi.fn(),
      pairing,
    };
    window.history.replaceState(null, '', '#/backup');
    render(<App />);
    await screen.findByRole('button', { name: i18n.t('onboarding.continue') });
    fireEvent.click(screen.getByRole('button', { name: i18n.t('pairing.pairingNavigation') }));
    await screen.findByRole('dialog');
    const backup = screen.getByRole('button', { name: i18n.t('pairing.backupNavigation') });
    expect(backup).toBeDisabled();
    fireEvent.click(backup);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await act(async () => {
      const changed = new Promise<void>((resolve) => window.addEventListener('hashchange', () => resolve(), { once: true }));
      window.history.back();
      await changed;
    });
    expect(window.location.hash).toBe('#/pairing');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(pairing.close).not.toHaveBeenCalled();

    const label = decision === 'cancel' ? 'pairing.cancelInvitation' : `pairing.${decision}`;
    const decisionButton = within(screen.getByRole('dialog')).getByRole('button', { name: i18n.t(label) });
    fireEvent.click(decisionButton);
    await waitFor(() => expect(pairing[decision]).toHaveBeenCalled());
    expect(decisionButton).toBeDisabled();
    expect(backup).toBeDisabled();
    expect(pairing.close).not.toHaveBeenCalled();
    await act(async () => { resolveDecision({ phase: 'invalid' }); await result; });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: i18n.t('pairing.backupNavigation') }));
    expect(window.location.hash).toBe('#/backup');
    await waitFor(() => expect(pairing.close).toHaveBeenCalledOnce());
  });
});
