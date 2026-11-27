import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { QrCode } from 'lucide-react';

import type { PairedDevice, PairedDevicesPage } from '../../shared/api/desktop';
import { pairingErrorCode, type PairingErrorCode } from '../../shared/api/pairing';
import { DeviceGlyph, Notice, PageHeader, StatusPill, type StatusTone } from '../../shared/ui/Kit';

export function DeviceManagement({ onPair }: { onPair?: () => void }) {
  const { t, i18n } = useTranslation();
  const language = i18n.resolvedLanguage?.split('-')[0];
  const confirmationLanguage = language === 'tr' || language === 'de' ? language : 'en';
  const [page, setPage] = useState<PairedDevicesPage | null>(null);
  const [cursor, setCursor] = useState<string>();
  const [previous, setPrevious] = useState<(string | undefined)[]>([]);
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
            } else await (action === 'grant' ? bridge.approveBackup(recordId) : bridge.revokeBackup(recordId));
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
  }, [bridge, cursor, confirmationLanguage]);

  const changePage = (after: string | undefined) => {
    setPage(null);
    setError(null);
    setActionError(null);
    setBusy(true);
    setCursor(after);
  };

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
          <p className="text-xs text-tertiary-text">{t('devices.order')}</p>
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
          {!error && page.items.length === 0 && (
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
          <ul aria-label={t('devices.listLabel')} className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {page.items.map((item) => (
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

function DeviceRow({
  item,
  stale,
  disabled,
  canRemove,
  onChange,
}: {
  item: PairedDevice;
  stale: boolean;
  disabled: boolean;
  canRemove: boolean;
  onChange(action: 'grant' | 'revoke' | 'remove'): void;
}) {
  const { t } = useTranslation();
  const scope = item.backupScope;
  const scopeState = stale ? 'unavailable' : (scope?.state ?? 'unavailable');

  const trustTone: StatusTone = stale
    ? 'pending'
    : item.trust === 'complete'
      ? 'synced'
      : item.trust === 'revoked'
        ? 'danger'
        : 'review';

  const permTone: StatusTone =
    scopeState === 'approved' ? 'synced' : scopeState === 'revoked' ? 'danger' : scopeState === 'unavailable' ? 'pending' : 'review';

  return (
    <li className="pairing-card flex flex-col justify-between gap-4">
      <div className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <DeviceGlyph kind="phone" />
            <div className="min-w-0">
              <h2 className="break-all text-sm font-semibold text-primary-text">
                <code dir="ltr">{item.peerFingerprint}</code>
              </h2>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <StatusPill tone={trustTone}>
              {`${t('devices.trustLabel')} ${t(stale ? 'devices.trust.unknown' : `devices.trust.${item.trust}`)}`}
            </StatusPill>
            <StatusPill tone={permTone}>
              {`${t('devices.permissionLabel')} ${t(`devices.permission.${scopeState}`)}`}
            </StatusPill>
          </div>
        </div>

        <p className="break-all rounded-xl bg-surface-2/60 px-3 py-2 text-xs text-secondary-text">
          <span className="font-medium">{t('devices.folderLabel')} </span>
          <bdi className="font-mono text-primary-text">
            {stale ? t('devices.unknownFolder') : (scope?.folder ?? t(scopeState === 'unavailable' ? 'devices.unknownFolder' : 'devices.noFolder'))}
          </bdi>
        </p>

        {!stale && scope?.errorCode && (
          <Notice role="alert" tone="danger">
            {t(`pairing.errors.${scope.errorCode}`)}
          </Notice>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          className={`pairing-button !min-h-9 !px-3 !text-xs ${scopeState !== 'approved' ? 'pairing-button-primary' : ''}`}
          disabled={disabled || item.trust !== 'complete'}
          onClick={() => onChange('grant')}
          type="button"
        >
          {t('devices.grant')}
        </button>
        <button
          className="pairing-button !min-h-9 !px-3 !text-xs"
          disabled={disabled || item.trust !== 'complete' || !(scopeState === 'approved' || (scopeState === 'unavailable' && Boolean(scope?.revision)))}
          onClick={() => onChange('revoke')}
          type="button"
        >
          {t('devices.revoke')}
        </button>
        <button
          className="pairing-button pairing-button-danger !min-h-9 !px-3 !text-xs"
          disabled={disabled || !canRemove || item.trust === 'revoked'}
          onClick={() => onChange('remove')}
          type="button"
        >
          {t('devices.remove')}
        </button>
      </div>
    </li>
  );
}
