import { useTranslation } from 'react-i18next';

import type { PairedDevice } from '../../shared/api/desktop';
import { formatBackupFolder } from '../../shared/api/pairing';
import { DeviceGlyph, Notice, StatusPill, type StatusTone } from '../../shared/ui/Kit';

export function DeviceRow({
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
  const revoked = item.trust === 'revoked';
  const folderText = stale
    ? t('devices.unknownFolder')
    : (formatBackupFolder(scope?.folder, scope?.peerFolder)
      ?? t(scopeState === 'unavailable' ? 'devices.unknownFolder' : 'devices.noFolder'));

  const trustTone: StatusTone = stale
    ? 'pending'
    : item.trust === 'complete'
      ? 'synced'
      : revoked
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
              {item.peerName ? (
                <h2 className="truncate text-base font-semibold text-primary-text">{item.peerName}</h2>
              ) : (
                <h2 className="break-all text-sm font-semibold text-primary-text">
                  <code dir="ltr">{item.peerFingerprint}</code>
                </h2>
              )}
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
          <bdi className="font-mono text-primary-text">{folderText}</bdi>
        </p>

        {item.peerName && (
          <details className="text-xs text-secondary-text">
            <summary className="cursor-pointer font-medium hover:text-primary-text">{t('devices.securityDetails')}</summary>
            <code className="mt-1 block break-all font-mono text-primary-text" dir="ltr">{item.peerFingerprint}</code>
          </details>
        )}

        {!stale && scope?.errorCode && (
          <Notice role="alert" tone="danger">
            {t(`pairing.errors.${scope.errorCode}`)}
          </Notice>
        )}
      </div>

      {revoked ? (
        <p className="text-xs text-secondary-text">{t('devices.revokedNote')}</p>
      ) : (
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
            disabled={disabled || !canRemove}
            onClick={() => onChange('remove')}
            type="button"
          >
            {t('devices.remove')}
          </button>
        </div>
      )}
    </li>
  );
}
