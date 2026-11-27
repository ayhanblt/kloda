import { useLayoutEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Ban, Clock, QrCode, ShieldCheck, Smartphone, Wifi, X } from 'lucide-react';

import { CandidateApproval } from '../../features/pair-device/CandidateApproval';
import { InvitationQr } from '../../features/pair-device/InvitationQr';
import { PairingQuickpanel } from '../../features/pair-device/PairingQuickpanel';
import { useDesktopPairing } from '../../features/pair-device/useDesktopPairing';
import { Notice, PageHeader, StatusPill, type StatusTone } from '../../shared/ui/Kit';
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
  const visibleQr = phase === 'open' && !uncertain && !busy && status?.qr && status.remainingMs !== undefined && status.remainingMs > 0 ? status.qr : null;
  const candidate =
    phase === 'reserved' && status?.operationId && status.candidateGeneration
      ? { ...status, operationId: status.operationId, candidateGeneration: status.candidateGeneration }
      : null;

  useLayoutEffect(() => {
    // Retain the fence on uncertain reserved snapshots and while their decision is in flight.
    onProtectedDecisionChange?.(phase === 'reserved');
  }, [phase, onProtectedDecisionChange]);

  const phaseTone: StatusTone =
    phase === 'complete'
      ? 'synced'
      : phase === 'open' || phase === 'reserved' || phase === 'connecting'
        ? 'syncing'
        : phase === 'consumed_pending_ack' || phase === 'pending'
          ? 'review'
          : phase === 'invalid' || phase === 'revoked'
            ? 'danger'
            : 'pending';

  return (
    <main className="pairing-page">
      <PageHeader
        body={t('pairing.description')}
        eyebrow={
          <StatusPill tone="synced">
            <Wifi aria-hidden="true" className="mr-1 inline size-3.5" />
            {t('pairing.lanOnly')}
          </StatusPill>
        }
        title={t('pairing.title')}
      />
      <div className="pairing-layout">
        <section aria-labelledby="pairing-invitation-title" className="pairing-card">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="pairing-section-heading !mb-0">
              <Smartphone aria-hidden="true" size={20} />
              <h2 id="pairing-invitation-title">{t('pairing.invitationTitle')}</h2>
            </div>
            {visibleQr && status && <StatusPill tone={phaseTone}>{t(`pairing.phases.${status.phase}`)}</StatusPill>}
          </div>
          <p className="pairing-caption mt-1">{t('pairing.invitationDescription')}</p>

          {visibleQr ? (
            <InvitationQr key={status?.operationId} payload={visibleQr} remainingMs={status?.remainingMs ?? 0} />
          ) : (
            <div className="pairing-qr-stage pairing-state-stage">
              {committed ? (
                <ShieldCheck aria-hidden="true" size={40} />
              ) : phase === 'revoked' ? (
                <Ban aria-hidden="true" size={40} />
              ) : preconsume ? (
                <Clock aria-hidden="true" size={40} />
              ) : (
                <QrCode aria-hidden="true" size={40} />
              )}
              <h3>{status ? t(`pairing.phases.${status.phase}`) : t(error ? 'pairing.unavailable' : 'pairing.loading')}</h3>
              <p>{status ? t(`pairing.phaseDescriptions.${status.phase}`) : t(error ? 'pairing.unavailableDescription' : 'pairing.loadingDescription')}</p>
            </div>
          )}

          {phase === 'open' && (
            <div className="pairing-scan-instructions">
              <p className="text-sm text-primary-text">{t('pairing.scanInstruction')}</p>
              <Notice tone="warn">{t('pairing.secretWarning')}</Notice>
              {!visibleQr && !busy && !uncertain && (
                <Notice role="status" tone="warn">
                  {t('pairing.qrUnavailable')}
                </Notice>
              )}
            </div>
          )}

          {busy && (
            <p className="pairing-caption" role="status">
              {t('pairing.working')}
            </p>
          )}
          {error && (
            <Notice className="my-3" role="alert" tone="danger">
              {t(`pairing.errors.${error}`)}
            </Notice>
          )}

          <div className="pairing-card-actions">
            {canCreate && (
              <button
                className="pairing-button pairing-button-primary"
                disabled={Boolean(busy) || !available || uncertain}
                onClick={() => void controller.create()}
                type="button"
              >
                <QrCode aria-hidden="true" size={18} />
                {t('pairing.createInvitation')}
              </button>
            )}
            {(preconsume || phase === 'pending') && status?.operationId && (
              <button className="pairing-button" disabled={Boolean(busy)} onClick={() => void controller.cancel(status.operationId!)} type="button">
                <X aria-hidden="true" size={18} />
                {t('pairing.cancelInvitation')}
              </button>
            )}
            {committed && status?.operationId && (
              <button
                className="pairing-button pairing-button-danger"
                disabled={Boolean(busy)}
                onClick={() => void controller.cancel(status.operationId!)}
                type="button"
              >
                <Ban aria-hidden="true" size={18} />
                {t('pairing.revokeLocalTrust')}
              </button>
            )}
          </div>

          {committed && <p className="pairing-caption">{t('pairing.revocationDescription')}</p>}

          {phase === 'complete' && (
            <div className="pairing-recovery mt-4 border-t border-border-subtle pt-4">
              <h3 className="text-base font-semibold text-primary-text">{t('pairing.backupTitle')}</h3>
              <Notice>{t('pairing.noFileGrant')}</Notice>
              <p className="pairing-caption">{t('pairing.backupDescription')}</p>
              <p className="text-sm text-primary-text" role="status">
                {t(`pairing.backupStates.${uncertain ? 'unknown' : (backupScope?.state ?? 'not_approved')}`)}
              </p>
              {backupScope?.folder && (
                <p className="pairing-caption">
                  {t('pairing.backupFolder')} <code>{backupScope.folder}</code>
                </p>
              )}
              {backupScope?.errorCode && (
                <Notice role="alert" tone="danger">
                  {t(`pairing.errors.${backupScope.errorCode}`)}
                </Notice>
              )}
              <div className="pairing-card-actions">
                <button
                  className="pairing-button pairing-button-primary"
                  disabled={backupBlocked}
                  onClick={() => {
                    if (status?.recordId) void controller.approveBackup(status.recordId);
                  }}
                  type="button"
                >
                  {t(backupScope?.state === 'approved' || backupScope?.state === 'unavailable' ? 'pairing.reselectBackup' : 'pairing.approveBackup')}
                </button>
                {(backupScope?.state === 'approved' || backupScope?.state === 'unavailable') && (
                  <button
                    className="pairing-button pairing-button-danger"
                    disabled={backupBlocked}
                    onClick={() => {
                      if (status?.recordId) void controller.revokeBackup(status.recordId);
                    }}
                    type="button"
                  >
                    {t('pairing.revokeBackup')}
                  </button>
                )}
              </div>
              <p className="pairing-caption">{t('pairing.backupRevocationDescription')}</p>
            </div>
          )}

          {phase === 'reserved' && !candidate && (
            <Notice role="alert" tone="danger">
              {t('pairing.candidateUnavailable')}
            </Notice>
          )}
        </section>

        <PairingQuickpanel controller={controller} />
      </div>
      {candidate && (
        <CandidateApproval
          candidate={candidate}
          controller={controller}
          key={`${candidate.operationId}:${candidate.candidateGeneration}:${candidate.repairRequired === true}`}
        />
      )}
    </main>
  );
}
