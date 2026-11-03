import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { cloudDestinations, destinationLimit, type CloudDestination, type OAuthProvider } from '../../../shared/api/cloud-destinations';

type Action = 'idle' | 'signing-in' | 'adding' | 'removing' | 'switching' | 'starting';
// Expo rejects with the native code in `code` (iOS wraps the message); a plain Error carries it as the message.
function code(cause: unknown): string {
  const value = typeof cause === 'object' && cause !== null && 'code' in cause ? cause.code : undefined;
  if (typeof value === 'string' && /^[a-z][a-z0-9_]{0,127}$/.test(value)) return value;
  return cause instanceof Error && /^[a-z][a-z0-9_]{0,127}$/.test(cause.message) ? cause.message : 'outcome_unknown';
}

// Saved destinations, Nextcloud and OAuth sign-in, Kolab Now credentials and the explicit per-destination opt-in;
// one action at a time, results ignored after unmount.
export function useCloudDestinations() {
  const [destinations, setDestinations] = useState<CloudDestination[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [action, setAction] = useState<Action>('idle');
  const [lastAdded, setLastAdded] = useState<string | null>(null);
  // ADR0029 29/1: the destination waiting for the recovery code to be confirmed before it is enabled.
  const [recoveryFor, setRecoveryFor] = useState<string | null>(null);
  const mounted = useRef(true);
  const busy = useRef(false);
  const refresh = async () => {
    try { const value = await cloudDestinations.list(); if (mounted.current) { setDestinations(value); setError(null); } }
    catch (cause) { if (mounted.current) setError(code(cause)); }
  };
  useEffect(() => {
    mounted.current = true; void refresh();
    const listener = AppState.addEventListener('change', (value) => { if (value === 'active' && !busy.current) void refresh(); });
    return () => { mounted.current = false; listener.remove(); void cloudDestinations.cancelSignIn().catch(() => undefined); };
  }, []);
  const run = async (kind: Exclude<Action, 'idle'>, operation: () => Promise<void>) => {
    if (busy.current) return;
    busy.current = true; setAction(kind); setError(null);
    try { await operation(); } catch (cause) { if (mounted.current) setError(code(cause)); }
    finally { busy.current = false; if (mounted.current) setAction('idle'); }
  };
  const added = (value: CloudDestination) => {
    if (!mounted.current) return;
    setDestinations((current) => [...(current ?? []).filter((item) => item.targetId !== value.targetId), value]);
    setLastAdded(value.targetId);
  };
  const signIn = (server: string, folder: string) => run('signing-in', async () => added(await cloudDestinations.signInNextcloud(server, folder)));
  const signInOAuth = (provider: OAuthProvider, folder: string) =>
    run('signing-in', async () => added(await cloudDestinations.signInOAuth(provider, folder)));
  const addKolabNow = (username: string, password: string, folder: string) =>
    run('adding', async () => added(await cloudDestinations.addKolabNow(username, password, folder)));
  const remove = (targetId: string) => run('removing', async () => {
    const value = await cloudDestinations.remove(targetId);
    if (mounted.current) setDestinations(value);
  });
  const setEnabled = (targetId: string, enabled: boolean) => run('switching', async () => {
    let value: CloudDestination[];
    try { value = await cloudDestinations.setEnabled(targetId, enabled); } catch (cause) {
      if (!enabled || code(cause) !== 'recovery_required') throw cause;
      if (mounted.current) setRecoveryFor(targetId);
      return;
    }
    if (mounted.current) { setDestinations(value); setRecoveryFor(null); }
  });
  const closeRecovery = () => setRecoveryFor(null);
  // A manual run is admitted by the shared queue; while one shows `running` the list is refreshed every 2 s.
  const runNow = (targetId: string) => run('starting', async () => {
    const value = await cloudDestinations.runNow(targetId);
    if (mounted.current) setDestinations(value);
  });
  const pause = (targetId: string) => run('switching', async () => {
    const value = await cloudDestinations.pause(targetId);
    if (mounted.current) setDestinations(value);
  });
  const active = destinations?.some((item) => item.run?.state === 'running') ?? false;
  useEffect(() => {
    if (!active) return undefined;
    const timer = setInterval(() => { if (!busy.current) void refresh(); }, 2000);
    return () => clearInterval(timer);
  }, [active]);
  const cancel = () => { void cloudDestinations.cancelSignIn().catch(() => undefined); };
  const full = (destinations?.length ?? 0) >= destinationLimit;
  return { destinations, error, action, full, lastAdded, recoveryFor, closeRecovery, signIn, signInOAuth, addKolabNow, remove, setEnabled, runNow, pause, cancel, refresh };
}
