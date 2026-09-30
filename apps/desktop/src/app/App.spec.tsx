import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { App } from './App';
import { i18n } from '../shared/i18n';

describe('App', () => {
  afterEach(() => { window.kloda = undefined; });

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
});
