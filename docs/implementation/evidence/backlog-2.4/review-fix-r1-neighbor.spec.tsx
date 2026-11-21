import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { BackupSetup } from '../../../../apps/desktop/src/pages/backup/BackupSetup';
import { i18n } from '../../../../apps/desktop/src/shared/i18n';

const failure = { ok: false, code: 'access_denied', diagnostic: { stage: 'put', kind: 'http', status: 403 } };
const summary = () => i18n.t('onboarding.webdavDiagnostic.summary', {
  stage: i18n.t('onboarding.webdavDiagnostic.stages.put'),
  reason: i18n.t('onboarding.webdavDiagnostic.reasons.access_denied', { status: 403 }),
});
afterEach(() => { cleanup(); window.kloda = undefined; });

it.each([failure, { ok: true }])('G24-R1/G24-05: backup→jobs→backup also ends pending form ownership %#', async (reply) => {
  let finish!: (value: unknown) => void;
  window.kloda = {
    getDraft: vi.fn().mockResolvedValue({ intervalHours: 12, localTime: '12:00', sources: [{ id: 's', displayName: 'Documents' }], storage: null, storageTested: false }),
    getProgress: vi.fn().mockResolvedValue(null), pickSources: vi.fn(), saveSchedule: vi.fn().mockResolvedValue(undefined),
    saveStorage: vi.fn().mockResolvedValue(undefined), testStorage: vi.fn(() => new Promise((resolve) => { finish = resolve; })), startSync: vi.fn(),
  };
  const surface = render(<BackupSetup visible />);
  await screen.findByText('Documents');
  fireEvent.click(screen.getByRole('button', { name: i18n.t('onboarding.continue') }));
  await screen.findByRole('textbox', { name: i18n.t('onboarding.endpoint') });
  fireEvent.click(screen.getByRole('button', { name: i18n.t('onboarding.testConnection') }));
  await waitFor(() => expect(window.kloda!.testStorage).toHaveBeenCalledOnce());
  // App keeps visible=true for both /backup and /jobs, changing only showActivity.
  surface.rerender(<BackupSetup visible showActivity />);
  await waitFor(() => expect(screen.queryByRole('textbox', { name: i18n.t('onboarding.endpoint') })).not.toBeInTheDocument());
  await act(async () => { finish(reply); });
  surface.rerender(<BackupSetup visible showActivity={false} />);
  await screen.findByText('Documents');
  expect(screen.queryByText(summary())).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: i18n.t('onboarding.continue') }));
  await screen.findByRole('textbox', { name: i18n.t('onboarding.endpoint') });
  expect(screen.getByRole('button', { name: i18n.t('onboarding.startBackup') })).toBeDisabled();
});
