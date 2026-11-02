import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { cloudDestinations, destinationLimit, type CloudDestination, type OAuthProvider } from '../../../shared/api/cloud-destinations';

type Action = 'idle' | 'signing-in' | 'adding' | 'removing' | 'switching';
function code(cause: unknown): string { return cause instanceof Error ? cause.message : 'outcome_unknown'; }

// Saved destinations, Nextcloud and OAuth sign-in, Kolab Now credentials and the explicit per-destination opt-in;
// one action at a time, results ignored after unmount.
export function useCloudDestinations() {
  const [destinations, setDestinations] = useState<CloudDestination[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [action, setAction] = useState<Action>('idle');
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
    if (mounted.current) setDestinations((current) => [...(current ?? []).filter((item) => item.targetId !== value.targetId), value]);
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
    const value = await cloudDestinations.setEnabled(targetId, enabled);
    if (mounted.current) setDestinations(value);
  });
  const cancel = () => { void cloudDestinations.cancelSignIn().catch(() => undefined); };
  const full = (destinations?.length ?? 0) >= destinationLimit;
  return { destinations, error, action, full, signIn, signInOAuth, addKolabNow, remove, setEnabled, cancel, refresh };
}
