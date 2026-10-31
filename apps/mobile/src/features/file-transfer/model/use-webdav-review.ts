import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { webDavReview, type WebDavIssue, type WebDavIssues } from '../../../shared/api/webdav-review';

export function useWebDavReview() {
  const [page, setPage] = useState<WebDavIssues | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<'completed' | 'skipped' | null>(null);
  const [working, setWorking] = useState(false);
  const [verified, setVerified] = useState(false);
  const mounted = useRef(false), active = useRef(false), busy = useRef(false), expanded = useRef(false);
  const reading = useRef<object | null>(null);
  const epoch = useRef(0), request = useRef<string | null>(null), snapshot = useRef<WebDavIssues | null>(null);
  const cancel = () => {
    const previous = request.current; request.current = null; busy.current = false;
    if (previous) void webDavReview.cancel(previous).catch(() => undefined);
  };
  const load = async (more = false) => {
    if (!active.current || busy.current || reading.current) return;
    const cursor = more ? snapshot.current?.nextCursor : undefined;
    if (more && !cursor) return;
    const ticket = {}; reading.current = ticket;
    const version = epoch.current;
    try {
      const value = await webDavReview.items(cursor);
      if (!mounted.current || !active.current || version !== epoch.current) return;
      const items = more ? [...(snapshot.current?.items ?? []), ...value.items] : value.items;
      const unique = [...new Map(items.map((item) => [item.id, item])).values()];
      const result = { ...value, items: unique };
      snapshot.current = result; expanded.current = more; setPage(result); setVerified(true); setError(value.errorCode ?? null);
    } catch (cause) {
      if (mounted.current && version === epoch.current) { setVerified(false); setError(cause instanceof Error ? cause.message : 'outcome_unknown'); }
    } finally { if (reading.current === ticket) reading.current = null; }
  };
  useEffect(() => {
    mounted.current = true; active.current = AppState.currentState !== 'background' && AppState.currentState !== 'inactive';
    const listener = AppState.addEventListener('change', (state) => {
      active.current = state === 'active'; epoch.current += 1; reading.current = null; cancel(); setWorking(false); setVerified(false);
      if (active.current) void load();
    });
    void load();
    const timer = setInterval(() => { if (!expanded.current) void load(); }, 1500);
    return () => { mounted.current = false; active.current = false; epoch.current += 1; cancel(); clearInterval(timer); listener.remove(); };
  }, []);
  const act = async (item: WebDavIssue, action: 'recheck' | 'keep_both' | 'skip') => {
    if (!active.current || !verified || busy.current || item.skipped || (action === 'recheck' && !item.canRecheck) || (action === 'keep_both' && !item.canKeepBoth)) return;
    const nonce = crypto.randomUUID(), version = ++epoch.current;
    request.current = nonce; busy.current = true; setWorking(true); setNotice(null); setActionError(null); setVerified(false);
    try {
      const requested = item.requiresAuthorization && action !== 'skip' ? action === 'recheck' ? 'authorize_recheck' : 'authorize_keep_both' : action;
      const state = await webDavReview.act(item.id, requested, nonce);
      if (mounted.current && active.current && version === epoch.current) setNotice(state);
    } catch (cause) {
      if (mounted.current && active.current && version === epoch.current) setActionError(cause instanceof Error ? cause.message : 'outcome_unknown');
    } finally {
      if (request.current === nonce) {
        request.current = null; busy.current = false;
        if (mounted.current) { setWorking(false); if (active.current) void load(); }
      }
    }
  };
  return { page, error: actionError ?? error, notice, working, verified, act, refresh: () => load(), more: () => load(true) };
}
