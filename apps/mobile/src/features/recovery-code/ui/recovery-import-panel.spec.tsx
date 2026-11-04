import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { RecoveryImportPanel } from './recovery-import-panel';
import { recoveryCode } from '../../../shared/api/recovery-code';
import { i18n } from '../../../shared/i18n';

jest.mock('../../../shared/api/recovery-code', () => ({
  ...jest.requireActual('../../../shared/api/recovery-code'),
  recoveryCode: { importCatalog: jest.fn() },
}));
const api = jest.mocked(recoveryCode);
const target = 'A'.repeat(42) + 'E';
const typed = '000g 40r4 0m30';
beforeEach(() => { jest.clearAllMocks(); });

async function submit(onBackups = jest.fn()) {
  const view = await render(<RecoveryImportPanel targetId={target} onCancel={jest.fn()} onBackups={onBackups} />);
  const field = view.getByLabelText(i18n.t('recovery.importField'));
  await fireEvent.changeText(field, typed);
  await fireEvent.press(view.getByRole('button', { name: i18n.t('recovery.importSubmit') }));
  return { view, field };
}

it('keeps a wrong code in the field and shows the invalid-code error', async () => {
  api.importCatalog.mockRejectedValueOnce(Object.assign(new Error('x'), { code: 'recovery_code_invalid' }));
  const { view, field } = await submit();
  await waitFor(() => expect(view.getByRole('alert')).toBeTruthy());
  expect(view.getByText(i18n.t('transfer.errors.recovery_code_invalid'))).toBeTruthy();
  expect(field.props.value).toBe(typed);
  expect(api.importCatalog).toHaveBeenCalledWith(target, typed);
  await view.unmount();
});

it('reports ready files, names unverified deltas without a count and clears the typed code', async () => {
  api.importCatalog.mockResolvedValueOnce({ chains: 1, deltas: 3, entries: 5, unverified: 2, imported: 5 });
  const onBackups = jest.fn();
  const { view, field } = await submit(onBackups);
  await waitFor(() => expect(view.getByText(i18n.t('recovery.importDone', { count: 5 }))).toBeTruthy());
  expect(view.getByText(i18n.t('recovery.unverifiedTitle'))).toBeTruthy();
  expect(view.queryByText(/2/)).toBeNull();
  expect(field.props.value).toBe('');
  await fireEvent.press(view.getByRole('button', { name: i18n.t('ui.conn.viewBackups') }));
  expect(onBackups).toHaveBeenCalledTimes(1);
  await view.unmount();
});

it('says nothing was found when the code has no chain on this destination', async () => {
  api.importCatalog.mockResolvedValueOnce({ chains: 0, deltas: 0, entries: 0, unverified: 0, imported: 0 });
  const { view } = await submit();
  await waitFor(() => expect(view.getByText(i18n.t('recovery.importNone'))).toBeTruthy());
  expect(view.queryByText(i18n.t('recovery.unverifiedTitle'))).toBeNull();
  expect(view.queryByRole('button', { name: i18n.t('ui.conn.viewBackups') })).toBeNull();
  await view.unmount();
});
