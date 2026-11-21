import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { BackupSetup } from './BackupSetup';
import { i18n } from '../../shared/i18n';

const secret = 'public-secret-sentinel';
const draft = { intervalHours: 12, localTime: '12:00', sources: [{ displayName: 'Documents', id: 'source-1' }], storage: null, storageTested: false };
function bridge(overrides: Partial<NonNullable<Window['kloda']>> = {}) {
  const kloda = { getDraft: vi.fn().mockResolvedValue(draft), getProgress: vi.fn().mockResolvedValue(null), pickSources: vi.fn(),
    saveSchedule: vi.fn().mockResolvedValue(undefined), saveStorage: vi.fn().mockResolvedValue(undefined), startSync: vi.fn(),
    testStorage: vi.fn(), ...overrides };
  window.kloda = kloda;
  return kloda;
}
let mounted: ReturnType<typeof render> | undefined;
// The real App keeps BackupSetup mounted and only toggles `visible` (App.tsx retained hidden container).
const rerenderVisible = (visible: boolean) => mounted?.rerender(<BackupSetup visible={visible} />);
async function openStorage() {
  mounted = render(<BackupSetup visible />);
  await screen.findByText('Documents');
  fireEvent.click(screen.getByRole('button', { name: i18n.t('onboarding.continue') }));
  return screen.findByRole('textbox', { name: i18n.t('onboarding.endpoint') });
}
const test = () => fireEvent.click(screen.getByRole('button', { name: i18n.t('onboarding.testConnection') }));
const summary = (stage: string, reason: string, status?: number) => i18n.t('onboarding.webdavDiagnostic.summary', {
  stage: i18n.t(`onboarding.webdavDiagnostic.stages.${stage}`), reason: i18n.t(`onboarding.webdavDiagnostic.reasons.${reason}`, { status }) });
afterEach(async () => { cleanup(); window.kloda = undefined; await i18n.changeLanguage('tr'); });

it.each(['tr', 'en', 'de'])('G24-02/04/06: shows hints and a safe PROPFIND 404 diagnostic in %s', async (language) => {
  await i18n.changeLanguage(language);
  bridge({ testStorage: vi.fn().mockResolvedValue({ ok: false, code: 'unknown', message: secret,
    diagnostic: { stage: 'propfind', kind: 'http', status: 404, host: secret } }) });
  const endpoint = await openStorage();
  expect(endpoint).toHaveAccessibleDescription(i18n.t('onboarding.webdavHints.endpoint'));
  expect(screen.getByRole('textbox', { name: i18n.t('onboarding.targetPath') })).toHaveAccessibleDescription(i18n.t('onboarding.webdavHints.targetPath'));
  expect(screen.getByText(i18n.t('onboarding.webdavHints.security'))).toBeInTheDocument();
  fireEvent.change(endpoint, { target: { value: 'https://fixture.example:8083/webdav/' } });
  test();
  expect(await screen.findByRole('alert')).toHaveTextContent(i18n.t('onboarding.testErrors.unknown'));
  expect(screen.getByText(summary('propfind', 'not_found', 404))).toBeInTheDocument();
  expect(window.kloda?.saveStorage).toHaveBeenCalledWith(expect.objectContaining({ endpoint: 'https://fixture.example:8083/webdav/', targetPath: 'Kloda' }));
  expect(screen.getByRole('button', { name: i18n.t('onboarding.startBackup') })).toBeDisabled();
  expect(document.body.textContent).not.toContain(secret);
  expect(document.body.textContent).not.toMatch(/onboarding\./);
});

it('G24-05: a stale failure does not reach the edited form and edits clear a shown diagnostic', async () => {
  let finish!: (value: unknown) => void;
  const failure = { ok: false, code: 'access_denied', diagnostic: { stage: 'put', kind: 'http', status: 401 } };
  bridge({ testStorage: vi.fn().mockReturnValueOnce(new Promise((resolve) => { finish = resolve; })).mockResolvedValue(failure) });
  const endpoint = await openStorage();
  test();
  await waitFor(() => expect(window.kloda?.testStorage).toHaveBeenCalledOnce());
  fireEvent.change(endpoint, { target: { value: 'https://other.example/webdav/' } });
  await act(async () => { finish(failure); });
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(screen.queryByText(summary('put', 'access_denied', 401))).not.toBeInTheDocument();
  test();
  expect(await screen.findByText(summary('put', 'access_denied', 401))).toBeInTheDocument();
  fireEvent.change(endpoint, { target: { value: 'https://third.example/webdav/' } });
  expect(screen.queryByText(summary('put', 'access_denied', 401))).not.toBeInTheDocument();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

it('G24-06: a void or malformed reply is not success', async () => {
  bridge({ testStorage: vi.fn().mockResolvedValueOnce(undefined).mockResolvedValueOnce({ ok: 'true', code: secret }).mockResolvedValue({ ok: true }) });
  await openStorage();
  for (let attempt = 0; attempt < 2; attempt += 1) {
    test();
    await waitFor(() => expect(window.kloda?.testStorage).toHaveBeenCalledTimes(attempt + 1));
    expect(await screen.findByRole('alert')).toHaveTextContent(i18n.t('onboarding.testErrors.unknown'));
    expect(screen.queryByText(i18n.t('onboarding.verified'))).not.toBeInTheDocument();
  }
  test();
  expect(await screen.findByText(i18n.t('onboarding.verified'))).toBeInTheDocument();
  expect(screen.getByRole('button', { name: i18n.t('onboarding.startBackup') })).toBeEnabled();
  expect(document.body.textContent).not.toContain(secret);
});

it('G24-06: load, select, schedule, save and start failures show localized fallbacks, never raw messages', async () => {
  const leak = () => Promise.reject(new Error(secret));
  bridge({ getDraft: vi.fn(leak) });
  render(<BackupSetup visible />);
  expect(await screen.findByRole('alert')).toHaveTextContent(i18n.t('onboarding.loadError'));
  cleanup();
  bridge({ pickSources: vi.fn(leak), saveSchedule: vi.fn(leak), saveStorage: vi.fn(leak), startSync: vi.fn(leak) });
  render(<BackupSetup visible />);
  await screen.findByText('Documents');
  fireEvent.click(screen.getByRole('button', { name: i18n.t('onboarding.chooseFolders') }));
  expect(await screen.findByRole('alert')).toHaveTextContent(i18n.t('onboarding.selectError'));
  fireEvent.click(screen.getByRole('button', { name: i18n.t('onboarding.continue') }));
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(i18n.t('onboarding.scheduleError')));
  expect(document.body.textContent).not.toContain(secret);
  cleanup();
  bridge({ saveStorage: vi.fn(leak), testStorage: vi.fn().mockResolvedValue({ ok: true }), startSync: vi.fn(leak) });
  await openStorage();
  test();
  expect(await screen.findByRole('alert')).toHaveTextContent(i18n.t('onboarding.testError'));
  expect(window.kloda?.testStorage).not.toHaveBeenCalled();
  expect(document.body.textContent).not.toContain(secret);
});

it('G24-06: a start failure stays on the existing generic activity alert without the raw message', async () => {
  bridge({ getDraft: vi.fn().mockResolvedValue({ ...draft, storageTested: true }), startSync: vi.fn(() => Promise.reject(new Error(secret))) });
  await openStorage();
  fireEvent.click(screen.getByRole('button', { name: i18n.t('onboarding.startBackup') }));
  expect(await screen.findByText(i18n.t('activity.errors.unknown'))).toHaveAttribute('role', 'alert');
  expect(document.body.textContent).not.toContain(secret);
});

describe('G24-R1: leaving or hiding storage fences a pending test', () => {
  const failure = { ok: false, code: 'access_denied', diagnostic: { stage: 'put', kind: 'http', status: 403 } };
  async function pending() {
    let finish!: (reply: unknown) => void;
    bridge({ testStorage: vi.fn(() => new Promise((resolve) => { finish = resolve; })) });
    const endpoint = await openStorage();
    test();
    await waitFor(() => expect(window.kloda?.testStorage).toHaveBeenCalledOnce());
    return { endpoint, finish: (reply: unknown) => act(async () => { finish(reply); }) };
  }
  const reopen = async () => {
    fireEvent.click(screen.getByRole('button', { name: i18n.t('onboarding.continue') }));
    await screen.findByRole('textbox', { name: i18n.t('onboarding.endpoint') });
  };
  const noResult = () => {
    expect(screen.queryByText(summary('put', 'access_denied', 403))).not.toBeInTheDocument();
    expect(screen.queryByText(i18n.t('onboarding.testErrors.access_denied'))).not.toBeInTheDocument();
  };

  it('Back then a late failure shows nothing on sources or after reopening', async () => {
    const { finish } = await pending();
    fireEvent.click(screen.getByRole('button', { name: i18n.t('onboarding.back') }));
    await finish(failure);
    noResult();
    await reopen();
    noResult();
  });

  it('Back then a late success does not enable start', async () => {
    const { finish } = await pending();
    fireEvent.click(screen.getByRole('button', { name: i18n.t('onboarding.back') }));
    await finish({ ok: true });
    await reopen();
    expect(screen.queryByText(i18n.t('onboarding.verified'))).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: i18n.t('onboarding.startBackup') })).toBeDisabled();
  });

  it.each([failure, { ok: true }])('retained hidden setup ignores a late reply %# and clears a shown diagnostic', async (reply) => {
    const { finish } = await pending();
    rerenderVisible(false);
    await finish(reply);
    rerenderVisible(true);
    noResult();
    expect(screen.queryByText(i18n.t('onboarding.verified'))).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: i18n.t('onboarding.startBackup') })).toBeDisabled();
  });

  // App keeps visible=true on both /backup and /jobs and only toggles showActivity.
  const routeJobs = (showActivity: boolean) => mounted?.rerender(<BackupSetup visible showActivity={showActivity} />);

  it.each([failure, { ok: true }])('backup→jobs→backup ignores a late reply %# on sources and the reopened form', async (reply) => {
    const { finish } = await pending();
    routeJobs(true);
    await waitFor(() => expect(screen.queryByRole('textbox', { name: i18n.t('onboarding.endpoint') })).not.toBeInTheDocument());
    await finish(reply);
    routeJobs(false);
    await screen.findByText('Documents');
    noResult();
    await reopen();
    noResult();
    expect(screen.queryByText(i18n.t('onboarding.verified'))).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: i18n.t('onboarding.startBackup') })).toBeDisabled();
  });

  it('backup→jobs→backup clears a shown diagnostic and keeps form values; a fresh test still reports', async () => {
    bridge({ testStorage: vi.fn().mockResolvedValue(failure) });
    const endpoint = await openStorage();
    fireEvent.change(endpoint, { target: { value: 'https://fixture.example:8083/webdav/' } });
    test();
    expect(await screen.findByText(summary('put', 'access_denied', 403))).toBeInTheDocument();
    routeJobs(true);
    await waitFor(() => expect(screen.queryByRole('textbox', { name: i18n.t('onboarding.endpoint') })).not.toBeInTheDocument());
    routeJobs(false);
    await screen.findByText('Documents');
    expect(screen.queryByText(summary('put', 'access_denied', 403))).not.toBeInTheDocument();
    await reopen();
    expect(screen.getByRole('textbox', { name: i18n.t('onboarding.endpoint') })).toHaveValue('https://fixture.example:8083/webdav/');
    expect(screen.queryByText(summary('put', 'access_denied', 403))).not.toBeInTheDocument();
    test();
    expect(await screen.findByText(summary('put', 'access_denied', 403))).toBeInTheDocument();
  });

  it('hiding clears an already shown diagnostic; a fresh test after reopening still reports', async () => {
    bridge({ testStorage: vi.fn().mockResolvedValue(failure) });
    await openStorage();
    test();
    expect(await screen.findByText(summary('put', 'access_denied', 403))).toBeInTheDocument();
    rerenderVisible(false);
    rerenderVisible(true);
    expect(screen.queryByText(summary('put', 'access_denied', 403))).not.toBeInTheDocument();
    test();
    expect(await screen.findByText(summary('put', 'access_denied', 403))).toBeInTheDocument();
  });
});
