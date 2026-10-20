import { useLayoutEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Ban, Clock, QrCode, ShieldCheck, Smartphone, Wifi, X } from 'lucide-react';

import { CandidateApproval } from '../../features/pair-device/CandidateApproval';
import { InvitationQr } from '../../features/pair-device/InvitationQr';
import { PairingQuickpanel } from '../../features/pair-device/PairingQuickpanel';
import { useDesktopPairing } from '../../features/pair-device/useDesktopPairing';
import './pairing.css';

export function PairingPage({ onProtectedDecisionChange }: { onProtectedDecisionChange?: (protectedDecision: boolean) => void }) {
  const { t } = useTranslation();
  const controller = useDesktopPairing();
  const { status, busy, uncertain, error, available } = controller;
  const phase = status?.phase;
  const canCreate = phase === 'idle' || phase === 'invalid' || phase === 'revoked' || phase === 'complete';
  const preconsume = phase === 'open' || phase === 'reserved' || phase === 'connecting';
  const committed = phase === 'consumed_pending_ack' || phase === 'complete';
  const backupScope = status?.backupScope;
  const backupBlocked = Boolean(busy) || uncertain || !available || !status?.recordId;
  const visibleQr = phase === 'open' && !uncertain && !busy && status?.qr &&
    status.remainingMs !== undefined && status.remainingMs > 0 ? status.qr : null;
  const candidate = phase === 'reserved' && status?.operationId && status.candidateGeneration
    ? { ...status, operationId: status.operationId, candidateGeneration: status.candidateGeneration } : null;

  useLayoutEffect(() => {
    // Retain the fence on uncertain reserved snapshots and while their decision is in flight.
    onProtectedDecisionChange?.(phase === 'reserved');
  }, [phase, onProtectedDecisionChange]);

  return <main className="pairing-page">
    <header className="pairing-page-header">
      <p className="pairing-eyebrow"><Wifi aria-hidden="true" size={16} />{t('pairing.lanOnly')}</p>
      <h1>{t('pairing.title')}</h1>
      <p>{t('pairing.description')}</p>
    </header>
    <div className="pairing-layout">
      <section aria-labelledby="pairing-invitation-title" className="pairing-card">
        <div className="pairing-section-heading"><Smartphone aria-hidden="true" size={22} />
          <h2 id="pairing-invitation-title">{t('pairing.invitationTitle')}</h2>
        </div>
        <p className="pairing-caption">{t('pairing.invitationDescription')}</p>
        {visibleQr ? <InvitationQr key={status?.operationId} payload={visibleQr} remainingMs={status?.remainingMs ?? 0} />
          : <div className="pairing-qr-stage pairing-state-stage">
            {committed ? <ShieldCheck aria-hidden="true" size={44} />
              : phase === 'revoked' ? <Ban aria-hidden="true" size={44} />
                : preconsume ? <Clock aria-hidden="true" size={44} /> : <QrCode aria-hidden="true" size={44} />}
            <h3>{status ? t(`pairing.phases.${status.phase}`) : t(error ? 'pairing.unavailable' : 'pairing.loading')}</h3>
            <p>{status ? t(`pairing.phaseDescriptions.${status.phase}`) : t(error ? 'pairing.unavailableDescription' : 'pairing.loadingDescription')}</p>
          </div>}
        {phase === 'open' && <div className="pairing-scan-instructions">
          <p>{t('pairing.scanInstruction')}</p>
          <p className="pairing-caption">{t('pairing.secretWarning')}</p>
          {!visibleQr && !busy && !uncertain && <p className="pairing-attention" role="status">{t('pairing.qrUnavailable')}</p>}
        </div>}
        {busy && <p className="pairing-caption" role="status">{t('pairing.working')}</p>}
        {error && <p className="pairing-error" role="alert">{t(`pairing.errors.${error}`)}</p>}
        <div className="pairing-card-actions">
          {canCreate && <button className="pairing-button pairing-button-primary"
            disabled={Boolean(busy) || !available || uncertain} onClick={() => void controller.create()} type="button">
            <QrCode aria-hidden="true" size={18} />{t('pairing.createInvitation')}
          </button>}
          {(preconsume || phase === 'pending') && status?.operationId && <button className="pairing-button"
            disabled={Boolean(busy)} onClick={() => void controller.cancel(status.operationId!)} type="button">
            <X aria-hidden="true" size={18} />{t('pairing.cancelInvitation')}
          </button>}
          {committed && status?.operationId && <button className="pairing-button pairing-button-danger"
            disabled={Boolean(busy)} onClick={() => void controller.cancel(status.operationId!)} type="button">
            <Ban aria-hidden="true" size={18} />{t('pairing.revokeLocalTrust')}
          </button>}
        </div>
        {committed && <p className="pairing-caption">{t('pairing.revocationDescription')}</p>}
        {phase === 'complete' && <div className="pairing-recovery">
          <h3>{t('pairing.backupTitle')}</h3>
          <p className="pairing-caption">{t('pairing.noFileGrant')}</p>
          <p className="pairing-caption">{t('pairing.backupDescription')}</p>
          <p role="status">{t(`pairing.backupStates.${uncertain ? 'unknown' : backupScope?.state ?? 'not_approved'}`)}</p>
          {backupScope?.folder && <p className="pairing-caption">{t('pairing.backupFolder')} <code>{backupScope.folder}</code></p>}
          {backupScope?.errorCode && <p className="pairing-error" role="alert">{t(`pairing.errors.${backupScope.errorCode}`)}</p>}
          <div className="pairing-card-actions">
            <button className="pairing-button pairing-button-primary" disabled={backupBlocked}
              onClick={() => { if (status?.recordId) void controller.approveBackup(status.recordId); }} type="button">
              {t(backupScope?.state === 'approved' || backupScope?.state === 'unavailable'
                ? 'pairing.reselectBackup' : 'pairing.approveBackup')}
            </button>
            {(backupScope?.state === 'approved' || backupScope?.state === 'unavailable') && <button className="pairing-button pairing-button-danger" disabled={backupBlocked}
              onClick={() => { if (status?.recordId) void controller.revokeBackup(status.recordId); }} type="button">
              {t('pairing.revokeBackup')}
            </button>}
          </div>
          <p className="pairing-caption">{t('pairing.backupRevocationDescription')}</p>
        </div>}
        {phase === 'reserved' && !candidate && <p className="pairing-error" role="alert">{t('pairing.candidateUnavailable')}</p>}
      </section>
      <PairingQuickpanel controller={controller} />
    </div>
    {candidate && <CandidateApproval candidate={candidate} controller={controller}
      key={`${candidate.operationId}:${candidate.candidateGeneration}:${candidate.repairRequired === true}`} />}
  </main>;
}
