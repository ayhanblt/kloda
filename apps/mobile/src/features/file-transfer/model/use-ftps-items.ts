import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { ftps, ftpsErrorCode } from '../../../shared/api/ftps';
import { ftpsBackups, type FtpsItem, type FtpsPage } from '../../../shared/api/ftps-backups';

export function useFtpsItems(issues: boolean) {
  const [page,setPage] = useState<FtpsPage | null>(null), [error,setError] = useState<string | null>(null), [notice,setNotice] = useState<string | null>(null);
  const [working,setWorking] = useState(false), [available,setAvailable] = useState(false);
  const mounted = useRef(false), active = useRef(true), busy = useRef(false), epoch = useRef(0), request = useRef<string | null>(null);
  const choosing = useRef(false);
  const cancel = () => {
    const ticket = request.current; request.current = null; choosing.current = false; busy.current = false; epoch.current++;
    if (ticket) void ftpsBackups.cancel(ticket,issues).catch(() => undefined);
  };
  useEffect(() => {
    mounted.current = true; active.current = AppState.currentState !== 'background' && AppState.currentState !== 'inactive';
    void ftps.status().then(value => { if (mounted.current) setAvailable(value.supported && value.configured); }).catch(() => undefined);
    const listener = AppState.addEventListener('change', state => {
      active.current = state === 'active';
      // Native owns the Files picker handoff; review never survives leaving foreground.
      if (issues || !choosing.current || request.current === null) { cancel(); setWorking(false); }
    });
    return () => { mounted.current = false; active.current = false; cancel(); listener.remove(); };
  },[issues]);
  const load = async (more = false) => {
    if (busy.current || !active.current || (more && !page?.next)) return;
    const version = ++epoch.current; busy.current = true; setWorking(true); setError(null);
    try {
      const value = await ftpsBackups.list(more ? page?.next : undefined,issues);
      if (mounted.current && active.current && epoch.current === version) setPage({ ...value,items: more && page?.targetId === value.targetId ? [...new Map([...(page?.items ?? []),...value.items].map(i => [i.id,i])).values()] : value.items });
    } catch (cause) { if (mounted.current && epoch.current === version) setError(ftpsErrorCode(cause)); }
    finally { if (epoch.current === version) { busy.current = false; if (mounted.current) setWorking(false); } }
  };
  const act = async (item: FtpsItem) => {
    if (!active.current || busy.current || !page || (issues && item.kind !== 'file')) return;
    const ticket = crypto.randomUUID(), version = ++epoch.current;
    request.current = ticket; choosing.current = !issues && item.kind === 'file'; busy.current = true; setWorking(true); setError(null); setNotice(null);
    try {
      const result = issues ? await ftpsBackups.copy(item.id,ticket) : await ftpsBackups.restore(item,ticket);
      if (mounted.current && active.current && epoch.current === version) setNotice(result);
    } catch (cause) { if (mounted.current && epoch.current === version) setError(ftpsErrorCode(cause)); }
    finally { if (request.current === ticket) { request.current = null; choosing.current = false; busy.current = false; if (mounted.current) { setWorking(false); if (issues && active.current) void load(); } } }
  };
  return { available,page,error,notice,working,load,act,cancel: () => { cancel(); setWorking(false); } };
}
