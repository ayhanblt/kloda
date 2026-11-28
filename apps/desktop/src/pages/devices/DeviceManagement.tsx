import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronUp, QrCode } from 'lucide-react';

import type { PairedDevicesPage } from '../../shared/api/desktop';
import { pairingErrorCode, type PairingErrorCode } from '../../shared/api/pairing';
import { Notice, PageHeader } from '../../shared/ui/Kit';
import { DeviceRow } from './DeviceRow';

export function DeviceManagement({ onPair }: { onPair?: () => void }) {
  const { t, i18n } = useTranslation();
  const language = i18n.resolvedLanguage?.split('-')[0];
  const confirmationLanguage = language === 'tr' || language === 'de' ? language : 'en';
  const confirmationTheme = typeof document !== 'undefined' && document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
  const [page, setPage] = useState<PairedDevicesPage | null>(null);
  const [cursor, setCursor] = useState<string>();
  const [previous, setPrevious] = useState<(string | undefined)[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<PairingErrorCode | null>(null);
  const [actionError, setActionError] = useState<PairingErrorCode | null>(null);
  const controls = useRef<{ refresh(): void; change(recordId: string, action: 'grant' | 'revoke' | 'remove'): void } | null>(null);
  const bridge = window.kloda?.devices;
  const suspend = window.kloda?.pairing?.close;

  useEffect(() => () => { void suspend?.().catch(() => undefined); }, [suspend]);

  useEffect(() => {
    let alive = true;
    let pending = false;
    const read = async () => {
      if (pending || !alive) return;
      pending = true;
      setBusy(true);
      try {
        if (!bridge) throw { code: 'native_unsupported' };
        const next = await bridge.list(cursor);
        if (alive) {
          setPage(next);
          setError(null);
        }
      } catch (reason) {
        if (alive) setError(pairingErrorCode(reason));
      } finally {
        pending = false;
        if (alive) setBusy(false);
      }
    };
    controls.current = {
      refresh: () => { void read(); },
      change: (recordId, action) => {
        if (pending || !bridge || !alive) return;
        pending = true;
        setBusy(true);
        setActionError(null);
        void (async () => {
          try {
            if (action === 'remove') {
              if (!bridge.removeDevice) throw { code: 'native_unsupported' };
              await bridge.removeDevice(recordId, confirmationLanguage);
            } else await (action === 'grant' ? bridge.approveBackup(recordId, confirmationLanguage, confirmationTheme) : bridge.revokeBackup(recordId));
          } catch (reason) {
            if (alive) setActionError(pairingErrorCode(reason));
          } finally {
            pending = false;
            if (alive) await read();
          }
        })();
      },
    };
    void read();
    const timer = window.setInterval(() => void read(), 1500);
    return () => {
      alive = false;
      controls.current = null;
      window.clearInterval(timer);
    };
  }, [bridge, cursor, confirmationLanguage, confirmationTheme]);

  const changePage = (after: string | undefined) => {
    setPage(null);
    setError(null);
    setActionError(null);
    setBusy(true);
    setCursor(after);
  };

  const activeItems = page?.items.filter((item) => item.trust !== 'revoked') ?? [];
  const revokedItems = page?.items.filter((item) => item.trust === 'revoked') ?? [];

  return (
    <main className="space-y-4">
      <PageHeader
        actions={
          onPair && (
            <button className="pairing-button pairing-button-primary !min-h-10 !px-4 !text-sm" onClick={onPair} type="button">
              <QrCode aria-hidden="true" size={16} />
              {t('pairing.pairingNavigation')}
            </button>
          )
        }
        body={t('devices.description')}
        title={t('devices.title')}
      />

      <Notice>
        <div className="space-y-1">
          <p>{t('devices.revokeMeaning')}</p>
          <p>{t('devices.removeMeaning')}</p>
        </div>
      </Notice>

      {error && (
        <div className="space-y-2">
          <Notice role="alert" tone="danger">
            {t(`pairing.errors.${error}`)}
          </Notice>
          <p className="text-sm text-secondary-text" role="status">
            {t('devices.unavailable')}
          </p>
        </div>
      )}
      {actionError && (
        <Notice role="alert" tone="danger">
          {t(`pairing.errors.${actionError}`)}
        </Notice>
      )}
      {busy && !page && (
        <p className="text-sm text-secondary-text" role="status">
          {t('devices.loading')}
        </p>
      )}

      {page && (
        <>
          {!error && activeItems.length === 0 && (
            <div className="pairing-card py-10 text-center" role="status">
              <p className="font-semibold text-primary-text">{t('devices.empty')}</p>
              {onPair && (
                <button className="pairing-button pairing-button-primary mt-4" onClick={onPair} type="button">
                  <QrCode aria-hidden="true" size={16} />
                  {t('pairing.pairingNavigation')}
                </button>
              )}
            </div>
          )}
          {activeItems.length > 0 && (
            <ul aria-label={t('devices.listLabel')} className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {activeItems.map((item) => (
                <DeviceRow
                  canRemove={Boolean(bridge?.removeDevice)}
                  disabled={busy || Boolean(error)}
                  item={item}
                  key={item.recordId}
                  onChange={(action) => controls.current?.change(item.recordId, action)}
                  stale={Boolean(error)}
                />
              ))}
            </ul>
          )}

          {revokedItems.length > 0 && (
            <section className="space-y-3 pt-2">
              <button
                aria-expanded={showHistory}
                className="pairing-button !min-h-10 !px-3.5 !text-sm"
                onClick={() => setShowHistory((prev) => !prev)}
                type="button"
              >
                {showHistory ? <ChevronUp aria-hidden="true" size={16} /> : <ChevronDown aria-hidden="true" size={16} />}
                {t(showHistory ? 'devices.hideHistory' : 'devices.showHistory', { count: revokedItems.length })}
              </button>
              {showHistory && (
                <ul className="grid grid-cols-1 gap-3 opacity-80 lg:grid-cols-2">
                  {revokedItems.map((item) => (
                    <DeviceRow
                      canRemove={false}
                      disabled={busy || Boolean(error)}
                      item={item}
                      key={item.recordId}
                      onChange={() => undefined}
                      stale={Boolean(error)}
                    />
                  ))}
                </ul>
              )}
            </section>
          )}
        </>
      )}

      <div className="flex flex-wrap items-center gap-2 pt-2">
        <button
          className="pairing-button !min-h-10 !px-3.5 !text-sm"
          disabled={busy || previous.length === 0}
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
          disabled={busy || Boolean(error) || !page?.nextCursor}
          onClick={() => {
            if (!page?.nextCursor) return;
            setPrevious((pages) => [...pages, cursor]);
            changePage(page.nextCursor);
          }}
          type="button"
        >
          {t('incoming.next')}
        </button>
        <button className="pairing-button !min-h-10 !px-3.5 !text-sm" disabled={busy} onClick={() => controls.current?.refresh()} type="button">
          {t('incoming.refresh')}
        </button>
      </div>
    </main>
  );
}
