import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { IncomingActivityPage, IncomingTransfer } from '../../shared/api/desktop';
import { pairingErrorCode, type PairingErrorCode } from '../../shared/api/pairing';

export function IncomingActivity() {
  const { t } = useTranslation();
  const [page, setPage] = useState<IncomingActivityPage | null>(null);
  const [cursor, setCursor] = useState<string>();
  const [previous, setPrevious] = useState<(string | undefined)[]>([]);
  const [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<PairingErrorCode | null>(null);
  const readPage = window.kloda?.background?.activity;

  useEffect(() => {
    let alive = true;
    let pending = false;
    const read = async () => {
      if (pending) return;
      pending = true;
      setLoading(true);
      try {
        if (!readPage) throw { code: 'native_unsupported' };
        const next = await readPage(cursor);
        if (alive) { setPage(next); setError(null); }
      } catch (reason) { if (alive) setError(pairingErrorCode(reason)); }
      finally { pending = false; if (alive) setLoading(false); }
    };
    void read();
    const timer = window.setInterval(() => void read(), 1500);
    return () => { alive = false; window.clearInterval(timer); };
  }, [readPage, cursor, refresh]);

  const changePage = (next: string | undefined) => { setPage(null); setError(null); setCursor(next); };
  return <main className="min-h-screen bg-surface p-6 text-ink">
    <h1 className="text-3xl font-bold">{t('incoming.title')}</h1>
    <p className="mt-2 text-muted">{t('incoming.description')}</p>
    <p className="mt-2 text-sm">{t('incoming.noAuthority')}</p>
    <p className="mt-2 text-sm">{t('incoming.missingMetadata')}</p>
    <p className="mt-2 text-sm">{t('incoming.byteMeaning')}</p>
    <p className="mt-2 text-sm">{t('incoming.order')}</p>
    {error && <p className="mt-4 text-red-600" role="alert">{t(`pairing.errors.${error}`)}</p>}
    {(error || (page && !page.receiverAvailable)) && <p className="mt-2" role="status">{t('incoming.unavailable')}</p>}
    {!error && page?.errorCode && <p className="mt-2 text-red-600" role="alert">{t('incoming.receiverError')} {t(`pairing.errors.${page.errorCode}`)}</p>}
    {loading && !page && <p className="mt-4" role="status">{t('incoming.loading')}</p>}
    {page && <>
      {!error && page.items.length === 0 && <p className="mt-4" role="status">{t('incoming.empty')}</p>}
      <ul aria-label={t('incoming.listLabel')} className="mt-4 grid gap-4">
        {page.items.map((item) => <IncomingRow item={item} key={item.id} stale={Boolean(error) || !page.receiverAvailable} />)}
      </ul>
    </>}
    <div className="mt-4 flex gap-4">
      <button className="underline disabled:opacity-40" disabled={loading || previous.length === 0} onClick={() => {
        changePage(previous.at(-1)); setPrevious((pages) => pages.slice(0, -1));
      }} type="button">{t('incoming.previous')}</button>
      <button className="underline disabled:opacity-40" disabled={loading || Boolean(error) || !page?.nextCursor} onClick={() => {
        if (!page?.nextCursor) return;
        setPrevious((pages) => [...pages, cursor]); changePage(page.nextCursor);
      }} type="button">{t('incoming.next')}</button>
      <button className="underline disabled:opacity-40" disabled={loading} onClick={() => setRefresh((value) => value + 1)}
        type="button">{t('incoming.refresh')}</button>
    </div>
  </main>;
}

function IncomingRow({ item, stale }: { item: IncomingTransfer; stale: boolean }) {
  const { t } = useTranslation();
  const received = BigInt(item.receivedBytes);
  const total = BigInt(item.totalBytes);
  const percentage = total === 0n ? (item.state === 'completed' ? 100 : 0) : Number(received * 10000n / total) / 100;
  const byteLabel = t('incoming.bytes', { received: item.receivedBytes, total: item.totalBytes });
  return <li className="rounded-xl border border-border bg-white p-4">
    <h2 className="break-all font-semibold"><bdi>{item.name}</bdi></h2>
    <p className="mt-2 break-all">{t('incoming.device')} <code dir="ltr">{item.deviceFingerprint}</code></p>
    <p className="mt-2">{t(`incoming.states.${item.state}`)}</p>
    {item.state !== 'completed' && <p className="mt-2 text-sm">{t(stale ? 'incoming.stalePending' : 'incoming.pending')}</p>}
    <progress aria-label={t('incoming.progressLabel', { name: item.name })} aria-valuetext={byteLabel}
      className="mt-2 w-full" max={100} value={percentage} />
    <p className="mt-2 text-sm">{byteLabel}</p>
    <p className="mt-2 break-all text-xs text-muted">{t('incoming.operation')} <code dir="ltr">{item.id}</code></p>
  </li>;
}
