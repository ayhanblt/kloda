import { writeFileSync } from 'node:fs';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';
import { ComputerPage } from './computer-page';
import { pairing } from '../../../shared/api/pairing';
import { i18n } from '../../../shared/i18n';

jest.mock('sonner-native', () => ({ toast: { error: jest.fn(), success: jest.fn() } }));
jest.mock('../../../shared/api/backup-destinations', () => ({
  backupDestinations: { pcEnabled: jest.fn().mockResolvedValue(true), setPcEnabled: jest.fn().mockResolvedValue(false) },
}));
jest.mock('../../../shared/api/pairing', () => ({
  ...jest.requireActual('../../../shared/api/pairing'),
  pairing: {
    status: jest.fn(),
    pcScopeStatus: jest.fn(),
    scan: jest.fn(),
    approve: jest.fn(),
    deny: jest.fn(),
    cancel: jest.fn(),
    resume: jest.fn(),
    removePairing: jest.fn(),
    close: jest.fn().mockResolvedValue(undefined),
  },
}));

const initialAppState = AppState.currentState;
const complete = {
  phase: 'complete' as const,
  recordId: 'AAAAAAAAAAAAAAAAAAAAAA',
  peerFingerprint: 'fixture-pc-fingerprint',
  peerName: 'Ayhan Mac mini',
};
const callbacks = { onBack: jest.fn(), onActivity: jest.fn() };

beforeEach(() => {
  AppState.currentState = 'active';
  jest.mocked(pairing.status).mockReset();
  jest.mocked(pairing.pcScopeStatus!).mockReset();
  jest.clearAllMocks();
  jest.mocked(pairing.pcScopeStatus!).mockResolvedValue({ state: 'approved', peerName: 'Ayhan Mac mini' });
  jest.spyOn(AppState, 'addEventListener').mockImplementation(() => ({ remove: jest.fn() }));
});
afterEach(() => { AppState.currentState = initialAppState; jest.restoreAllMocks(); });

it('shows PC name, calm folder-approval prompt, collapsible fingerprint, and no WebDAV button', async () => {
  jest.mocked(pairing.status).mockResolvedValue(complete);
  jest.mocked(pairing.pcScopeStatus!).mockResolvedValueOnce({ state: 'not_approved', peerName: 'Ayhan Mac mini' });
  const surface = await render(<ComputerPage {...callbacks} />);
  await waitFor(() => expect(surface.getByText('Ayhan Mac mini')).toBeTruthy());
  expect(surface.getByText(i18n.t('computer.scopePendingTitle'))).toBeTruthy();
  expect(surface.queryByText(i18n.t('computer.advanced'))).toBeNull();
  expect(surface.queryByText(complete.peerFingerprint)).toBeNull();

  await fireEvent.press(surface.getByText(i18n.t('computer.securityDetails')));
  expect(surface.getByText(complete.peerFingerprint)).toBeTruthy();

  await fireEvent.press(surface.getByText(i18n.t('transfer.title')));
  expect(callbacks.onActivity).toHaveBeenCalledTimes(1);
  await surface.unmount();
});

it('removes old trust after a failed refresh and stops on background', async () => {
  jest.mocked(pairing.status).mockResolvedValueOnce(complete).mockRejectedValueOnce({ code: 'native_unsupported' });
  jest.mocked(pairing.pcScopeStatus!).mockResolvedValue({ state: 'unreachable', peerName: 'Ayhan Mac mini' });
  const surface = await render(<ComputerPage {...callbacks} />);
  await waitFor(() => expect(surface.getByText('Ayhan Mac mini')).toBeTruthy());
  await fireEvent.press(surface.getByText(i18n.t('pairing.refresh')));
  await waitFor(() => expect(surface.getByText(i18n.t('pairing.errors.native_unsupported'))).toBeTruthy());
  expect(surface.queryByText('Ayhan Mac mini')).toBeNull();
  await surface.unmount();

  let changed!: (state: AppStateStatus) => void;
  const subscription = jest.spyOn(AppState, 'addEventListener').mockImplementation((_e, cb) => {
    changed = cb; return { remove: jest.fn() };
  });
  let resolve!: (value: typeof complete) => void;
  jest.mocked(pairing.status).mockReturnValueOnce(new Promise((done) => { resolve = done; }));
  const bgSurface = await render(<ComputerPage {...callbacks} />);
  await act(async () => { AppState.currentState = 'background'; changed('background'); resolve(complete); });
  expect(bgSurface.queryByText('Ayhan Mac mini')).toBeNull();
  expect(bgSurface.getByText(i18n.t('computer.inactive'))).toBeTruthy();
  await bgSurface.unmount();
  subscription.mockRestore();
});

it('rejects incomplete evidence and renders across all three locales', async () => {
  jest.mocked(pairing.status).mockResolvedValueOnce({ phase: 'complete', repairRequired: false });
  const surface = await render(<ComputerPage {...callbacks} />);
  await waitFor(() => expect(surface.getByText(i18n.t('pairing.errors.outcome_unknown'))).toBeTruthy());
  expect(surface.queryByText(i18n.t('computer.paired'))).toBeNull();
  await surface.unmount();

  const original = i18n.language;
  try {
    for (const locale of ['tr', 'en', 'de']) {
      await i18n.changeLanguage(locale);
      jest.mocked(pairing.status).mockResolvedValue(complete);
      const view = await render(<ComputerPage {...callbacks} />);
      await waitFor(() => expect(view.getByText(i18n.t('computer.paired'))).toBeTruthy());
      if (process.env.KLODA_UI_EVIDENCE) writeFileSync(`${process.env.KLODA_UI_EVIDENCE}/computer-${locale}.json`, JSON.stringify(view.toJSON()));
      await view.unmount();
    }
  } finally { await i18n.changeLanguage(original); }
});
