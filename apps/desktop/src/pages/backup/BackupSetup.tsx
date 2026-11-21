import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { WebDavActivity } from './WebDavActivity';

import { getDesktopBridge, type BackupDraft, type SyncProgress } from '../../shared/api/desktop';
import { diagnosticReasonKey, parseStorageTestResult, type StorageTestDiagnostic } from '../../shared/api/webdav-test-result';

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
    })().then(([nextDraft, snapshot]) => {
      setDraft(nextDraft);
      setProgress(snapshot);
      if (nextDraft.storage) setStorage((current) => ({ ...current, ...nextDraft.storage }));
      if (snapshot && nextDraft.storageTested && nextDraft.sources.length > 0) setStep('activity');
    }).catch(() => setError(t('onboarding.loadError')));
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
      } finally { pending = false; }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 1000);
    return () => { active = false; window.clearInterval(timer); };
  }, [step, visible]);

  const selectSources = async () => {
    try {
      const sources = await getDesktopBridge().pickSources();
      setDraft((current) => ({ ...current, sources }));
      setError(null);
    } catch { setError(t('onboarding.selectError')); }
  };

  const continueToStorage = async () => {
    if (draft.sources.length === 0) return setError(t('onboarding.sourceRequired'));
    try {
      await getDesktopBridge().saveSchedule(draft.intervalHours, draft.localTime);
      setStep('storage');
      setError(null);
    } catch { setError(t('onboarding.scheduleError')); }
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
      void getDesktopBridge().getProgress().then((snapshot) => {
        if (failedVersion === progressVersion.current) setProgress(snapshot);
      }, () => {
        if (failedVersion === progressVersion.current) setProgress(null);
      });
    }
  };

  if (step === 'activity') return <WebDavActivity visible={visible} error={error} onBack={() => setStep('sources')} onSync={startSync} progress={progress} />;

  return (
    <main className="min-h-screen bg-background p-6 text-primary-text">
      <p className="text-xs font-semibold uppercase tracking-wide text-secondary-text">{t('onboarding.step', { current: step === 'sources' ? 1 : 2, total: 2 })}</p>
      {step === 'sources' ? (
        <>
          <h1 className="mt-4 text-3xl font-bold">{t('onboarding.sourceTitle')}</h1>
          <p className="mt-2 text-secondary-text">{t('onboarding.sourceDescription')}</p>
          <button className="mt-6 rounded-xl bg-button-brand px-4 py-3 font-semibold text-on-brand" onClick={() => void selectSources()} type="button">{t('onboarding.chooseFolders')}</button>
          <ul className="mt-4 list-inside list-disc">{draft.sources.map((source) => <li key={source.id}>{source.displayName}</li>)}</ul>
          <fieldset aria-describedby="desktop-schedule-runtime-hint" className="mt-6 grid gap-2"><legend className="font-semibold">{t('onboarding.frequency')}</legend>
            {[12, 24].map((hours) => <label key={hours}><input checked={draft.intervalHours === hours} name="interval" onChange={() => setDraft((current) => ({ ...current, intervalHours: hours as 12 | 24 }))} type="radio" /> {t('onboarding.everyHours', { hours })}</label>)}
          </fieldset>
          <label className="mt-4 grid gap-1">{t('onboarding.localStartTime')} <input aria-describedby="desktop-schedule-runtime-hint" aria-label={t('onboarding.localStartTime')} className="rounded-lg border border-border-subtle bg-surface-1 p-3" onChange={(event) => setDraft((current) => ({ ...current, localTime: event.target.value }))} type="time" value={draft.localTime} /></label>
          <p className="mt-2 text-sm text-stone-700" id="desktop-schedule-runtime-hint">{t('onboarding.desktopBackgroundHint')}</p>
          <button className="mt-6 rounded-xl bg-button-brand px-4 py-3 font-semibold text-on-brand" onClick={() => void continueToStorage()} type="button">{t('onboarding.continue')}</button>
        </>
      ) : (
        <>
          <h1 className="mt-4 text-3xl font-bold">{t('onboarding.storageTitle')}</h1>
          <p className="mt-2 text-secondary-text">{t('onboarding.storageDescription')}</p>
          <div className="mt-6 grid gap-3">{(['endpoint', 'targetPath', 'username', 'password'] as const).map((field) => <label className="grid gap-1 capitalize" key={field}>{t(`onboarding.${field}`)}<input aria-describedby={field === 'endpoint' || field === 'targetPath' ? `desktop-webdav-hint-${field}` : undefined} aria-label={t(`onboarding.${field}`)} className="rounded-lg border border-border-subtle bg-surface-1 p-3" onChange={(event) => editStorage(field, event.target.value)} type={field === 'password' ? 'password' : 'text'} value={storage[field]} />{(field === 'endpoint' || field === 'targetPath') && <span className="text-sm normal-case text-secondary-text" id={`desktop-webdav-hint-${field}`}>{t(`onboarding.webdavHints.${field}`)}</span>}</label>)}</div>
          <p className="mt-3 text-sm text-secondary-text">{t('onboarding.webdavHints.security')}</p>
          <button className="mt-6 rounded-xl border border-border-subtle bg-surface-1 px-4 py-3 font-semibold" onClick={() => void testStorage()} type="button">{t('onboarding.testConnection')}</button>
          {draft.storageTested && <p className="mt-3 text-emerald-700" role="status">{t('onboarding.verified')}</p>}
          <button className="mt-3 rounded-xl bg-button-brand px-4 py-3 font-semibold text-on-brand disabled:opacity-40" disabled={!draft.storageTested} onClick={() => void startSync()} type="button">{t('onboarding.startBackup')}</button>
          <button className="mt-3 text-secondary-text underline" onClick={() => setStep('sources')} type="button">{t('onboarding.back')}</button>
        </>
      )}
      {error && <p className="mt-4 text-danger-text" role="alert">{error}</p>}
      {error && diagnostic && <p className="mt-2 text-sm text-danger-text">{t('onboarding.webdavDiagnostic.summary', { reason: t(`onboarding.webdavDiagnostic.reasons.${diagnosticReasonKey(diagnostic)}`, { status: diagnostic.kind === 'http' ? diagnostic.status : undefined }), stage: t(`onboarding.webdavDiagnostic.stages.${diagnostic.stage}`) })}</p>}
    </main>
  );
}
