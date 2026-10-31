import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { PairedDevice, PairedDevicesPage } from '../../shared/api/desktop';
import { pairingErrorCode, type PairingErrorCode } from '../../shared/api/pairing';

export function DeviceManagement() {
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
      pending = true; setBusy(true);
      try {
        if (!bridge) throw { code: 'native_unsupported' };
        const next = await bridge.list(cursor);
        if (alive) { setPage(next); setError(null); }
      } catch (reason) { if (alive) setError(pairingErrorCode(reason)); }
      finally { pending = false; if (alive) setBusy(false); }
    };
    controls.current = {
      refresh: () => { void read(); },
      change: (recordId, action) => {
        if (pending || !bridge || !alive) return;
        pending = true; setBusy(true); setActionError(null);
        void (async () => {
          try {
            if (action === 'remove') {
              if (!bridge.removeDevice) throw { code: 'native_unsupported' };
              await bridge.removeDevice(recordId, confirmationLanguage);
            } else await (action === 'grant' ? bridge.approveBackup(recordId) : bridge.revokeBackup(recordId));
          }
          catch (reason) { if (alive) setActionError(pairingErrorCode(reason)); }
          finally { pending = false; if (alive) await read(); }
        })();
      },
    };
    void read();
    const timer = window.setInterval(() => void read(), 1500);
    return () => { alive = false; controls.current = null; window.clearInterval(timer); };
  }, [bridge, cursor, confirmationLanguage]);

  const changePage = (after: string | undefined) => { setPage(null); setError(null); setActionError(null); setBusy(true); setCursor(after); };
  return <main className="min-h-screen bg-background p-6 text-primary-text">
    <h1 className="text-3xl font-bold">{t('devices.title')}</h1>
    <p className="mt-2 text-secondary-text">{t('devices.description')}</p>
    <p className="mt-2 text-sm">{t('devices.revokeMeaning')}</p>
    <p className="mt-2 text-sm">{t('devices.removeMeaning')}</p>
    <p className="mt-2 text-sm">{t('devices.order')}</p>
    {error && <><p className="mt-4 text-danger-text" role="alert">{t(`pairing.errors.${error}`)}</p>
      <p className="mt-2" role="status">{t('devices.unavailable')}</p></>}
    {actionError && <p className="mt-4 text-danger-text" role="alert">{t(`pairing.errors.${actionError}`)}</p>}
    {busy && !page && <p className="mt-4" role="status">{t('devices.loading')}</p>}
    {page && <>
      {!error && page.items.length === 0 && <p className="mt-4" role="status">{t('devices.empty')}</p>}
      <ul aria-label={t('devices.listLabel')} className="mt-4 grid gap-4">
        {page.items.map((item) => <DeviceRow item={item} key={item.recordId} stale={Boolean(error)} disabled={busy || Boolean(error)}
          canRemove={Boolean(bridge?.removeDevice)} onChange={(action) => controls.current?.change(item.recordId, action)} />)}
      </ul>
    </>}
    <div className="mt-4 flex gap-4">
      <button className="underline disabled:opacity-40" disabled={busy || previous.length === 0} type="button" onClick={() => {
        changePage(previous.at(-1)); setPrevious((pages) => pages.slice(0, -1));
      }}>{t('incoming.previous')}</button>
      <button className="underline disabled:opacity-40" disabled={busy || Boolean(error) || !page?.nextCursor} type="button" onClick={() => {
        if (!page?.nextCursor) return;
        setPrevious((pages) => [...pages, cursor]); changePage(page.nextCursor);
      }}>{t('incoming.next')}</button>
      <button className="underline disabled:opacity-40" disabled={busy} onClick={() => controls.current?.refresh()} type="button">{t('incoming.refresh')}</button>
    </div>
  </main>;
}

function DeviceRow({ item, stale, disabled, canRemove, onChange }: {
  item: PairedDevice; stale: boolean; disabled: boolean; canRemove: boolean; onChange(action: 'grant' | 'revoke' | 'remove'): void;
}) {
  const { t } = useTranslation();
  const scope = item.backupScope;
  const scopeState = stale ? 'unavailable' : scope?.state ?? 'unavailable';
  return <li className="rounded-xl border border-border-subtle bg-surface-1 p-4">
    <h2 className="break-all font-semibold"><code dir="ltr">{item.peerFingerprint}</code></h2>
    <p className="mt-2">{t('devices.trustLabel')} {t(stale ? 'devices.trust.unknown' : `devices.trust.${item.trust}`)}</p>
    <p className="mt-2">{t('devices.permissionLabel')} {t(`devices.permission.${scopeState}`)}</p>
    <p className="mt-2 break-all">{t('devices.folderLabel')} <bdi>{stale ? t('devices.unknownFolder') : scope?.folder ?? t(scopeState === 'unavailable' ? 'devices.unknownFolder' : 'devices.noFolder')}</bdi></p>
    {!stale && scope?.errorCode && <p className="mt-2 text-danger-text" role="alert">{t(`pairing.errors.${scope.errorCode}`)}</p>}
    <div className="mt-4 flex flex-wrap gap-4">
      <button className="underline disabled:opacity-40" disabled={disabled || item.trust !== 'complete'}
        onClick={() => onChange('grant')} type="button">{t('devices.grant')}</button>
      <button className="underline disabled:opacity-40" disabled={disabled || item.trust !== 'complete' || !(scopeState === 'approved' || (scopeState === 'unavailable' && Boolean(scope?.revision)))}
        onClick={() => onChange('revoke')} type="button">{t('devices.revoke')}</button>
      <button className="text-danger-text underline disabled:opacity-40" disabled={disabled || !canRemove || item.trust === 'revoked'}
        onClick={() => onChange('remove')} type="button">{t('devices.remove')}</button>
    </div>
  </li>;
}
