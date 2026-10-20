import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';

import { BackupVersions } from './BackupVersions';
import { i18n } from '../../shared/i18n';
import type { BackupMutationResult, BackupVersion, BackupVersionPage } from '../../shared/api/desktop';

const version: BackupVersion = { id: 'version-1', deviceFingerprint: 'real-key-fingerprint', name: 'photo.png', size: '9007199254740993',
  sourceRevision: 'metadata-revision-2', kind: 'photos', state: 'active' };
function fixture(initial: BackupVersionPage = { items: [version] }) {
  let page = initial;
  const list = vi.fn<(after?: string, trash?: boolean) => Promise<BackupVersionPage>>().mockImplementation(async () => page);
  const trash = vi.fn<(ids: string[], language: 'tr' | 'en' | 'de') => Promise<BackupMutationResult>>()
    .mockImplementation(async (ids) => ({ items: ids.map((id) => ({ id, success: true })) }));
  const restore = vi.fn<typeof trash>().mockImplementation(async (ids) => ({ items: ids.map((id) => ({ id, success: true })) }));
  const close = vi.fn().mockResolvedValue(undefined);
  window.kloda = { backups: { list, trash, restore },
    pairing: { status: vi.fn(), createInvitation: vi.fn(), approve: vi.fn(), deny: vi.fn(), cancel: vi.fn(), resume: vi.fn(),
      approveBackup: vi.fn(), revokeBackup: vi.fn(), close },
    getDraft: vi.fn(), getProgress: vi.fn(), pickSources: vi.fn(), saveSchedule: vi.fn(), saveStorage: vi.fn(), startSync: vi.fn(), testStorage: vi.fn() };
  return { list, trash, restore, close, update: (next: BackupVersionPage) => { page = next; } };
}
afterEach(async () => { cleanup(); vi.useRealTimers(); window.kloda = undefined; await i18n.changeLanguage('tr'); });

it('shows real separate Photos version identities and exact bytes with no automatic mutation', async () => {
  const { trash, restore } = fixture({ items: [version, { ...version, id: 'version-2', sourceRevision: 'metadata-revision-3' }] });
  render(<BackupVersions />);
  await screen.findByText('metadata-revision-2');
  expect(screen.getByText('metadata-revision-3')).toBeInTheDocument();
  expect(screen.getAllByText(new RegExp(version.size))).toHaveLength(2);
  expect(screen.getAllByText(new RegExp(i18n.t('backups.manifestBytes', { bytes: version.size })))).toHaveLength(2);
  expect(screen.getAllByText(version.deviceFingerprint)).toHaveLength(2);
  expect(screen.getByText(i18n.t('backups.retention'))).toBeInTheDocument();
  expect(screen.getByText(i18n.t('backups.suppression'))).toBeInTheDocument();
  expect(trash).not.toHaveBeenCalled(); expect(restore).not.toHaveBeenCalled();
});

it('waits for native confirmation/result and reread for single deletion; never removes a row optimistically', async () => {
  const { trash, list, update } = fixture();
  let finish!: (value: BackupMutationResult) => void;
  trash.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
  render(<BackupVersions />);
  fireEvent.click(await screen.findByRole('button', { name: i18n.t('backups.deleteOne') }));
  expect(trash).toHaveBeenCalledWith(['version-1'], 'tr');
  expect(screen.getByText('photo.png')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: i18n.t('backups.deleteOne') })).toBeDisabled();
  update({ items: [] });
  await act(async () => { finish({ items: [{ id: version.id, success: true }] }); });
  await screen.findByText(i18n.t('backups.empty'));
  expect(list).toHaveBeenCalledTimes(2);
});

it('bulk selects only eligible versions on this page and reports missing or partial results without success', async () => {
  const { trash } = fixture({ items: [version, { ...version, id: 'version-2' }, { ...version, id: 'unverified', state: 'unavailable' }], nextCursor: 'next' });
  trash.mockResolvedValue({ items: [{ id: version.id, success: true }] });
  render(<BackupVersions />);
  fireEvent.click(await screen.findByLabelText(i18n.t('backups.selectPage')));
  fireEvent.click(screen.getByRole('button', { name: i18n.t('backups.deleteSelected', { count: 2 }) }));
  await waitFor(() => expect(trash).toHaveBeenCalledWith(['version-1', 'version-2'], 'tr'));
  expect(await screen.findByRole('alert')).toHaveTextContent('version-2');
  expect(screen.getByRole('alert')).toHaveTextContent(i18n.t('backups.errors.outcome_unknown'));
  expect(screen.getAllByRole('button', { name: i18n.t('backups.deleteOne') })[2]).toBeDisabled();
});

it('displays restore conflicts and deadline while leaving the trash entry available for retry', async () => {
  const { update, list, restore } = fixture();
  render(<BackupVersions />);
  await screen.findByText('photo.png');
  update({ items: [{ ...version, state: 'trash', deletedAt: '1700000000000', expiresAt: '1702592000000' }] });
  fireEvent.click(screen.getByRole('button', { name: i18n.t('backups.trash') }));
  const restoreButton = await screen.findByRole('button', { name: i18n.t('backups.restoreOne') });
  expect(list).toHaveBeenLastCalledWith(undefined, true);
  expect(document.querySelector('time')).toHaveAttribute('datetime', '2023-12-14T22:13:20.000Z');
  restore.mockResolvedValue({ items: [{ id: version.id, success: false, errorCode: 'conflict' }] });
  fireEvent.click(restoreButton);
  expect(await screen.findByRole('alert')).toHaveTextContent(i18n.t('backups.errors.conflict'));
  expect(screen.getByText('photo.png')).toBeInTheDocument();
  await waitFor(() => expect(restoreButton).toBeEnabled());
});

it('marks failed queries stale, disables actions, and reads durable state again after reopening', async () => {
  const { list, close, update } = fixture();
  const view = render(<BackupVersions />);
  await screen.findByText('photo.png');
  list.mockRejectedValueOnce({ code: 'acl_unavailable' });
  fireEvent.click(screen.getByRole('button', { name: i18n.t('incoming.refresh') }));
  await screen.findByRole('alert');
  expect(screen.getByText(i18n.t('backups.stale'))).toBeInTheDocument();
  expect(screen.getByRole('button', { name: i18n.t('backups.deleteOne') })).toBeDisabled();
  view.unmount();
  expect(close).toHaveBeenCalledOnce();
  update({ items: [] }); render(<BackupVersions />);
  await screen.findByText(i18n.t('backups.empty'));
  expect(screen.queryByText('photo.png')).not.toBeInTheDocument();
});

it('retains selection across native pages and ignores a late mutation after departure', async () => {
  const { list, update, trash } = fixture({ items: [version], nextCursor: 'version-1' });
  const view = render(<BackupVersions />);
  fireEvent.click(await screen.findByLabelText(i18n.t('backups.selectPage')));
  update({ items: [{ ...version, id: 'version-2', name: 'second.png' }] });
  fireEvent.click(screen.getByRole('button', { name: i18n.t('incoming.next') }));
  await screen.findByText('second.png');
  expect(list).toHaveBeenLastCalledWith('version-1', false);
  expect(screen.getByRole('button', { name: i18n.t('backups.deleteSelected', { count: 1 }) })).toBeEnabled();
  let finish!: (value: BackupMutationResult) => void;
  trash.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
  fireEvent.click(screen.getByRole('button', { name: i18n.t('backups.deleteOne') }));
  const calls = list.mock.calls.length;
  view.unmount();
  await act(async () => { finish({ items: [{ id: 'version-2', success: true }] }); });
  expect(list).toHaveBeenCalledTimes(calls);
});

it('coalesces pending reads and does not present an unreadable journal as empty', async () => {
  vi.useFakeTimers();
  const { list } = fixture();
  let fail!: (reason: unknown) => void;
  list.mockReturnValue(new Promise((_resolve, reject) => { fail = reject; }));
  await act(async () => { render(<BackupVersions />); await vi.advanceTimersByTimeAsync(6000); });
  expect(list).toHaveBeenCalledOnce();
  await act(async () => { fail({ code: 'backup_unavailable' }); });
  expect(screen.getByRole('alert')).toHaveTextContent(i18n.t('backups.unavailable'));
  expect(screen.queryByText(i18n.t('backups.empty'))).not.toBeInTheDocument();
});

it('selects versions across all native pages before one explicit bulk action', async () => {
  const { list, trash } = fixture({ items: [version], nextCursor: version.id });
  list.mockImplementation(async (after) => after ? { items: [{ ...version, id: 'version-2' }] }
    : { items: [version], nextCursor: version.id });
  render(<BackupVersions />);
  fireEvent.click(await screen.findByRole('button', { name: i18n.t('backups.selectAll') }));
  const bulk = await screen.findByRole('button', { name: i18n.t('backups.deleteSelected', { count: 2 }) });
  expect(trash).not.toHaveBeenCalled();
  expect(list).toHaveBeenLastCalledWith(version.id, false);
  fireEvent.click(bulk);
  await waitFor(() => expect(trash).toHaveBeenCalledWith(['version-1', 'version-2'], 'tr'));
});

it('keeps prior selection and clearly refuses to claim all when the bulk limit is exceeded', async () => {
  const { list, trash } = fixture();
  render(<BackupVersions />);
  fireEvent.click(await screen.findByLabelText(i18n.t('backups.selectPage')));
  list.mockResolvedValue({ items: Array.from({ length: 4097 }, (_, index) => ({ ...version, id: `bulk-${index}` })) });
  fireEvent.click(screen.getByRole('button', { name: i18n.t('backups.selectAll') }));
  expect(await screen.findByRole('alert')).toHaveTextContent(i18n.t('backups.selectionError'));
  expect(screen.getByRole('button', { name: i18n.t('backups.deleteSelected', { count: 1 }) })).toBeEnabled();
  expect(trash).not.toHaveBeenCalled();
});

it.each(['tr', 'en', 'de'])('provides %s labels without raw translation keys', async (language) => {
  await i18n.changeLanguage(language); fixture(); render(<BackupVersions />);
  await screen.findByText('photo.png');
  expect(screen.getByRole('button', { name: i18n.t('backups.deleteOne') })).toBeInTheDocument();
  expect(document.body.textContent).not.toContain('backups.');
});
