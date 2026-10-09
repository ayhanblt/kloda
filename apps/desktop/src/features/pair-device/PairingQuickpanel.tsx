import { useTranslation } from 'react-i18next';
import { Clock, Fingerprint, RefreshCw, ShieldCheck, Wifi } from 'lucide-react';

import type { DesktopPairingController } from './useDesktopPairing';

export function PairingQuickpanel({ controller }: { controller: DesktopPairingController }) {
  const { t } = useTranslation();
  const { status, busy, uncertain, available } = controller;
  const resumable = status?.phase === 'pending' || status?.phase === 'consumed_pending_ack';

  return <aside aria-labelledby="pairing-status-title" className="pairing-quickpanel">
    <div className="pairing-section-heading">
      <ShieldCheck aria-hidden="true" size={20} />
      <h2 id="pairing-status-title">{t('pairing.statusTitle')}</h2>
    </div>
    <p className="pairing-caption">{t('pairing.readOnlyStatus')}</p>
    <dl className="pairing-details">
      <div><dt>{t('pairing.stateLabel')}</dt><dd aria-live="polite" className={`pairing-state pairing-state-${status?.phase ?? 'unknown'}`} role="status">
        {status ? t(`pairing.phases.${status.phase}`) : t('pairing.notObserved')}
      </dd></div>
      <div><dt><Wifi aria-hidden="true" size={16} />{t('pairing.transportLabel')}</dt><dd>{t('pairing.lanOnly')}</dd></div>
      {status?.remainingMs !== undefined && (status.phase === 'open' || status.phase === 'reserved') &&
        <div><dt><Clock aria-hidden="true" size={16} />{t('pairing.expiresLabel')}</dt>
          <dd>{t('pairing.remaining', { seconds: Math.max(0, Math.ceil(status.remainingMs / 1000)) })}</dd></div>}
      {status?.peerFingerprint && <div><dt><Fingerprint aria-hidden="true" size={16} />{t('pairing.phoneFingerprint')}</dt>
        <dd><code>{status.peerFingerprint}</code></dd></div>}
    </dl>
    {uncertain && <p className="pairing-attention" role="status">{t('pairing.statusUncertain')}</p>}
    {resumable && <div className="pairing-recovery">
      <p>{t('pairing.resumeDescription')}</p>
      <button className="pairing-button pairing-button-primary" disabled={Boolean(busy) || !status?.recordId || uncertain}
        onClick={() => { if (status?.recordId) void controller.resume(status.recordId); }} type="button">
        <RefreshCw aria-hidden="true" size={18} />{t('pairing.resume')}
      </button>
      {!status?.recordId && <p className="pairing-caption">{t('pairing.recoveryUnavailable')}</p>}
    </div>}
    <button className="pairing-button" disabled={Boolean(busy) || !available} onClick={() => void controller.refresh()} type="button">
      <RefreshCw aria-hidden="true" size={18} />{t('pairing.refreshStatus')}
    </button>
    <p className="pairing-permission-note">{t('pairing.noFileGrant')}</p>
  </aside>;
}
