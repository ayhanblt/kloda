import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Ban, Fingerprint, RefreshCw, ShieldCheck, X } from 'lucide-react';

import type { PairingStatus } from '../../shared/api/pairing';
import type { DesktopPairingController } from './useDesktopPairing';

interface Props {
  candidate: PairingStatus & { operationId: string; candidateGeneration: string };
  controller: DesktopPairingController;
}

export function CandidateApproval({ candidate, controller }: Props) {
  const { t } = useTranslation();
  const titleId = useId();
  const descriptionId = useId();
  const overlay = useRef<HTMLDivElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const [elapsed, setElapsed] = useState(false);
  const expired = elapsed || candidate.remainingMs === undefined || candidate.remainingMs <= 0;
  const blocked = Boolean(controller.busy);

  useEffect(() => {
    // A display fence never authorizes native commit or extends the native invitation lifetime.
    const timer = window.setTimeout(() => setElapsed(true), Math.max(0, candidate.remainingMs ?? 0));
    return () => window.clearTimeout(timer);
  }, [candidate.remainingMs]);

  useEffect(() => {
    const container = dialog.current;
    const backdrop = overlay.current;
    if (!container || !backdrop) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const siblings = Array.from(document.body.children)
      .filter((element): element is HTMLElement => element instanceof HTMLElement && element !== backdrop)
      .map((element) => ({ element, inert: element.inert }));
    siblings.forEach(({ element }) => { element.inert = true; });
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    heading.current?.focus();

    const trapFocus = (event: FocusEvent) => {
      if (event.target instanceof Node && !container.contains(event.target)) heading.current?.focus();
    };
    const trapKeys = (event: KeyboardEvent) => {
      if (event.key === 'Escape' || event.key === 'Enter') {
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }
      if (event.key !== 'Tab') return;
      const targets = Array.from(container.querySelectorAll<HTMLElement>('button:not(:disabled), [tabindex="0"]'));
      const index = targets.indexOf(document.activeElement as HTMLElement);
      if (targets.length === 0) {
        event.preventDefault();
        container.focus();
      } else if (event.shiftKey && index <= 0) {
        event.preventDefault();
        targets[targets.length - 1].focus();
      } else if (!event.shiftKey && (index < 0 || index === targets.length - 1)) {
        event.preventDefault();
        targets[0].focus();
      }
    };
    document.addEventListener('focusin', trapFocus);
    document.addEventListener('keydown', trapKeys, true);
    return () => {
      document.removeEventListener('focusin', trapFocus);
      document.removeEventListener('keydown', trapKeys, true);
      siblings.forEach(({ element, inert }) => { element.inert = inert; });
      document.body.style.overflow = overflow;
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, []);

  return createPortal(<div className="pairing-modal-backdrop" ref={overlay}>
    <div aria-describedby={descriptionId} aria-labelledby={titleId} aria-modal="true"
      className="pairing-modal" ref={dialog} role="dialog" tabIndex={-1}>
      <div className="pairing-icon-tile"><ShieldCheck aria-hidden="true" size={28} /></div>
      <h2 id={titleId} ref={heading} tabIndex={-1}>{t(candidate.repairRequired ? 'pairing.repairTitle' : 'pairing.approvalTitle')}</h2>
      <p id={descriptionId}>{t(candidate.repairRequired ? 'pairing.repairDescription' : 'pairing.approvalDescription')}</p>
      <div className="pairing-fingerprint">
        <span><Fingerprint aria-hidden="true" size={18} />{t('pairing.phoneFingerprint')}</span>
        <code>{candidate.peerFingerprint ?? t('pairing.fingerprintUnavailable')}</code>
      </div>
      <p className="pairing-permission-note">{t('pairing.noFileGrant')}</p>
      <p className="pairing-caption">{t('pairing.explicitDecision')}</p>
      {expired && <p className="pairing-error" role="alert">{t('pairing.errors.invitation_expired')}</p>}
      {controller.error && <p className="pairing-error" role="alert">{t(`pairing.errors.${controller.error}`)}</p>}
      {controller.uncertain && <p role="status">{t('pairing.statusUncertain')}</p>}
      {blocked && <p role="status">{t('pairing.working')}</p>}
      <div className="pairing-modal-actions">
        <button className="pairing-button pairing-button-primary" disabled={blocked || expired || controller.uncertain || !candidate.peerFingerprint}
          onClick={() => void controller.approve(candidate.operationId, candidate.candidateGeneration)} type="button">
          <ShieldCheck aria-hidden="true" size={18} />{t(candidate.repairRequired ? 'pairing.pairAgain' : 'pairing.approve')}
        </button>
        <button className="pairing-button pairing-button-danger" disabled={blocked}
          onClick={() => void controller.deny(candidate.operationId, candidate.candidateGeneration)} type="button">
          <Ban aria-hidden="true" size={18} />{t('pairing.deny')}
        </button>
        <button className="pairing-button" disabled={blocked}
          onClick={() => void controller.cancel(candidate.operationId)} type="button">
          <X aria-hidden="true" size={18} />{t('pairing.cancelInvitation')}
        </button>
        <button className="pairing-button" disabled={blocked || !controller.available}
          onClick={() => void controller.refresh()} type="button">
          <RefreshCw aria-hidden="true" size={18} />{t('pairing.refreshStatus')}
        </button>
      </div>
    </div>
  </div>, document.body);
}
