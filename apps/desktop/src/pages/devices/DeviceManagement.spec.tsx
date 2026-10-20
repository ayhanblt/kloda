import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';

import { DeviceManagement } from './DeviceManagement';
import { i18n } from '../../shared/i18n';
import type { PairedDevice, PairedDevicesPage } from '../../shared/api/desktop';

const device: PairedDevice = { recordId: 'record-A', peerFingerprint: 'fingerprint-A', trust: 'complete',
  backupScope: { state: 'approved', folder: '/fixture/backup' } };
const page = (items: readonly PairedDevice[] = [device]): PairedDevicesPage => ({ items });
function fixture(initial = page()) {
  let current = initial;
  const list = vi.fn<(after?: string) => Promise<PairedDevicesPage>>().mockImplementation(async () => current);
  const approveBackup = vi.fn(async () => undefined);
  const revokeBackup = vi.fn(async () => undefined);
  const removeDevice = vi.fn<(record: string, language: 'tr' | 'en' | 'de') => Promise<unknown>>(async () => undefined);
  window.kloda = { devices: { list, approveBackup, revokeBackup, removeDevice }, getDraft: vi.fn(), getProgress: vi.fn(), pickSources: vi.fn(),
    saveSchedule: vi.fn(), saveStorage: vi.fn(), startSync: vi.fn(), testStorage: vi.fn() };
  return { list, approveBackup, revokeBackup, removeDevice, update: (next: PairedDevicesPage) => { current = next; } };
}
afterEach(() => { cleanup(); vi.useRealTimers(); window.kloda = undefined; });

it('separates recorded trust, current own-backup permission and folder without inventing device metadata', async () => {
  fixture(page([device, { ...device, recordId: 'record-B', peerFingerprint: 'fingerprint-B', trust: 'consumed_pending_ack', backupScope: { state: 'not_approved' } }]));
  render(<DeviceManagement />);
  await screen.findByText('fingerprint-A');
  expect(screen.getByText('/fixture/backup')).toBeInTheDocument();
  expect(screen.getByText(i18n.t('devices.trust.complete'), { exact: false })).toBeInTheDocument();
  expect(screen.getByText(i18n.t('devices.permission.approved'), { exact: false })).toBeInTheDocument();
  expect(screen.getByText(i18n.t('devices.description'))).toBeInTheDocument();
  const pending = screen.getByText('fingerprint-B').closest('li')!;
  expect(within(pending).getByRole('button', { name: i18n.t('devices.grant') })).toBeDisabled();
  expect(within(pending).getByRole('button', { name: i18n.t('devices.revoke') })).toBeDisabled();
});

it('replaces old affirmative permissions with unknown after failed reads, recovers and rereads on reopening', async () => {
  vi.useFakeTimers();
  const { list, update } = fixture();
  let view!: ReturnType<typeof render>;
  await act(async () => { view = render(<DeviceManagement />); });
  list.mockRejectedValueOnce({ code: 'acl_busy' });
  await act(async () => { await vi.advanceTimersByTimeAsync(1500); });
  expect(screen.getByRole('alert')).toHaveTextContent(i18n.t('pairing.errors.acl_busy'));
  expect(screen.queryByText(i18n.t('devices.permission.approved'), { exact: false })).not.toBeInTheDocument();
  expect(screen.queryByText('/fixture/backup')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: i18n.t('devices.grant') })).toBeDisabled();
  update(page([{ ...device, backupScope: { state: 'revoked', folder: '/fixture/backup' } }]));
  await act(async () => { await vi.advanceTimersByTimeAsync(1500); });
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(screen.getByText(i18n.t('devices.permission.revoked'), { exact: false })).toBeInTheDocument();
  view.unmount();
  update(page([{ ...device, backupScope: { state: 'not_approved' } }]));
  await act(async () => { render(<DeviceManagement />); });
  expect(screen.getByText(i18n.t('devices.permission.not_approved'), { exact: false })).toBeInTheDocument();
});

it('targets exact selected records and rereads after grant and revoke without optimistic authorization', async () => {
  const { approveBackup, revokeBackup, update, list } = fixture(page([device, { ...device, recordId: 'record-B', peerFingerprint: 'fingerprint-B', backupScope: { state: 'not_approved' } }]));
  render(<DeviceManagement />);
  const row = (await screen.findByText('fingerprint-B')).closest('li')!;
  update(page([{ ...device, recordId: 'record-B', peerFingerprint: 'fingerprint-B' }]));
  await act(async () => { fireEvent.click(within(row).getByRole('button', { name: i18n.t('devices.grant') })); });
  expect(approveBackup).toHaveBeenCalledExactlyOnceWith('record-B');
  expect(list).toHaveBeenCalledTimes(2);
  update(page([{ ...device, recordId: 'record-B', peerFingerprint: 'fingerprint-B', backupScope: { state: 'revoked' } }]));
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: i18n.t('devices.revoke') })); });
  expect(revokeBackup).toHaveBeenCalledExactlyOnceWith('record-B');
  expect(list).toHaveBeenCalledTimes(3);
  expect(screen.getByText(i18n.t('devices.trust.complete'), { exact: false })).toBeInTheDocument();
  expect(screen.getByText(i18n.t('devices.revokeMeaning'))).toBeInTheDocument();
});

it('coalesces reads, suspends polling during mutation and ignores replies after departure', async () => {
  vi.useFakeTimers();
  const { list, revokeBackup } = fixture();
  let resolveRead!: (value: PairedDevicesPage) => void;
  list.mockReturnValueOnce(new Promise((resolve) => { resolveRead = resolve; }));
  let view!: ReturnType<typeof render>;
  await act(async () => { view = render(<DeviceManagement />); await vi.advanceTimersByTimeAsync(4500); });
  expect(list).toHaveBeenCalledOnce();
  await act(async () => { resolveRead(page()); });
  let resolveRevoke!: () => void;
  revokeBackup.mockReturnValueOnce(new Promise((resolve) => { resolveRevoke = () => resolve(undefined); }));
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: i18n.t('devices.revoke') })); await vi.advanceTimersByTimeAsync(4500); });
  expect(list).toHaveBeenCalledOnce();
  expect(screen.getByRole('button', { name: i18n.t('devices.revoke') })).toBeDisabled();
  view.unmount();
  await act(async () => { resolveRevoke(); await vi.advanceTimersByTimeAsync(3000); });
  expect(list).toHaveBeenCalledOnce();
});

it('uses native cursor pages and never retains another page as current authority', async () => {
  const { list, update } = fixture({ ...page(), nextCursor: 'tail-A' });
  render(<DeviceManagement />);
  await screen.findByText('fingerprint-A');
  update(page([{ ...device, recordId: 'record-B', peerFingerprint: 'fingerprint-B' }]));
  fireEvent.click(screen.getByRole('button', { name: i18n.t('incoming.next') }));
  await screen.findByText('fingerprint-B');
  expect(list).toHaveBeenLastCalledWith('tail-A');
  expect(screen.queryByText('fingerprint-A')).not.toBeInTheDocument();
  update(page());
  fireEvent.click(screen.getByRole('button', { name: i18n.t('incoming.previous') }));
  await screen.findByText('fingerprint-A');
  expect(list).toHaveBeenLastCalledWith(undefined);
});

it('reports command failure and query failure without claiming permission was revoked', async () => {
  const { revokeBackup, list } = fixture();
  render(<DeviceManagement />);
  await screen.findByText('fingerprint-A');
  revokeBackup.mockRejectedValueOnce({ code: 'cancelled' });
  list.mockRejectedValueOnce({ code: 'acl_unavailable' });
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: i18n.t('devices.revoke') })); });
  expect(screen.getAllByRole('alert')).toHaveLength(2);
  expect(screen.queryByText(i18n.t('devices.permission.approved'), { exact: false })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: i18n.t('devices.revoke') })).toBeDisabled();
});

it('allows revoking a known native scope when its target is unavailable without pretending it is approved', async () => {
  const { revokeBackup, update } = fixture(page([{ ...device, backupScope: { state: 'unavailable', revision: '4', errorCode: 'backup_scope_changed' } }]));
  render(<DeviceManagement />);
  await screen.findByText('fingerprint-A');
  expect(screen.queryByText(i18n.t('devices.permission.approved'), { exact: false })).not.toBeInTheDocument();
  expect(screen.getByRole('alert')).toHaveTextContent(i18n.t('pairing.errors.backup_scope_changed'));
  update(page([{ ...device, backupScope: { state: 'revoked', revision: '5' } }]));
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: i18n.t('devices.revoke') })); });
  expect(revokeBackup).toHaveBeenCalledExactlyOnceWith('record-A');
  expect(screen.getByText(i18n.t('devices.permission.revoked'), { exact: false })).toBeInTheDocument();
});

it('suspends the foreground grant epoch on departure and ignores a delayed grant result', async () => {
  const { approveBackup, list } = fixture();
  const close = vi.fn(async () => undefined);
  window.kloda!.pairing = { status: vi.fn(), createInvitation: vi.fn(), approve: vi.fn(), deny: vi.fn(), cancel: vi.fn(),
    resume: vi.fn(), approveBackup: vi.fn(), revokeBackup: vi.fn(), close };
  let finish!: () => void;
  approveBackup.mockReturnValueOnce(new Promise((resolve) => { finish = () => resolve(undefined); }));
  const view = render(<DeviceManagement />);
  await screen.findByText('fingerprint-A');
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: i18n.t('devices.grant') })); });
  view.unmount();
  expect(close).toHaveBeenCalledOnce();
  await act(async () => { finish(); });
  expect(list).toHaveBeenCalledOnce();
  expect(screen.queryByText('fingerprint-A')).not.toBeInTheDocument();
});

it('keeps device removal separate from access revoke and waits for native durable result and fresh records', async () => {
  const { removeDevice, revokeBackup, list, update } = fixture();
  let finish!: () => void;
  removeDevice.mockReturnValueOnce(new Promise((resolve) => { finish = () => resolve(undefined); }));
  render(<DeviceManagement />);
  await screen.findByText('fingerprint-A');
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: i18n.t('devices.remove') })); });
  expect(removeDevice).toHaveBeenCalledExactlyOnceWith('record-A', 'tr');
  expect(revokeBackup).not.toHaveBeenCalled();
  expect(list).toHaveBeenCalledOnce();
  expect(screen.getByText(i18n.t('devices.trust.complete'), { exact: false })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: i18n.t('devices.remove') })).toBeDisabled();
  update(page([{ ...device, trust: 'revoked', backupScope: { state: 'revoked', folder: '/fixture/backup' } }]));
  await act(async () => { finish(); });
  expect(list).toHaveBeenCalledTimes(2);
  expect(screen.getByText(`${i18n.t('devices.trustLabel')} ${i18n.t('devices.trust.revoked')}`)).toBeInTheDocument();
  expect(screen.getByText('/fixture/backup')).toBeInTheDocument();
  expect(screen.getByText(i18n.t('devices.removeMeaning'))).toBeInTheDocument();
  expect(screen.getByRole('button', { name: i18n.t('devices.remove') })).toBeDisabled();
});

it('requeries cancelled removal and shows unknown after removal/read failure instead of claiming device removed', async () => {
  const { removeDevice, list } = fixture();
  render(<DeviceManagement />);
  await screen.findByText('fingerprint-A');
  removeDevice.mockRejectedValueOnce({ code: 'cancelled' });
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: i18n.t('devices.remove') })); });
  expect(list).toHaveBeenCalledTimes(2);
  expect(screen.getByRole('alert')).toHaveTextContent(i18n.t('pairing.errors.cancelled'));
  expect(screen.getByText(i18n.t('devices.trust.complete'), { exact: false })).toBeInTheDocument();
  removeDevice.mockRejectedValueOnce({ code: 'storage_failure' });
  list.mockRejectedValueOnce({ code: 'acl_unavailable' });
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: i18n.t('devices.remove') })); });
  expect(screen.getAllByRole('alert')).toHaveLength(2);
  expect(screen.queryByText(i18n.t('devices.trust.revoked'), { exact: false })).not.toBeInTheDocument();
  expect(screen.getByText(`${i18n.t('devices.trustLabel')} ${i18n.t('devices.trust.unknown')}`)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: i18n.t('devices.remove') })).toBeDisabled();
});

it('allows removal of pending pairing trust and disables removal when the bridge lacks the operation', async () => {
  const { removeDevice } = fixture(page([{ ...device, trust: 'consumed_pending_ack', backupScope: { state: 'not_approved' } }]));
  const view = render(<DeviceManagement />);
  await screen.findByText('fingerprint-A');
  expect(screen.getByRole('button', { name: i18n.t('devices.grant') })).toBeDisabled();
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: i18n.t('devices.remove') })); });
  expect(removeDevice).toHaveBeenCalledExactlyOnceWith('record-A', 'tr');
  view.unmount();
  delete window.kloda!.devices!.removeDevice;
  render(<DeviceManagement />);
  await screen.findByText('fingerprint-A');
  expect(screen.getByRole('button', { name: i18n.t('devices.remove') })).toBeDisabled();
});
