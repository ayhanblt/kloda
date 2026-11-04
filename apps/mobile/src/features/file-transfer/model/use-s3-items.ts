import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { s3, s3ErrorCode, type S3Provider } from '../../../shared/api/s3';
import { s3Backups, type S3Item } from '../../../shared/api/s3-backups';
import type { FtpsPage } from '../../../shared/api/ftps-backups';

export function useS3Items(provider: S3Provider, issues: boolean) {
  const [page,setPage] = useState<FtpsPage | null>(null), [error,setError] = useState<string | null>(null), [notice,setNotice] = useState<string | null>(null);
  const [working,setWorking] = useState(false), [available,setAvailable] = useState(false);
  const mounted = useRef(false), active = useRef(true), busy = useRef(false), epoch = useRef(0), request = useRef<string | null>(null);
  const choosing = useRef(false);
  const cancel = () => {
    const ticket = request.current; request.current = null; choosing.current = false; busy.current = false; epoch.current++;
    if (ticket) void s3Backups.cancel(ticket,issues).catch(() => undefined);
  };
  useEffect(() => {
    mounted.current = true; active.current = AppState.currentState !== 'background' && AppState.currentState !== 'inactive';
    void s3.status(provider).then(value => { if (mounted.current) setAvailable(value.supported && value.configured); }).catch(() => undefined);
    const listener = AppState.addEventListener('change', state => {
      active.current = state === 'active';
      // Native owns the Files picker handoff and rechecks the captured target after return.
      if (issues || !choosing.current || request.current === null) { cancel(); setWorking(false); }
    });
    return () => { mounted.current = false; active.current = false; cancel(); listener.remove(); };
  },[provider,issues]);
  const load = async (more = false) => {
    if (busy.current || !active.current || (more && !page?.next)) return;
    const version = ++epoch.current; busy.current = true; setWorking(true); setError(null);
    try {
      const value = await s3Backups.list(provider,more ? page?.next : undefined,issues);
      if (mounted.current && active.current && epoch.current === version) setPage({ ...value,items: more && page?.targetId === value.targetId ? [...new Map([...(page?.items ?? []),...value.items].map(i => [i.id,i])).values()] : value.items });
    } catch (cause) { if (mounted.current && epoch.current === version) setError(s3ErrorCode(cause)); }
    finally { if (epoch.current === version) { busy.current = false; if (mounted.current) setWorking(false); } }
  };
  const act = async (item: S3Item) => {
    if (!active.current || busy.current || !page || (issues && (provider !== 'amazon-s3' || item.kind !== 'file'))) return;
    const version = ++epoch.current; let ticket: string;
    try { ticket = s3.newRequest(); } catch (cause) { setError(s3ErrorCode(cause)); return; }
    request.current = ticket; choosing.current = !issues && item.kind === 'file'; busy.current = true; setWorking(true); setError(null); setNotice(null);
    try {
      const result = issues ? await s3Backups.copy(provider,item.id,ticket) : await s3Backups.restore(provider,item,ticket);
      if (mounted.current && active.current && epoch.current === version) setNotice(result);
    } catch (cause) { if (mounted.current && epoch.current === version) setError(s3ErrorCode(cause)); }
    finally { if (request.current === ticket) { request.current = null; choosing.current = false; busy.current = false; if (mounted.current) { setWorking(false); if (issues && active.current) void load(); } } }
  };
  return { available,page,error,notice,working,load,act,cancel: () => { cancel(); setWorking(false); } };
}
