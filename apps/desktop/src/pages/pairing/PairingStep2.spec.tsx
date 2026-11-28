import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PairingPage } from './PairingPage';
import { i18n } from '../../shared/i18n';
import type { DesktopPairingBridge, PairingStatus } from '../../shared/api/pairing';

function completeBridge(status: PairingStatus) {
  const bridge: DesktopPairingBridge = {
    status: vi.fn(async () => status),
    createInvitation: vi.fn(),
    approve: vi.fn(),
    deny: vi.fn(),
    cancel: vi.fn(),
    resume: vi.fn(),
    approveBackup: vi.fn(),
    revokeBackup: vi.fn(),
    close: vi.fn().mockResolvedValue(undefined),
  };
  window.kloda = {
    pairing: bridge,
    getDraft: vi.fn(),
    pickSources: vi.fn(),
    saveSchedule: vi.fn(),
    getProgress: vi.fn().mockResolvedValue(null),
    saveStorage: vi.fn(),
    startSync: vi.fn(),
    testStorage: vi.fn(),
  };
}

describe('PairingPage Step 2 card and readable device metadata', () => {
  afterEach(() => {
    cleanup();
    window.kloda = undefined;
  });

  it('shows Step 2 backup folder card above the fold with peerName and peerFolder', async () => {
    completeBridge({
      phase: 'complete',
      recordId: 'retained-1',
      peerName: 'Galaxy S24',
      peerFingerprint: 'fp-1234567890',
      backupScope: { state: 'approved', folder: '/Photos', peerFolder: 'Galaxy S24' },
    });
    render(<PairingPage />);
    expect(await screen.findByRole('heading', { name: i18n.t('pairing.step2Title') })).toBeInTheDocument();
    expect(screen.getAllByText('Galaxy S24').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('/Photos/Galaxy S24')).toBeInTheDocument();
    const details = screen.getByText('fp-1234567890').closest('details');
    expect(details?.open).toBe(false);
  });
});
