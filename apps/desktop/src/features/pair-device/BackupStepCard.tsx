import { FolderCheck, FolderOpen } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { formatBackupFolder, type PairingStatus } from '../../shared/api/pairing';
import { Notice, StatusPill, type StatusTone } from '../../shared/ui/Kit';
import type { DesktopPairingController } from './useDesktopPairing';

interface Props {
  status: PairingStatus;
  busy: boolean;
  uncertain: boolean;
  available: boolean;
  consentLanguage: 'tr' | 'en' | 'de';
  consentTheme: 'dark' | 'light';
  controller: DesktopPairingController;
}

export function BackupStepCard({ status, busy, uncertain, available, consentLanguage, consentTheme, controller }: Props) {
  const { t } = useTranslation();
  const backupScope = status.backupScope;
  const blocked = busy || uncertain || !available || !status.recordId;
  const approved = backupScope?.state === 'approved';
  const stateKey = uncertain ? 'unknown' : (backupScope?.state ?? 'not_approved');
  const pillTone: StatusTone = uncertain ? 'review' : approved ? 'synced' : backupScope?.state === 'revoked' ? 'danger' : 'review';
  const displayFolder = formatBackupFolder(backupScope?.folder, backupScope?.peerFolder);

  return (
    <section
      aria-labelledby="pairing-step2-title"
      className={`pairing-card space-y-3 ${approved ? '' : 'border-brand-base/60'}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="pairing-section-heading !mb-0">
          {approved ? <FolderCheck aria-hidden="true" size={20} /> : <FolderOpen aria-hidden="true" size={20} />}
          <h2 id="pairing-step2-title">{t('pairing.step2Title')}</h2>
        </div>
        <StatusPill tone={pillTone}>{t(`devices.permission.${uncertain ? 'unavailable' : (backupScope?.state ?? 'not_approved')}`)}</StatusPill>
      </div>

      <p className="pairing-caption">{t('pairing.backupDescription')}</p>
      <Notice>{t('pairing.noFileGrant')}</Notice>

      <p className="text-sm font-medium text-primary-text" role="status">
        {t(`pairing.backupStates.${stateKey}`)}
      </p>

      {displayFolder && (
        <p className="pairing-caption">
          {t('pairing.backupFolder')} <code dir="ltr">{displayFolder}</code>
        </p>
      )}

      {backupScope?.errorCode && (
        <Notice role="alert" tone="danger">
          {t(`pairing.errors.${backupScope.errorCode}`)}
        </Notice>
      )}

      <div className="pairing-card-actions !mb-2">
        <button
          className="pairing-button pairing-button-primary"
          disabled={blocked}
          onClick={() => {
            if (status.recordId) void controller.approveBackup(status.recordId, consentLanguage, consentTheme);
          }}
          type="button"
        >
          {t(backupScope?.state === 'approved' || backupScope?.state === 'unavailable' ? 'pairing.reselectBackup' : 'pairing.approveBackup')}
        </button>
        {(backupScope?.state === 'approved' || backupScope?.state === 'unavailable') && (
          <button
            className="pairing-button pairing-button-danger"
            disabled={blocked}
            onClick={() => {
              if (status.recordId) void controller.revokeBackup(status.recordId);
            }}
            type="button"
          >
            {t('pairing.revokeBackup')}
          </button>
        )}
      </div>
      <p className="pairing-caption">{t('pairing.backupRevocationDescription')}</p>
    </section>
  );
}
