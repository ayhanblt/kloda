import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { webDavBackups, type WebDavBackups, type WebDavBackup } from '../../../shared/api/webdav-backups';

export function useWebDavRestore() {
  const [page, setPage] = useState<WebDavBackups | null>(null), [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false), [restored, setRestored] = useState<string | null>(null);
  const mounted = useRef(false), active = useRef(false), busy = useRef(false), epoch = useRef(0), request = useRef<string | null>(null);
  const cancel = () => {
    const old = request.current; request.current = null; busy.current = false; epoch.current += 1;
    if (old) void webDavBackups.cancel(old).catch(() => undefined);
  };
  useEffect(() => {
    mounted.current = true; active.current = AppState.currentState !== 'background' && AppState.currentState !== 'inactive';
    const listener = AppState.addEventListener('change', (state) => {
      active.current = state === 'active';
      // Native owns the picker hand-off and cancels actual background work.
      if (request.current === null) { cancel(); setWorking(false); }
    });
    return () => { mounted.current = false; active.current = false; cancel(); listener.remove(); };
  }, []);
  const load = async (more = false) => {
    if (busy.current || !active.current || (more && !page?.nextCursor)) return;
    const version = ++epoch.current; busy.current = true; setWorking(true); setError(null);
    try {
      const value = await webDavBackups.list(more ? page?.nextCursor : undefined);
      if (mounted.current && active.current && version === epoch.current) setPage({ ...value,
        items: more && page?.targetId === value.targetId ? [...new Map([...page.items, ...value.items].map((item) => [item.id, item])).values()] : value.items });
    } catch (cause) { if (mounted.current && version === epoch.current) setError(cause instanceof Error ? cause.message : 'outcome_unknown'); }
    finally { if (version === epoch.current) { busy.current = false; if (mounted.current) setWorking(false); } }
  };
  const restore = async (item: WebDavBackup) => {
    if (busy.current || !active.current || !page || (item.kind === 'file' ? !page.canRestoreFiles : !page.canRestorePhotos)) return;
    const nonce = crypto.randomUUID(), version = ++epoch.current;
    request.current = nonce; busy.current = true; setWorking(true); setRestored(null); setError(null);
    try {
      const result = await (item.kind === 'file' ? webDavBackups.restoreFile(item.id, nonce) : webDavBackups.restorePhotos(item.id, nonce));
      if (mounted.current && active.current && version === epoch.current) setRestored(result.name);
    } catch (cause) { if (mounted.current && version === epoch.current) setError(cause instanceof Error ? cause.message : 'outcome_unknown'); }
    finally { if (request.current === nonce) { request.current = null; busy.current = false; if (mounted.current) setWorking(false); } }
  };
  return { page, error, restored, working, load, restore, cancel: () => { cancel(); setWorking(false); } };
}
