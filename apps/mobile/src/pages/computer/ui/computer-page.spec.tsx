import { writeFileSync } from 'node:fs';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';
import { ComputerPage } from './computer-page';
import { pairing } from '../../../shared/api/pairing';
import { i18n } from '../../../shared/i18n';

jest.mock('../../../shared/api/pairing', () => ({
  ...jest.requireActual('../../../shared/api/pairing'), pairing: { status: jest.fn() },
}));
const initialAppState = AppState.currentState;
beforeEach(() => { AppState.currentState = 'active'; jest.mocked(pairing.status).mockReset(); jest.clearAllMocks();
  jest.spyOn(AppState, 'addEventListener').mockImplementation(() => ({ remove: jest.fn() })); });
afterEach(() => { AppState.currentState = initialAppState; jest.restoreAllMocks(); });
const complete = { phase: 'complete' as const, recordId: 'AAAAAAAAAAAAAAAAAAAAAA', peerFingerprint: 'fixture-pc' };
const callbacks = { onBack: jest.fn(), onPair: jest.fn(), onActivity: jest.fn(), onAdvanced: jest.fn() };

it('separates native trust, PC-side grant and transfer navigation without claiming receiver readiness', async () => {
  jest.mocked(pairing.status).mockResolvedValue(complete);
  const surface = await render(<ComputerPage {...callbacks} />);
  await waitFor(() => expect(surface.getByText(i18n.t('computer.paired'))).toBeTruthy());
  expect(surface.getByText(i18n.t('computer.grantDescription'))).toBeTruthy();
  expect(surface.getByText(i18n.t('computer.availability'))).toBeTruthy();
  await fireEvent.press(surface.getByText(i18n.t('computer.managePairing')));
  expect(callbacks.onPair).toHaveBeenCalledTimes(1);
  await fireEvent.press(surface.getByText(i18n.t('transfer.title')));
  expect(callbacks.onActivity).toHaveBeenCalledTimes(1);
  await surface.unmount();
});

it('removes old successful trust after a failed refresh and keeps unsupported platforms visible', async () => {
  jest.mocked(pairing.status).mockResolvedValueOnce(complete).mockRejectedValueOnce({ code: 'native_unsupported' });
  const surface = await render(<ComputerPage {...callbacks} />);
  await waitFor(() => expect(surface.getByText(i18n.t('computer.paired'))).toBeTruthy());
  await fireEvent.press(surface.getByText(i18n.t('pairing.refresh')));
  await waitFor(() => expect(surface.getByText(i18n.t('pairing.errors.native_unsupported'))).toBeTruthy());
  expect(surface.queryByText(i18n.t('computer.paired'))).toBeNull();
  expect(surface.queryByText(i18n.t('transfer.peer', { fingerprint: complete.peerFingerprint }))).toBeNull();
  await surface.unmount();
});

it('does not adopt an old result after backgrounding or a newer refresh', async () => {
  let changed!: (state: AppStateStatus) => void;
  const subscription = jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, callback) => {
    changed = callback; return { remove: jest.fn() };
  });
  let resolve!: (value: typeof complete) => void;
  jest.mocked(pairing.status).mockReturnValueOnce(new Promise((done) => { resolve = done; }));
  const surface = await render(<ComputerPage {...callbacks} />);
  await act(async () => { AppState.currentState = 'background'; changed('background'); resolve(complete); });
  expect(surface.queryByText(i18n.t('computer.paired'))).toBeNull();
  expect(surface.getByText(i18n.t('computer.inactive'))).toBeTruthy();
  await surface.unmount();
  subscription.mockRestore();
});

it('rejects incomplete complete evidence and does not treat repair-required trust as usable', async () => {
  jest.mocked(pairing.status).mockResolvedValueOnce({ phase: 'complete', repairRequired: false });
  const surface = await render(<ComputerPage {...callbacks} />);
  await waitFor(() => expect(surface.getByText(i18n.t('pairing.errors.outcome_unknown'))).toBeTruthy());
  jest.mocked(pairing.status).mockResolvedValueOnce({ ...complete, repairRequired: true });
  await fireEvent.press(surface.getByText(i18n.t('pairing.refresh')));
  await waitFor(() => expect(surface.getByText(i18n.t('pairing.repairDescription'))).toBeTruthy());
  expect(surface.queryByText(i18n.t('computer.paired'))).toBeNull();
  await surface.unmount();
});


it('renders the approved flow and readable permission guidance in all three locales', async () => {
  const original = i18n.language;
  try {
    for (const locale of ['tr', 'en', 'de']) {
      await i18n.changeLanguage(locale);
      jest.mocked(pairing.status).mockResolvedValue(complete);
      const surface = await render(<ComputerPage {...callbacks} />);
      await waitFor(() => expect(surface.getByText(i18n.t('computer.paired'))).toBeTruthy());
      expect(surface.getByText(i18n.t('computer.grantDescription'))).toBeTruthy();
      if (process.env.KLODA_UI_EVIDENCE) writeFileSync(`${process.env.KLODA_UI_EVIDENCE}/computer-${locale}.json`, JSON.stringify(surface.toJSON()));
      await surface.unmount();
    }
  } finally { await i18n.changeLanguage(original); }
});
