import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { BackupVersionPage } from '../../shared/api/desktop';
import { Notice, PageHeader } from '../../shared/ui/Kit';
import { BackupVersionRow } from './BackupVersionRow';

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
      pending = true;
      setBusy(true);
      try {
        if (!bridge) throw new Error('native_unsupported');
        const next = await bridge.list(cursor, trash);
        if (alive) {
          setPage(next);
          setError(false);
        }
      } catch {
        if (alive) setError(true);
      } finally {
        pending = false;
        if (alive) setBusy(false);
      }
    };
    controls.current = {
      refresh: () => { void read(); },
      selectAll: () => {
        if (!alive || pending || !bridge) return;
        pending = true;
        setBusy(true);
        setSelectionError(false);
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
            if (alive) {
              setSelected([...ids]);
              setError(false);
            }
          } catch {
            if (alive) setSelectionError(true);
          } finally {
            pending = false;
            if (alive) setBusy(false);
          }
        })();
      },
      change: (ids) => {
        if (!alive || pending || !bridge || ids.length === 0) return;
        pending = true;
        setBusy(true);
        setFailures([]);
        void (async () => {
          try {
            const result = await (trash ? bridge.restore(ids, confirmationLanguage) : bridge.trash(ids, confirmationLanguage));
            if (alive) setSelected((current) => current.filter((id) => !result.items.some((item) => item.id === id && item.success)));
            if (alive) {
              setFailures(
                ids.flatMap((id) => {
                  const item = result.items.find((entry) => entry.id === id);
                  return item?.success ? [] : [{ id, code: item?.errorCode ?? 'outcome_unknown' }];
                }),
              );
            }
          } catch (reason) {
            const code = reason && typeof reason === 'object' && 'code' in reason && typeof reason.code === 'string' ? reason.code : 'outcome_unknown';
            if (alive) setFailures(ids.map((id) => ({ id, code })));
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
  }, [bridge, cursor, trash, confirmationLanguage]);

  const reset = (after?: string) => {
    setCursor(after);
    setPage(null);
    setError(false);
    setFailures([]);
    setSelectionError(false);
    setBusy(true);
  };
  const eligible = page?.items.filter((item) => item.state === (trash ? 'trash' : 'active')).map((item) => item.id) ?? [];
  const disabled = busy || error;
  const select = (ids: string[]) => {
    if (ids.length > 4096) {
      setSelectionError(true);
      return;
    }
    setSelected(ids);
    setSelectionError(false);
  };
  const failureText = (code: string) => t(`backups.errors.${code}`, { defaultValue: t('backups.errors.outcome_unknown') });

  return (
    <main className="space-y-4">
      <PageHeader
        actions={
          <div aria-label={t('backups.view')} className="inline-flex gap-1.5 rounded-full border border-border-subtle bg-surface-2 p-1" role="group">
            {[false, true].map((value) => (
              <button
                aria-pressed={trash === value}
                className={`min-h-9 rounded-full px-3.5 text-sm font-semibold transition-colors ${
                  trash === value ? 'bg-surface-1 text-brand-text shadow-sm' : 'text-secondary-text hover:text-primary-text'
                }`}
                disabled={busy || trash === value}
                key={String(value)}
                onClick={() => {
                  reset();
                  setSelected([]);
                  setPrevious([]);
                  setTrash(value);
                  onViewChange?.(value);
                }}
                type="button"
              >
                {t(value ? 'backups.trash' : 'backups.active')}
              </button>
            ))}
          </div>
        }
        body={t('backups.description')}
        title={t('backups.title')}
      />

      <Notice>
        <div className="space-y-1">
          <p>{t('backups.retention')}</p>
          <p>{t('backups.suppression')}</p>
        </div>
      </Notice>

      {error && (
        <Notice role="alert" tone="danger">
          {t('backups.unavailable')}
        </Notice>
      )}
      {selectionError && (
        <Notice role="alert" tone="danger">
          {t('backups.selectionError')}
        </Notice>
      )}
      {failures.map(({ id, code }) => (
        <Notice key={id} role="alert" tone="danger">
          <code>{id}</code>: {failureText(code)}
        </Notice>
      ))}
      {busy && !page && (
        <p className="text-sm text-secondary-text" role="status">
          {t('backups.loading')}
        </p>
      )}

      {page && (
        <>
          {!error && page.items.length === 0 && (
            <div className="pairing-card py-10 text-center text-secondary-text" role="status">
              <p className="text-sm font-medium text-primary-text">{t(trash ? 'backups.emptyTrash' : 'backups.empty')}</p>
            </div>
          )}

          <div className="pairing-card space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-primary-text">
                <input
                  checked={eligible.length > 0 && eligible.every((id) => selected.includes(id))}
                  disabled={disabled || eligible.length === 0}
                  onChange={(event) =>
                    select(event.target.checked ? [...new Set([...selected, ...eligible])] : selected.filter((id) => !eligible.includes(id)))
                  }
                  type="checkbox"
                />
                {t('backups.selectPage')}
              </label>
              <button className="pairing-button !min-h-9 !px-3 !text-xs" disabled={disabled} onClick={() => controls.current?.selectAll()} type="button">
                {t('backups.selectAll')}
              </button>
              <button
                className="pairing-button !min-h-9 !px-3 !text-xs"
                disabled={disabled || selected.length === 0}
                onClick={() => setSelected([])}
                type="button"
              >
                {t('backups.clearSelection')}
              </button>
              <button
                className={`pairing-button !min-h-9 !px-3 !text-xs ${trash ? 'pairing-button-primary' : 'pairing-button-danger'}`}
                disabled={disabled || selected.length === 0}
                onClick={() => controls.current?.change(selected)}
                type="button"
              >
                {t(trash ? 'backups.restoreSelected' : 'backups.deleteSelected', { count: selected.length })}
              </button>
            </div>
            <p className="text-xs text-secondary-text">{t('backups.selectionScope')}</p>
          </div>

          <ul aria-label={t('backups.listLabel')} className="grid gap-3">
            {page.items.map((item) => (
              <BackupVersionRow
                disabled={disabled}
                eligible={eligible.includes(item.id)}
                error={error}
                failureText={failureText}
                item={item}
                key={item.id}
                onAction={() => controls.current?.change([item.id])}
                onToggleSelect={(checked) => select(checked ? [...selected, item.id] : selected.filter((id) => id !== item.id))}
                selected={selected.includes(item.id)}
                trash={trash}
              />
            ))}
          </ul>
        </>
      )}

      <div className="flex flex-wrap gap-2 pt-2">
        <button
          className="pairing-button !min-h-10 !px-3.5 !text-sm"
          disabled={busy || previous.length === 0}
          onClick={() => {
            reset(previous.at(-1));
            setPrevious((pages) => pages.slice(0, -1));
          }}
          type="button"
        >
          {t('incoming.previous')}
        </button>
        <button
          className="pairing-button !min-h-10 !px-3.5 !text-sm"
          disabled={disabled || !page?.nextCursor}
          onClick={() => {
            if (!page?.nextCursor) return;
            setPrevious((pages) => [...pages, cursor]);
            reset(page.nextCursor);
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
