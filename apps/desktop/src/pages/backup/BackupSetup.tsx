import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, CalendarClock, Check, Folder, FolderPlus } from 'lucide-react';

import { WebDavActivity } from './WebDavActivity';

import { getDesktopBridge, type BackupDraft, type SyncProgress } from '../../shared/api/desktop';
import { diagnosticReasonKey, parseStorageTestResult, type StorageTestDiagnostic } from '../../shared/api/webdav-test-result';
import { Notice, SectionTitle } from '../../shared/ui/Kit';

const emptyDraft: BackupDraft = {
  intervalHours: 12,
  localTime: '12:00',
  sources: [],
  storage: null,
  storageTested: false,
};

export function BackupSetup({ visible, showActivity = false }: { visible: boolean; showActivity?: boolean }) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(emptyDraft);
  const [step, setStep] = useState<'sources' | 'storage' | 'activity'>('sources');
  const previousActivity = useRef(false);

  useEffect(() => {
    if (!visible) return;
    if (showActivity) setStep('activity');
    else if (previousActivity.current) setStep('sources');
    previousActivity.current = showActivity;
  }, [visible, showActivity]);

  const [error, setError] = useState<string | null>(null);
  const [diagnostic, setDiagnostic] = useState<StorageTestDiagnostic | null>(null);
  const [progress, setProgress] = useState<SyncProgress | null>(null);
  const progressVersion = useRef(0);
  const storageVersion = useRef(0);
  const [storage, setStorage] = useState({ endpoint: '', password: '', targetPath: 'Kloda', username: '' });

  // Any end of the presented storage form (Back, jobs/activity, hide, unmount) ends ownership of a pending
  // test and clears its shown diagnostic. Layout timing: no late reply can run between commit and release.
  const storagePresented = visible && step === 'storage';
  useLayoutEffect(() => {
    if (storagePresented) return;
    storageVersion.current += 1;
    setDiagnostic(null);
  }, [storagePresented]);
  useEffect(() => () => { storageVersion.current += 1; }, []);

  useEffect(() => {
    void (async () => {
      const bridge = getDesktopBridge();
      return Promise.all([bridge.getDraft(), bridge.getProgress()]);
    })()
      .then(([nextDraft, snapshot]) => {
        setDraft(nextDraft);
        setProgress(snapshot);
        if (nextDraft.storage) setStorage((current) => ({ ...current, ...nextDraft.storage }));
        if (snapshot && nextDraft.storageTested && nextDraft.sources.length > 0) setStep('activity');
      })
      .catch(() => setError(t('onboarding.loadError')));
  }, []);

  useEffect(() => {
    if (step !== 'activity' || !visible) return;
    let active = true;
    let pending = false;
    const refresh = async () => {
      if (pending) return;
      pending = true;
      const version = progressVersion.current;
      try {
        const snapshot = await getDesktopBridge().getProgress();
        if (active && version === progressVersion.current) setProgress(snapshot);
      } catch {
        if (active && version === progressVersion.current) setProgress(null);
      } finally {
        pending = false;
      }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 1000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [step, visible]);

  const selectSources = async () => {
    try {
      const sources = await getDesktopBridge().pickSources();
      setDraft((current) => ({ ...current, sources }));
      setError(null);
    } catch {
      setError(t('onboarding.selectError'));
    }
  };

  const continueToStorage = async () => {
    if (draft.sources.length === 0) return setError(t('onboarding.sourceRequired'));
    try {
      await getDesktopBridge().saveSchedule(draft.intervalHours, draft.localTime);
      setStep('storage');
      setError(null);
    } catch {
      setError(t('onboarding.scheduleError'));
    }
  };

  const editStorage = (field: keyof typeof storage, value: string) => {
    storageVersion.current += 1;
    setStorage((current) => ({ ...current, [field]: value }));
    setDraft((current) => ({ ...current, storageTested: false }));
    setError(null);
    setDiagnostic(null);
  };

  const testStorage = async () => {
    const version = ++storageVersion.current;
    setDraft((current) => ({ ...current, storageTested: false }));
    setError(null);
    setDiagnostic(null);
    try {
      await getDesktopBridge().saveStorage(storage);
      if (version !== storageVersion.current) return;
      const result = parseStorageTestResult(await getDesktopBridge().testStorage());
      if (version !== storageVersion.current) return;
      if (result.ok) return setDraft((current) => ({ ...current, storageTested: true }));
      setError(t(`onboarding.testErrors.${result.code}`));
      setDiagnostic(result.diagnostic ?? null);
    } catch {
      if (version === storageVersion.current) setError(t('onboarding.testError'));
    }
  };

  const startSync = async () => {
    const version = ++progressVersion.current;
    setStep('activity');
    setError(null);
    try {
      const next = await getDesktopBridge().startSync();
      if (version !== progressVersion.current) return;
      progressVersion.current += 1;
      setProgress(next);
    } catch {
      if (version !== progressVersion.current) return;
      const failedVersion = ++progressVersion.current;
      setError(t('onboarding.startError'));
      void getDesktopBridge()
        .getProgress()
        .then(
          (snapshot) => {
            if (failedVersion === progressVersion.current) setProgress(snapshot);
          },
          () => {
            if (failedVersion === progressVersion.current) setProgress(null);
          },
        );
    }
  };

  if (step === 'activity') return <WebDavActivity error={error} onBack={() => setStep('sources')} onSync={startSync} progress={progress} visible={visible} />;

  return (
    <main className="space-y-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-secondary-text">
        {t('onboarding.step', { current: step === 'sources' ? 1 : 2, total: 2 })}
      </p>

      {step === 'sources' ? (
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold text-primary-text">{t('onboarding.sourceTitle')}</h2>
            <p className="mt-1 text-sm text-secondary-text">{t('onboarding.sourceDescription')}</p>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="pairing-card space-y-3 p-3">
              {draft.sources.length > 0 && (
                <ul className="divide-y divide-border-subtle">
                  {draft.sources.map((source) => (
                    <li className="flex items-center gap-3 px-2 py-3 text-sm font-medium text-primary-text" key={source.id}>
                      <Folder aria-hidden="true" className="shrink-0 text-secondary-text" size={18} strokeWidth={1.75} />
                      <span className="min-w-0 truncate">{source.displayName}</span>
                    </li>
                  ))}
                </ul>
              )}
              <div className="p-1">
                <button className="pairing-button w-full" onClick={() => void selectSources()} type="button">
                  <FolderPlus aria-hidden="true" size={18} />
                  {t('onboarding.chooseFolders')}
                </button>
              </div>
            </section>

            <section className="space-y-3">
              <SectionTitle className="!mt-0">{t('onboarding.frequency')}</SectionTitle>
              <div className="pairing-card space-y-4">
                <fieldset aria-describedby="desktop-schedule-runtime-hint" className="grid gap-2">
                  <legend className="sr-only">{t('onboarding.frequency')}</legend>
                  {[12, 24].map((hours) => {
                    const checked = draft.intervalHours === hours;
                    return (
                      <label
                        className={`flex min-h-12 cursor-pointer items-center justify-between gap-3 rounded-xl border p-3.5 transition-colors ${
                          checked ? 'border-[var(--action)] bg-surface-2/60 font-medium text-primary-text' : 'border-border-subtle text-secondary-text hover:bg-surface-2/30'
                        }`}
                        key={hours}
                      >
                        <span className="inline-flex items-center gap-2.5 text-sm">
                          <CalendarClock aria-hidden="true" size={16} />
                          {t('onboarding.everyHours', { hours })}
                        </span>
                        <input
                          checked={checked}
                          name="interval"
                          onChange={() => setDraft((current) => ({ ...current, intervalHours: hours as 12 | 24 }))}
                          type="radio"
                        />
                      </label>
                    );
                  })}
                </fieldset>

                <label className="grid gap-1.5 text-sm font-medium text-primary-text">
                  {t('onboarding.localStartTime')}
                  <input
                    aria-describedby="desktop-schedule-runtime-hint"
                    aria-label={t('onboarding.localStartTime')}
                    className="min-h-11 rounded-xl border border-border-subtle bg-surface-2/50 px-3 py-2 text-primary-text"
                    onChange={(event) => setDraft((current) => ({ ...current, localTime: event.target.value }))}
                    type="time"
                    value={draft.localTime}
                  />
                </label>

                <Notice>
                  <p id="desktop-schedule-runtime-hint">{t('onboarding.desktopBackgroundHint')}</p>
                </Notice>

                <button className="pairing-button pairing-button-primary w-full" onClick={() => void continueToStorage()} type="button">
                  {t('onboarding.continue')}
                </button>
              </div>
            </section>
          </div>
        </div>
      ) : (
        <section className="pairing-card max-w-2xl space-y-5">
          <div>
            <h2 className="text-xl font-semibold text-primary-text">{t('onboarding.storageTitle')}</h2>
            <p className="mt-1 text-sm text-secondary-text">{t('onboarding.storageDescription')}</p>
          </div>

          <div className="grid gap-4">
            {(['endpoint', 'targetPath', 'username', 'password'] as const).map((field) => (
              <label className="grid gap-1.5 text-sm font-medium text-primary-text" key={field}>
                {t(`onboarding.${field}`)}
                <input
                  aria-describedby={field === 'endpoint' || field === 'targetPath' ? `desktop-webdav-hint-${field}` : undefined}
                  aria-label={t(`onboarding.${field}`)}
                  className="min-h-11 rounded-xl border border-border-subtle bg-surface-2/50 px-3 py-2 text-primary-text"
                  onChange={(event) => editStorage(field, event.target.value)}
                  type={field === 'password' ? 'password' : 'text'}
                  value={storage[field]}
                />
                {(field === 'endpoint' || field === 'targetPath') && (
                  <span className="text-xs font-normal text-secondary-text" id={`desktop-webdav-hint-${field}`}>
                    {t(`onboarding.webdavHints.${field}`)}
                  </span>
                )}
              </label>
            ))}
          </div>

          <Notice>{t('onboarding.webdavHints.security')}</Notice>

          {draft.storageTested && (
            <Notice icon={Check} role="status" tone="ok">
              {t('onboarding.verified')}
            </Notice>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <button className="pairing-button" onClick={() => void testStorage()} type="button">
              {t('onboarding.testConnection')}
            </button>
            <button className="pairing-button pairing-button-primary" disabled={!draft.storageTested} onClick={() => void startSync()} type="button">
              {t('onboarding.startBackup')}
            </button>
            <button className="pairing-button pairing-button-quiet" onClick={() => setStep('sources')} type="button">
              <ArrowLeft aria-hidden="true" size={16} />
              {t('onboarding.back')}
            </button>
          </div>
        </section>
      )}

      {error && (
        <Notice role={diagnostic ? undefined : 'alert'} tone="danger">
          {diagnostic ? (
            <div className="space-y-1">
              <p role="alert">{error}</p>
              <p className="text-xs">
                {t('onboarding.webdavDiagnostic.summary', {
                  reason: t(`onboarding.webdavDiagnostic.reasons.${diagnosticReasonKey(diagnostic)}`, {
                    status: diagnostic.kind === 'http' ? diagnostic.status : undefined,
                  }),
                  stage: t(`onboarding.webdavDiagnostic.stages.${diagnostic.stage}`),
                })}
              </p>
            </div>
          ) : (
            error
          )}
        </Notice>
      )}
    </main>
  );
}
