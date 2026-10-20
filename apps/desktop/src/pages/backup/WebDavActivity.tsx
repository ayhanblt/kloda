import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { getDesktopBridge, type SyncProgress, type WebDavIssue } from '../../shared/api/desktop';

const errorCodes = ['connection_unavailable', 'access_denied', 'storage_full', 'source_changed', 'configuration_required',
  'interrupted', 'settings_changed', 'retry_exhausted', 'review_required', 'backup_busy'] as const;
const safeError = (code?: string) => errorCodes.find((known) => known === code) ?? 'unknown';

function targetLabel(targetId?: string): string | null {
  try {
    const parts: unknown = JSON.parse(targetId ?? '');
    if (!Array.isArray(parts) || parts.length !== 3 || !parts.every((part) => typeof part === 'string')) return null;
    const url = new URL(parts[0] as string);
    if (!['https:', 'http:'].includes(url.protocol)) return null;
    url.username = ''; url.password = ''; url.search = ''; url.hash = '';
    return `${url.toString()} · ${parts[1] as string}`;
  } catch { return null; }
}

export function WebDavActivity({ error, onBack, onSync, progress, visible }: {
  error: string | null; onBack: () => void; onSync: () => Promise<void>; progress: SyncProgress | null; visible: boolean;
}) {
  const { t, i18n } = useTranslation();
  const [issues, setIssues] = useState<readonly WebDavIssue[]>([]);
  const [verified, setVerified] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState(false);
  const generation = useRef(0);
  const reading = useRef(false);
  const refresh = useCallback(async () => {
    if (reading.current) return;
    reading.current = true;
    const version = generation.current;
    try {
      const api = getDesktopBridge().webdav;
      if (!api) throw new Error('unavailable');
      const next = await api.issues();
      if (version === generation.current) { setIssues(next); setVerified(true); }
    } catch {
      if (version === generation.current) setVerified(false);
    } finally { reading.current = false; }
  }, []);

  useEffect(() => {
    if (!visible) { setVerified(false); return; }
    void refresh();
    const timer = window.setInterval(() => void refresh(), 1500);
    return () => { generation.current += 1; setVerified(false); setBusy(false); window.clearInterval(timer); };
  }, [refresh, visible]);

  const review = async (id: string, action: 'recheck' | 'keep_both' | 'skip') => {
    if (!verified || busy || !visible) return;
    const version = ++generation.current;
    setBusy(true); setVerified(false); setActionError(false);
    try {
      const api = getDesktopBridge().webdav;
      if (!api) throw new Error('unavailable');
      const language = i18n.resolvedLanguage?.split('-')[0];
      await api.review(id, action, language === 'tr' || language === 'de' ? language : 'en');
    } catch {
      if (version === generation.current) setActionError(true);
    } finally {
      if (version === generation.current) { setBusy(false); void refresh(); }
    }
  };

  const needsReview = (progress?.reviewCount ?? 0) > 0 || issues.length > 0;
  const status = progress?.status === 'completed' && needsReview ? 'needs_review' : progress?.status;
  const target = targetLabel(progress?.targetId);
  return <main className="min-h-screen bg-surface p-6 text-ink">
    <h1 className="text-3xl font-bold">{t('onboarding.activityTitle')}</h1>
    {progress ? <section aria-label={t('activity.snapshot')} className="mt-4 rounded-2xl border border-border bg-white p-5">
      <p className="text-muted" role="status">{t('activity.snapshot')}: {t(`activity.${status}`)}</p>
      <p className="mt-2 text-muted">{t('onboarding.filesSynced', { completed: progress.completedFiles, total: progress.totalFiles })}</p>
      {progress.targetId && <p className="mt-2 break-all">{t('activity.target')}: {target ?? t('activity.contextUnknown')}</p>}
      {progress.sourceIds && <p className="mt-2 break-all">{t('activity.sources')}: {progress.sourceIds.join(', ')}</p>}
      {progress.startedAt !== undefined && <p className="mt-2">{t('activity.startedAt')}: {new Date(progress.startedAt).toLocaleString(i18n.language)}</p>}
      {progress.errorCode && <p className="mt-2 text-stone-700">{t(`activity.errors.${safeError(progress.errorCode)}`)}</p>}
      {progress.attempts !== undefined && <p className="mt-2">{t('activity.attempts', { count: progress.attempts, total: 5 })}</p>}
      {progress.retryAt !== undefined && <p className="mt-2">{t('activity.retryAt')}: {new Date(progress.retryAt).toLocaleString(i18n.language)}</p>}
    </section> : <p className="mt-2 text-muted">{t('activity.unknown')}</p>}
    {error && <p className="mt-4 text-red-700" role="alert">{t('activity.errors.unknown')}</p>}
    <section aria-labelledby="webdav-review-title" className="mt-6 rounded-2xl border border-border bg-white p-5">
      <h2 className="text-xl font-semibold" id="webdav-review-title">{t('activity.reviewTitle')}</h2>
      <p className="mt-2 text-sm text-stone-700">{t('activity.reviewHint')}</p>
      {!verified && <p className="mt-3 text-red-700" role="alert">{t('activity.issuesUnavailable')}</p>}
      {actionError && <p className="mt-3 text-red-700" role="alert">{t('activity.actionFailed')}</p>}
      {verified && issues.length === 0 && <p className="mt-3 text-muted">{t('activity.noIssues')}</p>}
      <ul aria-label={t('activity.reviewTitle')} className="mt-3 grid gap-3">{issues.map((issue) => <li className="rounded-xl border border-border p-4" key={issue.id}>
        <h3 className="break-all font-semibold">{issue.relativePath}</h3>
        <p className="mt-1 break-all text-sm">{t('activity.target')}: {targetLabel(issue.targetId) ?? t('activity.contextUnknown')}</p>
        <p className="mt-1 break-all text-sm">{t('activity.sources')}: {issue.sourceId}</p>
        <p className="mt-2">{t(`activity.errors.${safeError(issue.errorCode)}`)}</p>
        {issue.skipped && <p className="mt-2">{t('activity.skipped')}</p>}
        {issue.publishedPath && <p className="mt-2 break-all">{t('activity.publishedPath')}: {issue.publishedPath}</p>}
        <div className="mt-3 flex flex-wrap gap-3">{(['recheck', 'keep_both', 'skip'] as const).map((action) => <button
          className="rounded-xl border border-border bg-white px-4 py-3 font-semibold disabled:opacity-40"
          disabled={!visible || !verified || busy || (action === 'keep_both' && !issue.canKeepBoth)}
          key={action} onClick={() => void review(issue.id, action)} type="button">{t(`activity.actions.${action}`)}</button>)}</div>
      </li>)}</ul>
      <button className="mt-4 rounded-xl border border-border px-4 py-3 font-semibold disabled:opacity-40" disabled={!visible || busy}
        onClick={() => void refresh()} type="button">{t('activity.refreshIssues')}</button>
    </section>
    <button className="mt-6 rounded-xl bg-ink px-4 py-3 font-semibold text-white disabled:opacity-40" disabled={!visible || busy} onClick={() => void onSync()} type="button">{t('onboarding.syncNow')}</button>
    <button className="ml-4 text-stone-700" onClick={onBack} type="button">{t('onboarding.back')}</button>
  </main>;
}
