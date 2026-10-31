import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { BackupVersion, BackupVersionPage } from '../../shared/api/desktop';

export function BackupVersions({ initialTrash = false, onViewChange }: { initialTrash?: boolean; onViewChange?(trash: boolean): void }) {
  const { t, i18n } = useTranslation();
  const language = i18n.resolvedLanguage?.split('-')[0];
  const confirmationLanguage = language === 'tr' || language === 'de' ? language : 'en';
  const [trash, setTrash] = useState(initialTrash);
  const [cursor, setCursor] = useState<string>();
  const [previous, setPrevious] = useState<(string | undefined)[]>([]);
  const [page, setPage] = useState<BackupVersionPage | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState(false);
  const [selectionError, setSelectionError] = useState(false);
  const [failures, setFailures] = useState<{ id: string; code: string }[]>([]);
  const controls = useRef<{ refresh(): void; selectAll(): void; change(ids: string[]): void } | null>(null);
  const bridge = window.kloda?.backups;
  const suspend = window.kloda?.pairing?.close;
  useEffect(() => () => { void suspend?.().catch(() => undefined); }, [suspend]);

  useEffect(() => {
    let alive = true;
    let pending = false;
    const read = async () => {
      if (!alive || pending) return;
      pending = true; setBusy(true);
      try {
        if (!bridge) throw new Error('native_unsupported');
        const next = await bridge.list(cursor, trash);
        if (alive) {
          setPage(next); setError(false);
        }
      } catch { if (alive) setError(true); }
      finally { pending = false; if (alive) setBusy(false); }
    };
    controls.current = {
      refresh: () => { void read(); },
      selectAll: () => {
        if (!alive || pending || !bridge) return;
        pending = true; setBusy(true); setSelectionError(false);
        void (async () => {
          try {
            const ids = new Set<string>();
            const cursors = new Set<string>();
            let after: string | undefined;
            let count = 0;
            do {
              const next = await bridge.list(after, trash);
              if (!alive) return;
              count += next.items.length;
              if (count > 4096) throw new Error('selection_limit');
              if (next.nextCursor && next.items.length === 0) throw new Error('invalid_page');
              for (const item of next.items) if (item.state === (trash ? 'trash' : 'active')) ids.add(item.id);
              after = next.nextCursor;
              if (after && cursors.has(after)) throw new Error('invalid_cursor');
              if (after) cursors.add(after);
            } while (after);
            if (alive) { setSelected([...ids]); setError(false); }
          } catch { if (alive) setSelectionError(true); }
          finally { pending = false; if (alive) setBusy(false); }
        })();
      },
      change: (ids) => {
        if (!alive || pending || !bridge || ids.length === 0) return;
        pending = true; setBusy(true); setFailures([]);
        void (async () => {
          try {
            const result = await (trash ? bridge.restore(ids, confirmationLanguage) : bridge.trash(ids, confirmationLanguage));
            if (alive) setSelected((current) => current.filter((id) => !result.items.some((item) => item.id === id && item.success)));
            if (alive) setFailures(ids.flatMap((id) => {
              const item = result.items.find((entry) => entry.id === id);
              return item?.success ? [] : [{ id, code: item?.errorCode ?? 'outcome_unknown' }];
            }));
          } catch (reason) {
            const code = reason && typeof reason === 'object' && 'code' in reason && typeof reason.code === 'string' ? reason.code : 'outcome_unknown';
            if (alive) setFailures(ids.map((id) => ({ id, code })));
          } finally { pending = false; if (alive) await read(); }
        })();
      },
    };
    void read();
    const timer = window.setInterval(() => void read(), 1500);
    return () => { alive = false; controls.current = null; window.clearInterval(timer); };
  }, [bridge, cursor, trash, confirmationLanguage]);

  const reset = (after?: string) => { setCursor(after); setPage(null); setError(false); setFailures([]); setSelectionError(false); setBusy(true); };
  const eligible = page?.items.filter((item) => item.state === (trash ? 'trash' : 'active')).map((item) => item.id) ?? [];
  const disabled = busy || error;
  const select = (ids: string[]) => {
    if (ids.length > 4096) { setSelectionError(true); return; }
    setSelected(ids); setSelectionError(false);
  };
  const failureText = (code: string) => t(`backups.errors.${code}`, { defaultValue: t('backups.errors.outcome_unknown') });
  return <main className="min-h-screen bg-background p-6 text-primary-text">
    <h1 className="text-3xl font-bold">{t('backups.title')}</h1>
    <p className="mt-2 text-secondary-text">{t('backups.description')}</p>
    <p className="mt-2 text-sm">{t('backups.retention')}</p>
    <p className="mt-2 text-sm">{t('backups.suppression')}</p>
    <div className="mt-4 flex flex-wrap gap-4" role="group" aria-label={t('backups.view')}>
      {[false, true].map((value) => <button className="pairing-button" key={String(value)} type="button" aria-pressed={trash === value}
        disabled={busy || trash === value} onClick={() => { reset(); setSelected([]); setPrevious([]); setTrash(value); onViewChange?.(value); }}>{t(value ? 'backups.trash' : 'backups.active')}</button>)}
    </div>
    {error && <p className="mt-4 text-danger-text" role="alert">{t('backups.unavailable')}</p>}
    {selectionError && <p className="mt-4 text-danger-text" role="alert">{t('backups.selectionError')}</p>}
    {failures.map(({ id, code }) => <p className="mt-4 break-all text-danger-text" key={id} role="alert"><code>{id}</code>: {failureText(code)}</p>)}
    {busy && !page && <p className="mt-4" role="status">{t('backups.loading')}</p>}
    {page && <>
      {!error && page.items.length === 0 && <p className="mt-4" role="status">{t(trash ? 'backups.emptyTrash' : 'backups.empty')}</p>}
      <div className="mt-4 flex flex-wrap items-center gap-4">
        <label><input checked={eligible.length > 0 && eligible.every((id) => selected.includes(id))} disabled={disabled || eligible.length === 0}
          onChange={(event) => select(event.target.checked ? [...new Set([...selected, ...eligible])] : selected.filter((id) => !eligible.includes(id)))} type="checkbox" /> {t('backups.selectPage')}</label>
        <button className="pairing-button" disabled={disabled} onClick={() => controls.current?.selectAll()} type="button">{t('backups.selectAll')}</button>
        <button className="pairing-button" disabled={disabled || selected.length === 0} onClick={() => setSelected([])} type="button">{t('backups.clearSelection')}</button>
        <button className="pairing-button" disabled={disabled || selected.length === 0} onClick={() => controls.current?.change(selected)} type="button">
          {t(trash ? 'backups.restoreSelected' : 'backups.deleteSelected', { count: selected.length })}</button>
      </div>
      <p className="mt-2 text-sm">{t('backups.selectionScope')}</p>
      <ul aria-label={t('backups.listLabel')} className="mt-4 grid gap-4">
        {page.items.map((item) => <li className="rounded-xl border border-border-subtle bg-surface-1 p-4" key={item.id}>
          <label className="flex items-start gap-3"><input checked={selected.includes(item.id)} disabled={disabled || !eligible.includes(item.id)}
            onChange={(event) => select(event.target.checked ? [...selected, item.id] : selected.filter((id) => id !== item.id))}
            type="checkbox" /><span className="break-all font-semibold"><bdi>{item.name}</bdi></span></label>
          <p className="mt-2 break-all">{t('incoming.device')} <code dir="ltr">{item.deviceFingerprint}</code></p>
          <p className="mt-2">{t(`backups.kinds.${item.kind}`)} · {t(item.kind === 'photos' ? 'backups.manifestBytes' : 'backups.bytes', { bytes: item.size })}</p>
          <p className="mt-2 break-all">{t('backups.version')} <code dir="ltr">{item.sourceRevision}</code></p>
          <p className="mt-2 break-all text-xs text-secondary-text">{t('incoming.operation')} <code dir="ltr">{item.id}</code></p>
          <p className="mt-2">{t(error ? 'backups.stale' : `backups.states.${item.state}`)}</p>
          {item.errorCode && <p className="mt-2 text-danger-text">{failureText(item.errorCode)}</p>}
          {trash && <BackupDeadline item={item} />}
          <button className="pairing-button mt-4" disabled={disabled || !eligible.includes(item.id)}
            onClick={() => controls.current?.change([item.id])} type="button">{t(trash ? 'backups.restoreOne' : 'backups.deleteOne')}</button>
        </li>)}
      </ul>
    </>}
    <div className="mt-4 flex flex-wrap gap-4">
      <button className="underline disabled:opacity-40" disabled={busy || previous.length === 0} onClick={() => {
        reset(previous.at(-1)); setPrevious((pages) => pages.slice(0, -1));
      }} type="button">{t('incoming.previous')}</button>
      <button className="underline disabled:opacity-40" disabled={disabled || !page?.nextCursor} onClick={() => {
        if (!page?.nextCursor) return;
        setPrevious((pages) => [...pages, cursor]); reset(page.nextCursor);
      }} type="button">{t('incoming.next')}</button>
      <button className="underline disabled:opacity-40" disabled={busy} onClick={() => controls.current?.refresh()} type="button">{t('incoming.refresh')}</button>
    </div>
  </main>;
}

function BackupDeadline({ item }: { item: BackupVersion }) {
  const { t, i18n } = useTranslation();
  const date = item.expiresAt ? new Date(Number(item.expiresAt)) : null;
  return <p className="mt-2">{t('backups.deadline')} {date && Number.isFinite(date.getTime())
    ? <time dateTime={date.toISOString()}>{date.toLocaleString(i18n.resolvedLanguage)}</time> : t('backups.unknownDeadline')}</p>;
}
