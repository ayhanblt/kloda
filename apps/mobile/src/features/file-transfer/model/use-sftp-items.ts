import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { sftp, sftpErrorCode } from '../../../shared/api/sftp';
import { sftpBackups, type SftpItem, type SftpPage } from '../../../shared/api/sftp-backups';

export function useSftpItems(issues: boolean) {
  const [page,setPage] = useState<SftpPage | null>(null), [error,setError] = useState<string | null>(null), [notice,setNotice] = useState<string | null>(null);
  const [working,setWorking] = useState(false), [available,setAvailable] = useState(false);
  const mounted = useRef(false), active = useRef(true), busy = useRef(false), epoch = useRef(0), request = useRef<string | null>(null);
  const choosing = useRef(false);
  const cancel = () => {
    const ticket = request.current; request.current = null; choosing.current = false; busy.current = false; epoch.current++;
    if (ticket) void sftpBackups.cancel(ticket,issues).catch(() => undefined);
  };
  useEffect(() => {
    mounted.current = true; active.current = AppState.currentState !== 'background' && AppState.currentState !== 'inactive';
    void sftp.status().then(value => { if (mounted.current) setAvailable(value.supported && value.configured); }).catch(() => undefined);
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
      const value = await sftpBackups.list(more ? page?.next : undefined,issues);
      if (mounted.current && active.current && epoch.current === version) setPage({ ...value,items: more && page?.targetId === value.targetId ? [...new Map([...(page?.items ?? []),...value.items].map(i => [i.id,i])).values()] : value.items });
    } catch (cause) { if (mounted.current && epoch.current === version) setError(sftpErrorCode(cause)); }
    finally { if (epoch.current === version) { busy.current = false; if (mounted.current) setWorking(false); } }
  };
  const act = async (item: SftpItem) => {
    if (!active.current || busy.current || !page || (issues && item.kind !== 'file')) return;
    const ticket = crypto.randomUUID(), version = ++epoch.current;
    request.current = ticket; choosing.current = !issues && item.kind === 'file'; busy.current = true; setWorking(true); setError(null); setNotice(null);
    try {
      const result = issues ? await sftpBackups.copy(item.id,ticket) : await sftpBackups.restore(item,ticket);
      if (mounted.current && active.current && epoch.current === version) setNotice(result);
    } catch (cause) { if (mounted.current && epoch.current === version) setError(sftpErrorCode(cause)); }
    finally { if (request.current === ticket) { request.current = null; choosing.current = false; busy.current = false; if (mounted.current) { setWorking(false); if (issues && active.current) void load(); } } }
  };
  return { available,page,error,notice,working,load,act,cancel: () => { cancel(); setWorking(false); } };
}
