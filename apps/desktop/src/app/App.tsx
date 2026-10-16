import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { HardDrive, Smartphone } from 'lucide-react';
import { Toaster } from 'sonner';

import '../shared/i18n';
import { getDesktopBridge, type BackupDraft, type SyncProgress } from '../shared/api/desktop';
import { PairingPage } from '../pages/pairing/PairingPage';

const emptyDraft: BackupDraft = {
  intervalHours: 12,
  localTime: '12:00',
  sources: [],
  storage: null,
  storageTested: false,
};

export function App() {
  const { t } = useTranslation();
  const [route, setRoute] = useState<'backup' | 'pairing'>(() => window.location.hash === '#/pairing' ? 'pairing' : 'backup');
  const protectedDecision = useRef(false);
  const [navigationBlocked, setNavigationBlocked] = useState(false);
  const onProtectedDecisionChange = useCallback((protectedByNativeStatus: boolean) => {
    // This only protects presentation; native candidate/commit validation owns trust.
    protectedDecision.current = protectedByNativeStatus;
    setNavigationBlocked(protectedByNativeStatus);
  }, []);
  const navigate = (next: 'backup' | 'pairing') => {
    if (protectedDecision.current) return;
    window.location.hash = `/${next}`;
    setRoute(next);
  };

  useEffect(() => {
    const onRouteChange = () => {
      if (protectedDecision.current && window.location.hash !== '#/pairing') {
        window.history.replaceState(window.history.state, '', '#/pairing');
        return;
      }
      setRoute(window.location.hash === '#/pairing' ? 'pairing' : 'backup');
    };
    window.addEventListener('hashchange', onRouteChange);
    return () => window.removeEventListener('hashchange', onRouteChange);
  }, []);

  return <>
    <nav aria-label={t('pairing.navigationLabel')} className="desktop-navigation">
      <span className="desktop-navigation-brand">Kloda: Secure Photos &amp; Sync</span>
      <button aria-current={route === 'backup' ? 'page' : undefined}
        disabled={navigationBlocked} onClick={() => navigate('backup')} type="button">
        <HardDrive aria-hidden="true" size={18} />{t('pairing.backupNavigation')}
      </button>
      <button aria-current={route === 'pairing' ? 'page' : undefined}
        disabled={navigationBlocked} onClick={() => navigate('pairing')} type="button">
        <Smartphone aria-hidden="true" size={18} />{t('pairing.pairingNavigation')}
      </button>
    </nav>
    <div hidden={route !== 'backup'}><BackupSetup visible={route === 'backup'} /></div>
    {route === 'pairing' && <PairingPage onProtectedDecisionChange={onProtectedDecisionChange} />}
    <Toaster closeButton containerAriaLabel={t('pairing.notificationsLabel')} hotkey={[]} position="bottom-right" theme="light"
      toastOptions={{ closeButtonAriaLabel: t('pairing.dismissNotification') }} />
  </>;
}

function BackupSetup({ visible }: { visible: boolean }) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(emptyDraft);
  const [step, setStep] = useState<'sources' | 'storage' | 'activity'>('sources');
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<SyncProgress | null>(null);
  const progressVersion = useRef(0);
  const storageVersion = useRef(0);
  const [storage, setStorage] = useState({ endpoint: '', password: '', targetPath: 'Kloda', username: '' });

  useEffect(() => {
    void (async () => {
      const bridge = getDesktopBridge();
      return Promise.all([bridge.getDraft(), bridge.getProgress()]);
    })().then(([nextDraft, snapshot]) => {
      setDraft(nextDraft);
      setProgress(snapshot);
      if (nextDraft.storage) setStorage((current) => ({ ...current, ...nextDraft.storage }));
      if (snapshot && nextDraft.storageTested && nextDraft.sources.length > 0) setStep('activity');
    }).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : t('onboarding.loadError')));
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

  const editStorage = (field: keyof typeof storage, value: string) => {
    storageVersion.current += 1;
    setStorage((current) => ({ ...current, [field]: value }));
    setDraft((current) => ({ ...current, storageTested: false }));
    setError(null);
  };

  const testStorage = async () => {
    const version = ++storageVersion.current;
    setDraft((current) => ({ ...current, storageTested: false }));
    setError(null);
    try {
      await getDesktopBridge().saveStorage(storage);
      if (version !== storageVersion.current) return;
      await getDesktopBridge().testStorage();
      if (version !== storageVersion.current) return;
      setDraft((current) => ({ ...current, storageTested: true }));
    } catch (reason) {
      if (version === storageVersion.current) setError(reason instanceof Error ? reason.message : t('onboarding.testError'));
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
    } catch (reason) {
      if (version !== progressVersion.current) return;
      const failedVersion = ++progressVersion.current;
      setError(reason instanceof Error ? reason.message : t('onboarding.startError'));
      void getDesktopBridge().getProgress().then((snapshot) => {
        if (failedVersion === progressVersion.current) setProgress(snapshot);
      }, () => {
        if (failedVersion === progressVersion.current) setProgress(null);
      });
    }
  };

  if (step === 'activity') return <BackupActivity error={error} onBack={() => setStep('sources')} onSync={startSync} progress={progress} />;

  return (
    <main className="min-h-screen bg-surface p-6 text-ink">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{t('onboarding.step', { current: step === 'sources' ? 1 : 2, total: 2 })}</p>
      {step === 'sources' ? (
        <>
          <h1 className="mt-4 text-3xl font-bold">{t('onboarding.sourceTitle')}</h1>
          <p className="mt-2 text-muted">{t('onboarding.sourceDescription')}</p>
          <button className="mt-6 rounded-xl bg-ink px-4 py-3 font-semibold text-white" onClick={() => void selectSources()} type="button">{t('onboarding.chooseFolders')}</button>
          <ul className="mt-4 list-inside list-disc">{draft.sources.map((source) => <li key={source.id}>{source.displayName}</li>)}</ul>
          <fieldset aria-describedby="desktop-schedule-runtime-hint" className="mt-6 grid gap-2"><legend className="font-semibold">{t('onboarding.frequency')}</legend>
            {[12, 24].map((hours) => <label key={hours}><input checked={draft.intervalHours === hours} name="interval" onChange={() => setDraft((current) => ({ ...current, intervalHours: hours as 12 | 24 }))} type="radio" /> {t('onboarding.everyHours', { hours })}</label>)}
          </fieldset>
          <label className="mt-4 grid gap-1">{t('onboarding.localStartTime')} <input aria-describedby="desktop-schedule-runtime-hint" aria-label={t('onboarding.localStartTime')} className="rounded-lg border border-border bg-white p-3" onChange={(event) => setDraft((current) => ({ ...current, localTime: event.target.value }))} type="time" value={draft.localTime} /></label>
          <p className="mt-2 text-sm text-stone-700" id="desktop-schedule-runtime-hint">{t('onboarding.desktopBackgroundHint')}</p>
          <button className="mt-6 rounded-xl bg-ink px-4 py-3 font-semibold text-white" onClick={() => void continueToStorage()} type="button">{t('onboarding.continue')}</button>
        </>
      ) : (
        <>
          <h1 className="mt-4 text-3xl font-bold">{t('onboarding.storageTitle')}</h1>
          <p className="mt-2 text-muted">{t('onboarding.storageDescription')}</p>
          <div className="mt-6 grid gap-3">{(['endpoint', 'targetPath', 'username', 'password'] as const).map((field) => <label className="grid gap-1 capitalize" key={field}>{t(`onboarding.${field}`)}<input aria-label={t(`onboarding.${field}`)} className="rounded-lg border border-border bg-white p-3" onChange={(event) => editStorage(field, event.target.value)} type={field === 'password' ? 'password' : 'text'} value={storage[field]} /></label>)}</div>
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

function BackupActivity({ error, onBack, onSync, progress }: {
  error: string | null; onBack: () => void; onSync: () => Promise<void>; progress: SyncProgress | null;
}) {
  const { t } = useTranslation();
  return <main className="min-h-screen bg-surface p-6 text-ink">
    <h1 className="text-3xl font-bold">{t('onboarding.activityTitle')}</h1>
    {progress ? <>
      <p className="mt-2 text-muted">{t('activity.snapshot')}: {t(`activity.${progress.status}`)}</p>
      <p className="mt-2 text-muted">{t('onboarding.filesSynced', { completed: progress.completedFiles, total: progress.totalFiles })}</p>
    </> : <p className="mt-2 text-muted">{t('activity.unknown')}</p>}
    {error && <p className="mt-4 text-red-600" role="alert">{error}</p>}
    <button className="mt-6 rounded-xl bg-ink px-4 py-3 font-semibold text-white" onClick={() => void onSync()} type="button">{t('onboarding.syncNow')}</button>
    <button className="ml-4 text-stone-700" onClick={onBack} type="button">{t('onboarding.back')}</button>
  </main>;
}
