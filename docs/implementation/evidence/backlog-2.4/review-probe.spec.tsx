import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { BackupSetup } from '../../../../apps/desktop/src/pages/backup/BackupSetup';
import { i18n } from '../../../../apps/desktop/src/shared/i18n';

const summary = () => i18n.t('onboarding.webdavDiagnostic.summary', {
  stage: i18n.t('onboarding.webdavDiagnostic.stages.put'),
  reason: i18n.t('onboarding.webdavDiagnostic.reasons.access_denied', { status: 403 }),
});
const failure = { ok: false, code: 'access_denied', diagnostic: { stage: 'put', kind: 'http', status: 403 } };
async function open() {
  let finish!: (reply: unknown) => void;
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
  return { ...surface, finish: (reply: unknown) => act(async () => { finish(reply); }) };
}
afterEach(() => { cleanup(); window.kloda = undefined; });

it('G24-05: leaving storage fences the pending diagnostic', async () => {
  const surface = await open();
  fireEvent.click(screen.getByRole('button', { name: i18n.t('onboarding.back') }));
  await surface.finish(failure);
  expect(screen.queryByText(summary())).not.toBeInTheDocument();
});

it('G24-05: hidden retained setup does not acquire a late diagnostic on reopen', async () => {
  const surface = await open();
  surface.rerender(<BackupSetup visible={false} />);
  await surface.finish(failure);
  surface.rerender(<BackupSetup visible />);
  expect(screen.queryByText(summary())).not.toBeInTheDocument();
});

it('G24-05: leaving storage fences a pending success', async () => {
  const surface = await open();
  fireEvent.click(screen.getByRole('button', { name: i18n.t('onboarding.back') }));
  await surface.finish({ ok: true });
  fireEvent.click(screen.getByRole('button', { name: i18n.t('onboarding.continue') }));
  await screen.findByRole('textbox', { name: i18n.t('onboarding.endpoint') });
  expect(screen.getByRole('button', { name: i18n.t('onboarding.startBackup') })).toBeDisabled();
});
