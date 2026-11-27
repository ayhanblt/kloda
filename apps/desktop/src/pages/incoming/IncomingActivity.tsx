import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FileDown } from 'lucide-react';

import type { IncomingActivityPage, IncomingTransfer } from '../../shared/api/desktop';
import { pairingErrorCode, type PairingErrorCode } from '../../shared/api/pairing';
import { Notice, PageHeader, StatusPill, type StatusTone } from '../../shared/ui/Kit';

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
        if (alive) {
          setPage(next);
          setError(null);
        }
      } catch (reason) {
        if (alive) setError(pairingErrorCode(reason));
      } finally {
        pending = false;
        if (alive) setLoading(false);
      }
    };
    void read();
    const timer = window.setInterval(() => void read(), 1500);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [readPage, cursor, refresh]);

  const changePage = (next: string | undefined) => {
    setPage(null);
    setError(null);
    setCursor(next);
  };

  const items = page?.items ?? [];
  const completedCount = items.filter((item) => item.state === 'completed').length;
  const activeCount = items.length - completedCount;

  return (
    <main className="space-y-4">
      <PageHeader body={t('incoming.description')} title={t('incoming.title')} />

      {page && items.length > 0 && (
        <div className="grid grid-cols-3 gap-2 border-b border-border-subtle pb-4">
          <div className="px-3 py-1">
            <p className="text-xl font-semibold tabular-nums text-primary-text">{items.length}</p>
            <p className="text-xs text-secondary-text">{t('ui.statsTotal')}</p>
          </div>
          <div className="border-l border-border-subtle px-3 py-1">
            <p className="text-xl font-semibold tabular-nums text-primary-text">{activeCount}</p>
            <p className="text-xs text-secondary-text">{t('ui.filterActive')}</p>
          </div>
          <div className="border-l border-border-subtle px-3 py-1">
            <p className="text-xl font-semibold tabular-nums text-primary-text">{completedCount}</p>
            <p className="text-xs text-secondary-text">{t('ui.filterCompleted')}</p>
          </div>
        </div>
      )}

      <Notice>
        <div className="space-y-1">
          <p>{t('incoming.noAuthority')}</p>
          <p>{t('incoming.missingMetadata')}</p>
          <p>{t('incoming.byteMeaning')}</p>
          <p className="text-xs text-tertiary-text">{t('incoming.order')}</p>
        </div>
      </Notice>

      {error && (
        <Notice role="alert" tone="danger">
          {t(`pairing.errors.${error}`)}
        </Notice>
      )}
      {(error || (page && !page.receiverAvailable)) && (
        <Notice role="status" tone="warn">
          {t('incoming.unavailable')}
        </Notice>
      )}
      {!error && page?.errorCode && (
        <Notice role="alert" tone="danger">
          {t('incoming.receiverError')} {t(`pairing.errors.${page.errorCode}`)}
        </Notice>
      )}
      {loading && !page && (
        <p className="text-sm text-secondary-text" role="status">
          {t('incoming.loading')}
        </p>
      )}

      {page && (
        <>
          {!error && page.items.length === 0 && (
            <div className="pairing-card py-10 text-center text-secondary-text" role="status">
              <FileDown aria-hidden="true" className="mx-auto mb-3 opacity-60" size={32} />
              <p className="text-sm font-medium text-primary-text">{t('incoming.empty')}</p>
            </div>
          )}
          <ul aria-label={t('incoming.listLabel')} className="grid gap-3">
            {page.items.map((item) => (
              <IncomingRow item={item} key={item.id} stale={Boolean(error) || !page.receiverAvailable} />
            ))}
          </ul>
        </>
      )}

      <div className="flex flex-wrap gap-2 pt-2">
        <button
          className="pairing-button !min-h-10 !px-3.5 !text-sm"
          disabled={loading || previous.length === 0}
          onClick={() => {
            changePage(previous.at(-1));
            setPrevious((pages) => pages.slice(0, -1));
          }}
          type="button"
        >
          {t('incoming.previous')}
        </button>
        <button
          className="pairing-button !min-h-10 !px-3.5 !text-sm"
          disabled={loading || Boolean(error) || !page?.nextCursor}
          onClick={() => {
            if (!page?.nextCursor) return;
            setPrevious((pages) => [...pages, cursor]);
            changePage(page.nextCursor);
          }}
          type="button"
        >
          {t('incoming.next')}
        </button>
        <button className="pairing-button !min-h-10 !px-3.5 !text-sm" disabled={loading} onClick={() => setRefresh((value) => value + 1)} type="button">
          {t('incoming.refresh')}
        </button>
      </div>
    </main>
  );
}

function IncomingRow({ item, stale }: { item: IncomingTransfer; stale: boolean }) {
  const { t } = useTranslation();
  const received = BigInt(item.receivedBytes);
  const total = BigInt(item.totalBytes);
  const percentage = total === 0n ? (item.state === 'completed' ? 100 : 0) : Number((received * 10000n) / total) / 100;
  const byteLabel = t('incoming.bytes', { received: item.receivedBytes, total: item.totalBytes });
  const tone: StatusTone = item.state === 'completed' ? 'synced' : stale ? 'pending' : 'syncing';

  return (
    <li className="pairing-card space-y-2.5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h2 className="break-all text-sm font-semibold text-primary-text">
            <bdi>{item.name}</bdi>
          </h2>
          <p className="mt-0.5 break-all text-xs text-secondary-text">
            {t('incoming.device')} <code dir="ltr">{item.deviceFingerprint}</code>
          </p>
        </div>
        <StatusPill tone={tone}>{t(`incoming.states.${item.state}`)}</StatusPill>
      </div>

      {item.state !== 'completed' && (
        <p className="text-xs text-secondary-text">{t(stale ? 'incoming.stalePending' : 'incoming.pending')}</p>
      )}

      <progress
        aria-label={t('incoming.progressLabel', { name: item.name })}
        aria-valuetext={byteLabel}
        className="kloda-progress"
        max={100}
        value={percentage}
      />

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-secondary-text">
        <span className="tabular-nums">{byteLabel}</span>
        <span className="break-all text-tertiary-text">
          {t('incoming.operation')} <code dir="ltr">{item.id}</code>
        </span>
      </div>
    </li>
  );
}
