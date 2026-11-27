import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, HardDrive, RefreshCw, Zap } from 'lucide-react';

import { getDesktopBridge, type SyncProgress, type WebDavIssue } from '../../shared/api/desktop';
import { Notice, StatusPill, type StatusTone } from '../../shared/ui/Kit';

const errorCodes = [
  'connection_unavailable',
  'access_denied',
  'storage_full',
  'source_changed',
  'configuration_required',
  'interrupted',
  'settings_changed',
  'retry_exhausted',
  'review_required',
  'backup_busy',
] as const;
const safeError = (code?: string) => errorCodes.find((known) => known === code) ?? 'unknown';

function targetLabel(targetId?: string): string | null {
  try {
    const parts: unknown = JSON.parse(targetId ?? '');
    if (!Array.isArray(parts) || parts.length !== 3 || !parts.every((part) => typeof part === 'string')) return null;
    const url = new URL(parts[0] as string);
    if (!['https:', 'http:'].includes(url.protocol)) return null;
    url.username = '';
    url.password = '';
    url.search = '';
    url.hash = '';
    return `${url.toString()} · ${parts[1] as string}`;
  } catch {
    return null;
  }
}

export function WebDavActivity({
  error,
  onBack,
  onSync,
  progress,
  visible,
}: {
  error: string | null;
  onBack: () => void;
  onSync: () => Promise<void>;
  progress: SyncProgress | null;
  visible: boolean;
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
      if (version === generation.current) {
        setIssues(next);
        setVerified(true);
      }
    } catch {
      if (version === generation.current) setVerified(false);
    } finally {
      reading.current = false;
    }
  }, []);

  useEffect(() => {
    if (!visible) {
      setVerified(false);
      return;
    }
    void refresh();
    const timer = window.setInterval(() => void refresh(), 1500);
    return () => {
      generation.current += 1;
      setVerified(false);
      setBusy(false);
      window.clearInterval(timer);
    };
  }, [refresh, visible]);

  const review = async (id: string, action: 'recheck' | 'keep_both' | 'skip') => {
    if (!verified || busy || !visible) return;
    const version = ++generation.current;
    setBusy(true);
    setVerified(false);
    setActionError(false);
    try {
      const api = getDesktopBridge().webdav;
      if (!api) throw new Error('unavailable');
      const language = i18n.resolvedLanguage?.split('-')[0];
      await api.review(id, action, language === 'tr' || language === 'de' ? language : 'en');
    } catch {
      if (version === generation.current) setActionError(true);
    } finally {
      if (version === generation.current) {
        setBusy(false);
        void refresh();
      }
    }
  };

  const needsReview = (progress?.reviewCount ?? 0) > 0 || issues.length > 0;
  const status = progress?.status === 'completed' && needsReview ? 'needs_review' : progress?.status;
  const target = targetLabel(progress?.targetId);
  const statusTone: StatusTone =
    status === 'completed' ? 'synced' : status === 'running' ? 'syncing' : status === 'needs_review' || status === 'waiting_retry' ? 'review' : 'pending';

  return (
    <main className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-primary-text">{t('onboarding.activityTitle')}</h2>
        <div className="flex flex-wrap gap-2">
          <button className="pairing-button pairing-button-primary !min-h-10 !px-4 !text-sm" disabled={!visible || busy} onClick={() => void onSync()} type="button">
            <Zap aria-hidden="true" size={16} />
            {t('onboarding.syncNow')}
          </button>
          <button className="pairing-button pairing-button-quiet !min-h-10 !px-3.5 !text-sm" onClick={onBack} type="button">
            <ArrowLeft aria-hidden="true" size={16} />
            {t('onboarding.back')}
          </button>
        </div>
      </div>

      {progress ? (
        <section aria-label={t('activity.snapshot')} className="pairing-card space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="inline-flex items-center gap-2 text-xs font-medium text-secondary-text">
              <HardDrive aria-hidden="true" size={16} />
              <span>{t('activity.target')}</span>
            </div>
            <StatusPill role="status" tone={statusTone}>
              {t('activity.snapshot')}: {t(`activity.${status}`)}
            </StatusPill>
          </div>

          <p className="text-base font-semibold tabular-nums text-primary-text">
            {t('onboarding.filesSynced', { completed: progress.completedFiles, total: progress.totalFiles })}
          </p>

          <div className="grid gap-1 text-sm text-secondary-text">
            {progress.targetId && (
              <p className="break-all">
                {t('activity.target')}: <span className="font-mono text-xs text-primary-text">{target ?? t('activity.contextUnknown')}</span>
              </p>
            )}
            {progress.sourceIds && (
              <p className="break-all">
                {t('activity.sources')}: {progress.sourceIds.join(', ')}
              </p>
            )}
            {progress.startedAt !== undefined && (
              <p>
                {t('activity.startedAt')}: {new Date(progress.startedAt).toLocaleString(i18n.language)}
              </p>
            )}
            {progress.errorCode && <p className="text-attention-text">{t(`activity.errors.${safeError(progress.errorCode)}`)}</p>}
            {progress.attempts !== undefined && (
              <p className="tabular-nums">{t('activity.attempts', { count: progress.attempts, total: 5 })}</p>
            )}
            {progress.retryAt !== undefined && (
              <p>
                {t('activity.retryAt')}: {new Date(progress.retryAt).toLocaleString(i18n.language)}
              </p>
            )}
          </div>
        </section>
      ) : (
        <Notice>{t('activity.unknown')}</Notice>
      )}

      {error && (
        <Notice role="alert" tone="danger">
          {t('activity.errors.unknown')}
        </Notice>
      )}

      <section aria-labelledby="webdav-review-title" className="pairing-card space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-primary-text" id="webdav-review-title">
              {t('activity.reviewTitle')}
            </h2>
            <p className="mt-1 text-xs text-secondary-text">{t('activity.reviewHint')}</p>
          </div>
          <button
            className="pairing-button !min-h-9 !px-3 !text-xs"
            disabled={!visible || busy}
            onClick={() => void refresh()}
            type="button"
          >
            <RefreshCw aria-hidden="true" size={14} />
            {t('activity.refreshIssues')}
          </button>
        </div>

        {!verified && (
          <Notice role="alert" tone="danger">
            {t('activity.issuesUnavailable')}
          </Notice>
        )}
        {actionError && (
          <Notice role="alert" tone="danger">
            {t('activity.actionFailed')}
          </Notice>
        )}
        {verified && issues.length === 0 && <p className="text-sm text-secondary-text">{t('activity.noIssues')}</p>}

        <ul aria-label={t('activity.reviewTitle')} className="grid gap-3">
          {issues.map((issue) => (
            <li className="rounded-xl border border-border-subtle bg-surface-2/40 p-4 space-y-2.5" key={issue.id}>
              <h3 className="break-all text-sm font-semibold text-primary-text">{issue.relativePath}</h3>
              <p className="break-all text-xs text-secondary-text">
                {t('activity.target')}: {targetLabel(issue.targetId) ?? t('activity.contextUnknown')}
              </p>
              <p className="break-all text-xs text-secondary-text">
                {t('activity.sources')}: {issue.sourceId}
              </p>
              <Notice tone="warn">{t(`activity.errors.${safeError(issue.errorCode)}`)}</Notice>
              {issue.skipped && <p className="text-xs text-secondary-text">{t('activity.skipped')}</p>}
              {issue.publishedPath && (
                <p className="break-all text-xs text-secondary-text">
                  {t('activity.publishedPath')}: {issue.publishedPath}
                </p>
              )}
              <div className="flex flex-wrap gap-2 pt-1">
                {(['recheck', 'keep_both', 'skip'] as const).map((action) => (
                  <button
                    className={`pairing-button !min-h-9 !px-3 !text-xs ${action === 'skip' ? 'pairing-button-quiet' : ''}`}
                    disabled={!visible || !verified || busy || (action === 'keep_both' && !issue.canKeepBoth)}
                    key={action}
                    onClick={() => void review(issue.id, action)}
                    type="button"
                  >
                    {t(`activity.actions.${action}`)}
                  </button>
                ))}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
