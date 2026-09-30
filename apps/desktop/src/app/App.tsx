import { useEffect, useState } from 'react';

import { getDesktopBridge, type BackupDraft, type SyncProgress } from '../shared/api/desktop';

const emptyDraft: BackupDraft = {
  intervalHours: 12,
  localTime: '12:00',
  sources: [],
  storage: null,
  storageTested: false,
};

export function App() {
  const [draft, setDraft] = useState(emptyDraft);
  const [step, setStep] = useState<'sources' | 'storage' | 'activity'>('sources');
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<SyncProgress | null>(null);
  const [storage, setStorage] = useState({ endpoint: '', password: '', targetPath: 'Kloda', username: '' });

  useEffect(() => {
    void getDesktopBridge().getDraft().then((nextDraft) => {
      setDraft(nextDraft);
      if (nextDraft.storage) setStorage((current) => ({ ...current, ...nextDraft.storage }));
    }).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Unable to load setup.'));
  }, []);

  const selectSources = async () => {
    try {
      const sources = await getDesktopBridge().pickSources();
      setDraft((current) => ({ ...current, sources }));
      setError(null);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to select folders.'); }
  };

  const continueToStorage = async () => {
    if (draft.sources.length === 0) return setError('Select at least one folder.');
    try {
      await getDesktopBridge().saveSchedule(draft.intervalHours, draft.localTime);
      setStep('storage');
      setError(null);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to save schedule.'); }
  };

  const testStorage = async () => {
    try {
      await getDesktopBridge().saveStorage(storage);
      await getDesktopBridge().testStorage();
      setDraft((current) => ({ ...current, storageTested: true }));
      setError(null);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'WebDAV test failed.'); }
  };

  const startSync = async () => {
    try {
      setProgress(await getDesktopBridge().startSync());
      setStep('activity');
      setError(null);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Backup could not start.'); }
  };

  if (step === 'activity') return <BackupActivity onSync={startSync} progress={progress} />;

  return (
    <main className="onboarding">
      <p className="step">Step {step === 'sources' ? '1' : '2'} of 2</p>
      {step === 'sources' ? (
        <>
          <h1>Select folders to back up</h1>
          <p>Kloda transfers directly to your personal storage.</p>
          <button onClick={() => void selectSources()} type="button">Choose folders</button>
          <ul>{draft.sources.map((source) => <li key={source.id}>{source.displayName}</li>)}</ul>
          <fieldset><legend>Auto-Sync Frequency</legend>
            {[12, 24].map((hours) => <label key={hours}><input checked={draft.intervalHours === hours} name="interval" onChange={() => setDraft((current) => ({ ...current, intervalHours: hours as 12 | 24 }))} type="radio" />Every {hours} hours</label>)}
          </fieldset>
          <label>Local start time <input aria-label="Local start time" onChange={(event) => setDraft((current) => ({ ...current, localTime: event.target.value }))} type="time" value={draft.localTime} /></label>
          <button onClick={() => void continueToStorage()} type="button">Continue to Storage Setup</button>
        </>
      ) : (
        <>
          <h1>Connect your personal storage</h1>
          <p>WebDAV access and write permission are verified before backup starts.</p>
          {(['endpoint', 'targetPath', 'username', 'password'] as const).map((field) => <label key={field}>{field}<input aria-label={field} onChange={(event) => setStorage((current) => ({ ...current, [field]: event.target.value }))} type={field === 'password' ? 'password' : 'text'} value={storage[field]} /></label>)}
          <button onClick={() => void testStorage()} type="button">Test WebDAV connection</button>
          {draft.storageTested && <p role="status">WebDAV access and writing verified.</p>}
          <button disabled={!draft.storageTested} onClick={() => void startSync()} type="button">Start Backup</button>
          <button onClick={() => setStep('sources')} type="button">Back</button>
        </>
      )}
      {error && <p role="alert">{error}</p>}
    </main>
  );
}

function BackupActivity({ onSync, progress }: { onSync: () => Promise<void>; progress: SyncProgress | null }) {
  return <main className="onboarding"><h1>Backup Activity</h1><p>{progress ? `${progress.completedFiles} of ${progress.totalFiles} files synced` : 'Ready to sync.'}</p><button onClick={() => void onSync()} type="button">Sync Now</button></main>;
}
