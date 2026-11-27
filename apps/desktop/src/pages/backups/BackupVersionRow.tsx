import { RotateCcw, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import type { BackupVersion } from '../../shared/api/desktop';
import { Notice, StatusPill, type StatusTone } from '../../shared/ui/Kit';

export function BackupVersionRow({
  item,
  trash,
  selected,
  disabled,
  eligible,
  error,
  failureText,
  onToggleSelect,
  onAction,
}: {
  item: BackupVersion;
  trash: boolean;
  selected: boolean;
  disabled: boolean;
  eligible: boolean;
  error: boolean;
  failureText: (code: string) => string;
  onToggleSelect: (checked: boolean) => void;
  onAction: () => void;
}) {
  const { t } = useTranslation();
  const stateTone: StatusTone = error ? 'pending' : item.state === 'active' ? 'synced' : item.state === 'trash' ? 'review' : 'danger';

  return (
    <li className="pairing-card space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-3">
          <input
            checked={selected}
            className="mt-1"
            disabled={disabled || !eligible}
            onChange={(event) => onToggleSelect(event.target.checked)}
            type="checkbox"
          />
          <span className="min-w-0">
            <span className="block break-all text-sm font-semibold text-primary-text">
              <bdi>{item.name}</bdi>
            </span>
            <span className="mt-0.5 block text-xs text-secondary-text">
              {t(`backups.kinds.${item.kind}`)} · {t(item.kind === 'photos' ? 'backups.manifestBytes' : 'backups.bytes', { bytes: item.size })}
            </span>
          </span>
        </label>
        <StatusPill tone={stateTone}>{t(error ? 'backups.stale' : `backups.states.${item.state}`)}</StatusPill>
      </div>

      <div className="grid gap-1 rounded-xl bg-surface-2/50 px-3 py-2 text-xs text-secondary-text">
        <p className="break-all">
          {t('incoming.device')} <code dir="ltr">{item.deviceFingerprint}</code>
        </p>
        <p className="break-all">
          {t('backups.version')} <code dir="ltr">{item.sourceRevision}</code>
        </p>
        <p className="break-all text-tertiary-text">
          {t('incoming.operation')} <code dir="ltr">{item.id}</code>
        </p>
      </div>

      {item.errorCode && (
        <Notice role="alert" tone="danger">
          {failureText(item.errorCode)}
        </Notice>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        {trash ? <BackupDeadline item={item} /> : <span />}
        <button
          className={`pairing-button !min-h-9 !px-3 !text-xs ${trash ? '' : 'pairing-button-danger'}`}
          disabled={disabled || !eligible}
          onClick={onAction}
          type="button"
        >
          {trash ? <RotateCcw aria-hidden="true" size={14} /> : <Trash2 aria-hidden="true" size={14} />}
          {t(trash ? 'backups.restoreOne' : 'backups.deleteOne')}
        </button>
      </div>
    </li>
  );
}

function BackupDeadline({ item }: { item: BackupVersion }) {
  const { t, i18n } = useTranslation();
  const date = item.expiresAt ? new Date(Number(item.expiresAt)) : null;
  return (
    <p className="text-xs text-secondary-text">
      {t('backups.deadline')}{' '}
      {date && Number.isFinite(date.getTime()) ? (
        <time dateTime={date.toISOString()}>{date.toLocaleString(i18n.resolvedLanguage)}</time>
      ) : (
        t('backups.unknownDeadline')
      )}
    </p>
  );
}
