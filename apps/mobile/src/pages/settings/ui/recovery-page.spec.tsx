import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { Alert, type AlertButton } from 'react-native';
import { RecoveryPage } from './recovery-page';
import { cloudDestinations, type CloudDestination } from '../../../shared/api/cloud-destinations';
import { recoveryCode } from '../../../shared/api/recovery-code';
import { i18n } from '../../../shared/i18n';

jest.mock('../../../shared/api/cloud-destinations', () => ({
  ...jest.requireActual('../../../shared/api/cloud-destinations'),
  cloudDestinations: { list: jest.fn(), cancelSignIn: jest.fn() },
}));
jest.mock('../../../shared/api/recovery-code', () => ({
  ...jest.requireActual('../../../shared/api/recovery-code'),
  recoveryCode: { status: jest.fn(), reveal: jest.fn(), renew: jest.fn(), hide: jest.fn(), confirm: jest.fn(), copy: jest.fn() },
}));
const api = jest.mocked(cloudDestinations);
const recovery = jest.mocked(recoveryCode);
const groups = ['000G', '40R4', '0M30', 'E209', '185G', 'R38E', '1W81', '24GK', '2GAH', 'C5RR', '34D1', 'P70X', '3RFG', 'F3V8'];
const dav: CloudDestination = { targetId: 'A'.repeat(42) + 'E', provider: 'nextcloud', endpoint: 'https://c.example/dav', targetPath: 'Kloda', username: 'u', enabled: true };
beforeEach(() => {
  jest.clearAllMocks();
  api.list.mockResolvedValue([dav]); api.cancelSignIn.mockResolvedValue(); recovery.hide.mockResolvedValue();
});

it('renews only after the warning, confirms the new code and keeps the old one when cancelled', async () => {
  recovery.status.mockResolvedValue('confirmed');
  const alert = jest.spyOn(Alert, 'alert');
  const view = await render(<RecoveryPage onBack={jest.fn()} />);
  await waitFor(() => expect(view.getByRole('button', { name: i18n.t('recovery.renew') })).toBeTruthy());
  await fireEvent.press(view.getByRole('button', { name: i18n.t('recovery.renew') }));
  expect(alert.mock.calls[0]?.[1]).toContain(i18n.t('recovery.renewLimit'));
  expect(recovery.renew).not.toHaveBeenCalled();
  const accept = () => (alert.mock.calls.at(-1)?.[2] as AlertButton[])[1]!.onPress!();
  await waitFor(() => accept());
  await waitFor(() => expect(view.getByText(i18n.t('recovery.renewTitleShown'))).toBeTruthy());
  await fireEvent.press(view.getByRole('button', { name: i18n.t('recovery.renewCancel') }));
  expect(view.queryByText(i18n.t('recovery.renewTitleShown'))).toBeNull();
  await fireEvent.press(view.getByRole('button', { name: i18n.t('recovery.renew') }));
  await waitFor(() => accept());
  recovery.renew.mockResolvedValueOnce(groups);
  await fireEvent.press(view.getByRole('button', { name: i18n.t('recovery.show') }));
  expect(recovery.renew).toHaveBeenCalledWith(i18n.t('recovery.promptTitle'), i18n.t('recovery.renewPromptReason'));
  for (const field of view.getAllByLabelText(/^\d+\. grup$/)) await fireEvent.changeText(field, 'AAAA');
  recovery.confirm.mockResolvedValueOnce('confirmed');
  await fireEvent.press(view.getByRole('button', { name: i18n.t('recovery.renewConfirm') }));
  await waitFor(() => expect(view.getByText(i18n.t('recovery.renewDone'))).toBeTruthy());
  expect(view.queryByText(i18n.t('recovery.renewTitleShown'))).toBeNull();
  await view.unmount();
});

it('offers the code for destinations enabled before it, and the plain notice otherwise', async () => {
  recovery.status.mockResolvedValue('none');
  const view = await render(<RecoveryPage onBack={jest.fn()} />);
  await waitFor(() => expect(view.getByText(i18n.t('recovery.legacyTitle'))).toBeTruthy());
  await view.unmount();
  api.list.mockResolvedValue([{ ...dav, enabled: false }]);
  const plain = await render(<RecoveryPage onBack={jest.fn()} />);
  await waitFor(() => expect(plain.getByText(i18n.t('recovery.coversNone'))).toBeTruthy());
  expect(plain.queryByText(i18n.t('recovery.legacyTitle'))).toBeNull();
  await plain.unmount();
});
