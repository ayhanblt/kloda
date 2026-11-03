import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { CloudDestinationList } from './cloud-destination-list';
import { CloudProviderPage } from './cloud-provider-page';
import { cloudDestinations, type CloudDestination } from '../../../shared/api/cloud-destinations';
import { useCloudDestinations } from '../../../features/cloud-destination/model/use-cloud-destinations';
import { i18n } from '../../../shared/i18n';

jest.mock('../../../shared/api/cloud-destinations', () => ({
  ...jest.requireActual('../../../shared/api/cloud-destinations'),
  cloudDestinations: { list: jest.fn(), signInNextcloud: jest.fn(), signInOAuth: jest.fn(), addKolabNow: jest.fn(), cancelSignIn: jest.fn(), remove: jest.fn(), setEnabled: jest.fn(), runNow: jest.fn(), pause: jest.fn() },
}));
const api = jest.mocked(cloudDestinations);
const row = (n: number, provider: CloudDestination['provider'], enabled = false): CloudDestination =>
  ({ targetId: String(n).padStart(42, 'A') + 'E', provider, endpoint: 'https://c.example/dav', targetPath: 'Kloda', username: `user${n}`, enabled });
beforeEach(() => { jest.clearAllMocks(); api.cancelSignIn.mockResolvedValue(); });

function List() { return <CloudDestinationList cloud={useCloudDestinations()} navigate={() => undefined} saved={null} />; }

it('switches a DAV destination, keeps OAuth unsupported and removes only after confirmation', async () => {
  const dav = row(1, 'nextcloud'), oauth = row(2, 'onedrive');
  const original = row(0, 'webdav');
  api.list.mockResolvedValue([original, dav, oauth]);
  api.setEnabled.mockResolvedValue([original, { ...dav, enabled: true }, oauth]);
  api.remove.mockResolvedValue([original, dav]);
  const alert = jest.spyOn(Alert, 'alert');
  const view = await render(<List />);
  await waitFor(() => expect(view.getByText('user2')).toBeTruthy());
  expect(view.queryByText('user0')).toBeNull();
  expect(view.getByText(i18n.t('transfer.errors.destination_unsupported'))).toBeTruthy();
  expect(view.getAllByRole('button', { name: i18n.t('destinations.enableSaved') })).toHaveLength(1);
  await fireEvent.press(view.getByRole('button', { name: i18n.t('destinations.enableSaved') }));
  await waitFor(() => expect(view.getByText(i18n.t('destinations.enabled'))).toBeTruthy());
  expect(api.setEnabled).toHaveBeenCalledWith(dav.targetId, true);
  await fireEvent.press(view.getAllByRole('button', { name: i18n.t('ui.conn.remove') })[1]);
  expect(api.remove).not.toHaveBeenCalled();
  const buttons = alert.mock.calls[0][2] ?? [];
  buttons.find((item) => item.style === 'destructive')?.onPress?.();
  await waitFor(() => expect(view.queryByText('user2')).toBeNull());
  expect(api.remove).toHaveBeenCalledWith(oauth.targetId);
  await view.unmount();
});

it('signs in to Nextcloud from the add page and returns after the destination is saved', async () => {
  api.list.mockResolvedValue([]);
  api.signInNextcloud.mockResolvedValue(row(3, 'nextcloud'));
  const saved = jest.fn();
  const view = await render(<CloudProviderPage provider="nextcloud" onBack={() => undefined} onSaved={saved} />);
  await waitFor(() => expect(view.getByLabelText(i18n.t('ui.providerFields.server')).props.editable).toBe(true));
  await fireEvent.changeText(view.getByLabelText(i18n.t('ui.providerFields.server')), 'https://c.example');
  await fireEvent.changeText(view.getByLabelText(i18n.t('ui.providerFields.folder')), 'Kloda');
  expect(saved).not.toHaveBeenCalled();
  await fireEvent.press(view.getByRole('button', { name: i18n.t('ui.conn.signIn') }));
  await waitFor(() => expect(saved).toHaveBeenCalledTimes(1));
  expect(api.signInNextcloud).toHaveBeenCalledWith('https://c.example', 'Kloda');
  await view.unmount();
});

it('runs an enabled DAV destination now and pauses it while running', async () => {
  const dav = row(4, 'nextcloud', true);
  api.list.mockResolvedValue([dav]);
  api.runNow.mockResolvedValue([{ ...dav, run: { state: 'running' } }]);
  api.pause.mockResolvedValue([{ ...dav, run: { state: 'paused', errorCode: 'target_pause' } }]);
  const view = await render(<List />);
  await fireEvent.press(await view.findByRole('button', { name: i18n.t('statusUi.backupNow') }));
  await waitFor(() => expect(view.getByText(i18n.t('destinations.states.running'))).toBeTruthy());
  expect(api.runNow).toHaveBeenCalledWith(dav.targetId);
  await fireEvent.press(view.getByRole('button', { name: i18n.t('statusUi.pause') }));
  await waitFor(() => expect(view.getByText(i18n.t('destinations.states.paused'))).toBeTruthy());
  expect(api.pause).toHaveBeenCalledWith(dav.targetId);
  await view.unmount();
});

it('lets an enabled Dropbox destination run like a DAV one (18B/5)', async () => {
  api.list.mockResolvedValue([row(7, 'dropbox', true), row(8, 'dropbox')]);
  const view = await render(<List />);
  await waitFor(() => expect(view.getByText('user8')).toBeTruthy());
  expect(view.queryByText(i18n.t('transfer.errors.destination_unsupported'))).toBeNull();
  expect(view.getAllByRole('button', { name: i18n.t('destinations.enableSaved') })).toHaveLength(1);
  expect(view.getAllByRole('button', { name: i18n.t('statusUi.backupNow') })).toHaveLength(1);
  await view.unmount();
});

it('offers no manual run for a disabled or unsupported OAuth destination', async () => {
  api.list.mockResolvedValue([row(5, 'nextcloud'), row(6, 'onedrive')]);
  const view = await render(<List />);
  await waitFor(() => expect(view.getByText('user6')).toBeTruthy());
  expect(view.queryByRole('button', { name: i18n.t('statusUi.backupNow') })).toBeNull();
  await view.unmount();
});
