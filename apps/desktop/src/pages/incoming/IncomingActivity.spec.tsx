import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';

import { IncomingActivity } from './IncomingActivity';
import { i18n } from '../../shared/i18n';
import type { IncomingActivityPage, IncomingTransfer } from '../../shared/api/desktop';

const partial: IncomingTransfer = {
  id: 'public-operation-1', deviceFingerprint: 'public-device-A', name: 'photo.png',
  receivedBytes: '3', totalBytes: '6', state: 'receiving',
};
const snapshot = (items: readonly IncomingTransfer[] = [partial]): IncomingActivityPage => ({ receiverAvailable: true, items });

function fixture(page = snapshot()) {
  let current = page;
  const activity = vi.fn<(cursor?: string) => Promise<IncomingActivityPage>>().mockImplementation(async () => current);
  const close = vi.fn();
  window.kloda = {
    background: { activity, status: vi.fn(), setAutostart: vi.fn(), quit: vi.fn() },
    pairing: { status: vi.fn(), createInvitation: vi.fn(), approve: vi.fn(), deny: vi.fn(), cancel: vi.fn(), resume: vi.fn(),
      approveBackup: vi.fn(), revokeBackup: vi.fn(), close },
    getDraft: vi.fn(), getProgress: vi.fn(), pickSources: vi.fn(), saveSchedule: vi.fn(), saveStorage: vi.fn(), startSync: vi.fn(), testStorage: vi.fn(),
  };
  return { activity, close, update: (next: IncomingActivityPage) => { current = next; } };
}
afterEach(() => { cleanup(); vi.useRealTimers(); window.kloda = undefined; });

it('shows exact device/file/durable bytes while publishing never becomes completion at 100 percent', async () => {
  fixture(snapshot([{ ...partial, state: 'publishing', receivedBytes: '6' }]));
  render(<IncomingActivity />);
  expect(await screen.findByText('photo.png')).toBeInTheDocument();
  expect(screen.getByText('public-device-A')).toBeInTheDocument();
  expect(screen.getByRole('progressbar')).toHaveAttribute('value', '100');
  expect(screen.getByText(i18n.t('incoming.states.publishing'))).toBeInTheDocument();
  expect(screen.queryByText(i18n.t('incoming.states.completed'))).not.toBeInTheDocument();
  expect(screen.getByText(i18n.t('incoming.missingMetadata'))).toBeInTheDocument();
  expect(screen.getByText(i18n.t('incoming.noAuthority'))).toBeInTheDocument();
});

it('retains exact integers above JS safe precision and treats empty pending files as incomplete', async () => {
  fixture(snapshot([{ ...partial, receivedBytes: '9007199254740993', totalBytes: '9007199254740994' },
    { ...partial, id: 'empty', name: 'empty.bin', receivedBytes: '0', totalBytes: '0' }]));
  render(<IncomingActivity />);
  await screen.findByText(i18n.t('incoming.bytes', { received: '9007199254740993', total: '9007199254740994' }));
  const progress = screen.getAllByRole('progressbar');
  expect(progress[0]).toHaveAttribute('value', '99.99');
  expect(progress[1]).toHaveAttribute('value', '0');
  expect(screen.queryByText(i18n.t('incoming.states.completed'))).not.toBeInTheDocument();
});

it('refreshes persisted progress, keeps stale data visibly non-live, and re-reads on reopening', async () => {
  vi.useFakeTimers();
  const { activity, close, update } = fixture();
  let view!: ReturnType<typeof render>;
  await act(async () => { view = render(<IncomingActivity />); });
  update({ ...snapshot([{ ...partial, receivedBytes: '6', state: 'validating' }]), receiverAvailable: false, errorCode: 'lan_unavailable' });
  await act(async () => { await vi.advanceTimersByTimeAsync(1500); });
  expect(screen.getByText(i18n.t('incoming.unavailable'))).toBeInTheDocument();
  expect(screen.getByText(i18n.t('incoming.stalePending'))).toBeInTheDocument();
  expect(screen.getByRole('alert')).toHaveTextContent(i18n.t('pairing.errors.lan_unavailable'));
  activity.mockRejectedValueOnce({ code: 'acl_unavailable' });
  await act(async () => { await vi.advanceTimersByTimeAsync(1500); });
  expect(screen.getByRole('progressbar')).toHaveAttribute('value', '100');
  expect(screen.queryByText(i18n.t('incoming.states.completed'))).not.toBeInTheDocument();
  view.unmount();
  update(snapshot([{ ...partial, receivedBytes: '6', state: 'completed' }]));
  await act(async () => { render(<IncomingActivity />); });
  expect(screen.getByText(i18n.t('incoming.states.completed'))).toBeInTheDocument();
  expect(close).not.toHaveBeenCalled();
});

it('uses native cursor pages and returns without accumulating a second client-side history', async () => {
  const { activity, update } = fixture({ ...snapshot(), nextCursor: 'page-1-tail' });
  render(<IncomingActivity />);
  await screen.findByText('photo.png');
  update(snapshot([{ ...partial, id: 'page-2-item', name: 'second.png' }]));
  fireEvent.click(screen.getByRole('button', { name: i18n.t('incoming.next') }));
  await screen.findByText('second.png');
  expect(activity).toHaveBeenLastCalledWith('page-1-tail');
  expect(screen.queryByText('photo.png')).not.toBeInTheDocument();
  update({ ...snapshot(), nextCursor: 'page-1-tail' });
  fireEvent.click(screen.getByRole('button', { name: i18n.t('incoming.previous') }));
  await screen.findByText('photo.png');
  expect(activity).toHaveBeenLastCalledWith(undefined);
});

it('coalesces pending polling and ignores its late reply after departure', async () => {
  vi.useFakeTimers();
  const { activity } = fixture();
  let finish!: (page: IncomingActivityPage) => void;
  activity.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
  let view!: ReturnType<typeof render>;
  await act(async () => { view = render(<IncomingActivity />); await vi.advanceTimersByTimeAsync(6000); });
  expect(activity).toHaveBeenCalledOnce();
  view.unmount();
  await act(async () => { finish(snapshot()); await vi.advanceTimersByTimeAsync(3000); });
  expect(activity).toHaveBeenCalledOnce();
  expect(screen.queryByText('photo.png')).not.toBeInTheDocument();
});

it('does not display an unreadable journal as an empty successful history', async () => {
  const { activity } = fixture();
  activity.mockRejectedValue({ code: 'acl_unavailable' });
  render(<IncomingActivity />);
  expect(await screen.findByRole('alert')).toHaveTextContent(i18n.t('pairing.errors.acl_unavailable'));
  expect(screen.queryByText(i18n.t('incoming.empty'))).not.toBeInTheDocument();
  expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  await waitFor(() => expect(screen.getByRole('button', { name: i18n.t('incoming.refresh') })).toBeEnabled());
});
