import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import '../shared/i18n';
import { getDesktopBridge, type BackupDraft, type SyncProgress } from '../shared/api/desktop';

const emptyDraft: BackupDraft = {
  intervalHours: 12,
  localTime: '12:00',
  sources: [],
  storage: null,
  storageTested: false,
};

export function App() {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(emptyDraft);
  const [step, setStep] = useState<'sources' | 'storage' | 'activity'>('sources');
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<SyncProgress | null>(null);
  const [storage, setStorage] = useState({ endpoint: '', password: '', targetPath: 'Kloda', username: '' });

  useEffect(() => {
    void getDesktopBridge().getDraft().then((nextDraft) => {
      setDraft(nextDraft);
      if (nextDraft.storage) setStorage((current) => ({ ...current, ...nextDraft.storage }));
    }).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : t('onboarding.loadError')));
  }, []);

  const selectSources = async () => {
    try {
      const sources = await getDesktopBridge().pickSources();
      setDraft((current) => ({ ...current, sources }));
      setError(null);
    } catch (reason) { setError(reason instanceof Error ? reason.message : t('onboarding.selectError')); }
  };

  const continueToStorage = async () => {
    if (draft.sources.length === 0) return setError(t('onboarding.sourceRequired'));
    try {
      await getDesktopBridge().saveSchedule(draft.intervalHours, draft.localTime);
      setStep('storage');
      setError(null);
    } catch (reason) { setError(reason instanceof Error ? reason.message : t('onboarding.scheduleError')); }
  };

  const testStorage = async () => {
    try {
      await getDesktopBridge().saveStorage(storage);
      await getDesktopBridge().testStorage();
      setDraft((current) => ({ ...current, storageTested: true }));
      setError(null);
    } catch (reason) { setError(reason instanceof Error ? reason.message : t('onboarding.testError')); }
  };

  const startSync = async () => {
    try {
      setProgress(await getDesktopBridge().startSync());
      setStep('activity');
      setError(null);
    } catch (reason) { setError(reason instanceof Error ? reason.message : t('onboarding.startError')); }
  };

  if (step === 'activity') return <BackupActivity onSync={startSync} progress={progress} />;

  return (
    <main className="min-h-screen bg-surface p-6 text-ink">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{t('onboarding.step', { current: step === 'sources' ? 1 : 2, total: 2 })}</p>
      {step === 'sources' ? (
        <>
          <h1 className="mt-4 text-3xl font-bold">{t('onboarding.sourceTitle')}</h1>
          <p className="mt-2 text-muted">{t('onboarding.sourceDescription')}</p>
          <button className="mt-6 rounded-xl bg-ink px-4 py-3 font-semibold text-white" onClick={() => void selectSources()} type="button">{t('onboarding.chooseFolders')}</button>
          <ul className="mt-4 list-inside list-disc">{draft.sources.map((source) => <li key={source.id}>{source.displayName}</li>)}</ul>
          <fieldset className="mt-6 grid gap-2"><legend className="font-semibold">{t('onboarding.frequency')}</legend>
            {[12, 24].map((hours) => <label key={hours}><input checked={draft.intervalHours === hours} name="interval" onChange={() => setDraft((current) => ({ ...current, intervalHours: hours as 12 | 24 }))} type="radio" /> {t('onboarding.everyHours', { hours })}</label>)}
          </fieldset>
          <label className="mt-4 grid gap-1">{t('onboarding.localStartTime')} <input aria-label={t('onboarding.localStartTime')} className="rounded-lg border border-border bg-white p-3" onChange={(event) => setDraft((current) => ({ ...current, localTime: event.target.value }))} type="time" value={draft.localTime} /></label>
          <button className="mt-6 rounded-xl bg-ink px-4 py-3 font-semibold text-white" onClick={() => void continueToStorage()} type="button">{t('onboarding.continue')}</button>
        </>
      ) : (
        <>
          <h1 className="mt-4 text-3xl font-bold">{t('onboarding.storageTitle')}</h1>
          <p className="mt-2 text-muted">{t('onboarding.storageDescription')}</p>
          <div className="mt-6 grid gap-3">{(['endpoint', 'targetPath', 'username', 'password'] as const).map((field) => <label className="grid gap-1 capitalize" key={field}>{t(`onboarding.${field}`)}<input aria-label={t(`onboarding.${field}`)} className="rounded-lg border border-border bg-white p-3" onChange={(event) => setStorage((current) => ({ ...current, [field]: event.target.value }))} type={field === 'password' ? 'password' : 'text'} value={storage[field]} /></label>)}</div>
          <button className="mt-6 rounded-xl border border-border bg-white px-4 py-3 font-semibold" onClick={() => void testStorage()} type="button">{t('onboarding.testConnection')}</button>
          {draft.storageTested && <p className="mt-3 text-emerald-700" role="status">{t('onboarding.verified')}</p>}
          <button className="mt-3 rounded-xl bg-ink px-4 py-3 font-semibold text-white disabled:opacity-40" disabled={!draft.storageTested} onClick={() => void startSync()} type="button">{t('onboarding.startBackup')}</button>
          <button className="mt-3 text-muted underline" onClick={() => setStep('sources')} type="button">{t('onboarding.back')}</button>
        </>
      )}
      {error && <p className="mt-4 text-red-600" role="alert">{error}</p>}
    </main>
  );
}

function BackupActivity({ onSync, progress }: { onSync: () => Promise<void>; progress: SyncProgress | null }) {
  const { t } = useTranslation();
  return <main className="min-h-screen bg-surface p-6 text-ink"><h1 className="text-3xl font-bold">{t('onboarding.activityTitle')}</h1><p className="mt-2 text-muted">{progress ? t('onboarding.filesSynced', { completed: progress.completedFiles, total: progress.totalFiles }) : t('onboarding.ready')}</p><button className="mt-6 rounded-xl bg-ink px-4 py-3 font-semibold text-white" onClick={() => void onSync()} type="button">{t('onboarding.syncNow')}</button></main>;
}
