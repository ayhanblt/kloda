import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';

import { WebDavActivity } from './WebDavActivity';
import type { SyncProgress, WebDavIssue } from '../../shared/api/desktop';
import { i18n } from '../../shared/i18n';

const progress: SyncProgress = { id: 'run', status: 'stopped', completedFiles: 1, totalFiles: 2,
  bytesTotal: 2, bytesTransferred: 1, errorCode: 'settings_changed', startedAt: '2026-10-20T00:00:00.000Z',
  targetId: JSON.stringify(['https://user:secret@public.invalid/dav?token=secret', '/backup', 'user']), sourceIds: ['source-id'] };
const issue: WebDavIssue = { id: 'opaque-id', relativePath: 'photo.jpg', sourceId: 'source-id',
  targetId: progress.targetId!, revision: 'sha', phase: 'conflict', errorCode: 'review_required', canKeepBoth: true, skipped: false };
function fixture(rows: readonly WebDavIssue[] = []) {
  const issues = vi.fn<() => Promise<readonly WebDavIssue[]>>().mockResolvedValue(rows);
  const review = vi.fn().mockResolvedValue(undefined);
  window.kloda = { webdav: { issues, review }, getDraft: vi.fn(), getProgress: vi.fn(), pickSources: vi.fn(),
    saveSchedule: vi.fn(), saveStorage: vi.fn(), startSync: vi.fn(), testStorage: vi.fn() };
  return { issues, review };
}
const show = (snapshot: SyncProgress | null = progress, error: string | null = null) => render(<WebDavActivity
  error={error} onBack={vi.fn()} onSync={vi.fn()} progress={snapshot} visible />);
afterEach(async () => { cleanup(); vi.useRealTimers(); window.kloda = undefined; await i18n.changeLanguage('tr'); });

it.each(['tr', 'en', 'de'])('shows persisted settings stop, context and safe errors in %s', async (language) => {
  await i18n.changeLanguage(language);
  fixture(); show();
  await screen.findByText(i18n.t('activity.noIssues'));
  expect(screen.getByText(i18n.t('activity.errors.settings_changed'))).toBeInTheDocument();
  expect(screen.getByText(/https:\/\/public.invalid\/dav · \/backup/)).toBeInTheDocument();
  expect(document.body.textContent).not.toContain('secret');
  expect(document.body.textContent).not.toContain('activity.');
});

it('shows durable retry attempts and time without presenting completion', async () => {
  fixture(); show({ ...progress, status: 'waiting_retry', errorCode: 'connection_unavailable', attempts: 4, retryAt: 60000 });
  await screen.findByText(i18n.t('activity.noIssues'));
  expect(screen.getByText(i18n.t('activity.attempts', { count: 4, total: 5 }))).toBeInTheDocument();
  expect(screen.getByText(new RegExp(i18n.t('activity.retryAt')))).toBeInTheDocument();
  expect(screen.getByRole('status')).toHaveTextContent(i18n.t('activity.waiting_retry'));
  expect(screen.getByRole('status')).not.toHaveTextContent(i18n.t('activity.completed'));
});

it('never presents full success when unresolved rows or review count remain', async () => {
  fixture([issue]); show({ ...progress, status: 'completed', errorCode: undefined, reviewCount: 1 });
  await screen.findByText('photo.jpg');
  expect(screen.getByRole('status')).toHaveTextContent(i18n.t('activity.needs_review'));
  expect(screen.queryByText(i18n.t('activity.completed'))).not.toBeInTheDocument();
});

it.each(['recheck', 'keep_both', 'skip'] as const)('requires explicit %s action and rereads the durable result', async (action) => {
  const { review, issues } = fixture([issue]); show();
  await screen.findByText('photo.jpg');
  expect(review).not.toHaveBeenCalled();
  issues.mockResolvedValue([{ ...issue, skipped: true }]);
  fireEvent.click(screen.getByRole('button', { name: i18n.t(`activity.actions.${action}`) }));
  await screen.findByText(i18n.t('activity.skipped'));
  expect(review).toHaveBeenCalledExactlyOnceWith('opaque-id', action, 'tr');
});

it('keeps stale rows but disables every action after a failed reread', async () => {
  const { issues, review } = fixture([issue]); show();
  await screen.findByText('photo.jpg');
  issues.mockRejectedValue(new Error('private endpoint secret'));
  fireEvent.click(screen.getByRole('button', { name: i18n.t('activity.refreshIssues') }));
  await screen.findByText(i18n.t('activity.issuesUnavailable'));
  expect(screen.getByText('photo.jpg')).toBeInTheDocument();
  for (const action of ['recheck', 'keep_both', 'skip']) expect(screen.getByRole('button', { name: i18n.t(`activity.actions.${action}`) })).toBeDisabled();
  expect(review).not.toHaveBeenCalled();
  expect(document.body.textContent).not.toContain('private endpoint');
});

it('disables keep-both without source proof and never optimistically removes failed actions', async () => {
  const { review } = fixture([{ ...issue, canKeepBoth: false }]);
  review.mockRejectedValue(new Error('private error'));
  show(); await screen.findByText('photo.jpg');
  expect(screen.getByRole('button', { name: i18n.t('activity.actions.keep_both') })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: i18n.t('activity.actions.skip') }));
  await screen.findByText(i18n.t('activity.actionFailed'));
  expect(screen.getByText('photo.jpg')).toBeInTheDocument();
  expect(document.body.textContent).not.toContain('private error');
});

it('rereads on reopening and ignores late replies after departure', async () => {
  const { issues, review } = fixture();
  let finish!: (rows: readonly WebDavIssue[]) => void;
  issues.mockReturnValueOnce(new Promise((resolve) => { finish = resolve; }));
  const first = show(); first.unmount();
  await act(async () => { finish([issue]); });
  expect(screen.queryByText('photo.jpg')).not.toBeInTheDocument();
  issues.mockResolvedValue([{ ...issue, skipped: true }]);
  show(); await screen.findByText(i18n.t('activity.skipped'));
  expect(review).not.toHaveBeenCalled();
});

it('fails closed for an absent API and hides unclassified error strings', async () => {
  fixture(); delete window.kloda!.webdav;
  show({ ...progress, errorCode: 'secret diagnostic text' }, 'private host detail');
  await waitFor(() => expect(screen.getAllByRole('alert')).toHaveLength(2));
  expect(screen.queryByText(i18n.t('activity.noIssues'))).not.toBeInTheDocument();
  expect(document.body.textContent).not.toContain('secret diagnostic');
  expect(document.body.textContent).not.toContain('private host');
});
