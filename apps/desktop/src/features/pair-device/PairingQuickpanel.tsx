import { useTranslation } from 'react-i18next';
import { Clock, Fingerprint, RefreshCw, ShieldCheck, Wifi } from 'lucide-react';

import { Notice, StatusPill, type StatusTone } from '../../shared/ui/Kit';
import type { DesktopPairingController } from './useDesktopPairing';

export function PairingQuickpanel({ controller }: { controller: DesktopPairingController }) {
  const { t } = useTranslation();
  const { status, busy, uncertain, available } = controller;
  const resumable = status?.phase === 'pending' || status?.phase === 'consumed_pending_ack';

  const phase = status?.phase;
  const tone: StatusTone =
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
    <aside aria-labelledby="pairing-status-title" className="space-y-3">
      <Notice>{t('pairing.lanOnly')}</Notice>
      <Notice tone="warn">{t('pairing.noFileGrant')}</Notice>

      <div className="pairing-quickpanel space-y-4">
        <div className="pairing-section-heading !mb-0">
          <ShieldCheck aria-hidden="true" size={18} />
          <h2 id="pairing-status-title">{t('pairing.statusTitle')}</h2>
        </div>
        <p className="pairing-caption">{t('pairing.readOnlyStatus')}</p>

        <dl className="pairing-details !my-2">
          <div>
            <dt>{t('pairing.stateLabel')}</dt>
            <dd>
              <StatusPill aria-live="polite" role="status" tone={tone}>
                {status ? t(`pairing.phases.${status.phase}`) : t('pairing.notObserved')}
              </StatusPill>
            </dd>
          </div>
          <div>
            <dt>
              <Wifi aria-hidden="true" size={14} />
              {t('pairing.transportLabel')}
            </dt>
            <dd className="text-primary-text">{t('pairing.lanOnly')}</dd>
          </div>
          {status?.remainingMs !== undefined && (status.phase === 'open' || status.phase === 'reserved') && (
            <div>
              <dt>
                <Clock aria-hidden="true" size={14} />
                {t('pairing.expiresLabel')}
              </dt>
              <dd className="tabular-nums text-primary-text">
                {t('pairing.remaining', { seconds: Math.max(0, Math.ceil(status.remainingMs / 1000)) })}
              </dd>
            </div>
          )}
          {status?.peerFingerprint && (
            <div>
              <dt>
                <Fingerprint aria-hidden="true" size={14} />
                {t('pairing.phoneFingerprint')}
              </dt>
              <dd>
                <code className="block rounded-lg bg-surface-2 px-2 py-1 text-xs">{status.peerFingerprint}</code>
              </dd>
            </div>
          )}
        </dl>

        {uncertain && (
          <Notice role="status" tone="warn">
            {t('pairing.statusUncertain')}
          </Notice>
        )}

        {resumable && (
          <div className="pairing-recovery border-t border-border-subtle pt-3">
            <p className="text-sm text-secondary-text">{t('pairing.resumeDescription')}</p>
            <button
              className="pairing-button pairing-button-primary w-full"
              disabled={Boolean(busy) || !status?.recordId || uncertain}
              onClick={() => {
                if (status?.recordId) void controller.resume(status.recordId);
              }}
              type="button"
            >
              <RefreshCw aria-hidden="true" size={16} />
              {t('pairing.resume')}
            </button>
            {!status?.recordId && <p className="pairing-caption">{t('pairing.recoveryUnavailable')}</p>}
          </div>
        )}

        <button className="pairing-button w-full" disabled={Boolean(busy) || !available} onClick={() => void controller.refresh()} type="button">
          <RefreshCw aria-hidden="true" size={16} />
          {t('pairing.refreshStatus')}
        </button>
      </div>
    </aside>
  );
}
