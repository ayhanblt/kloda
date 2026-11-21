import { LogOut } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { getDesktopBridge, type BackgroundStatus } from '../../shared/api/desktop';
import { DesktopTray } from './DesktopTray';

interface DesktopBackgroundProps {
  settings?: boolean;
  /** D13 presentation of the same observed status; the native tray stays authoritative. */
  tray?: boolean;
  onOpen?(): void;
  /** Settings-only slot rendered between the background panel and the version/quit footer. */
  general?: ReactNode;
}

export function DesktopBackground({ settings = true, tray = false, onOpen, general }: DesktopBackgroundProps) {
  const { t } = useTranslation();
  const [status, setStatus] = useState<BackgroundStatus | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const settingsVersion = useRef(0);
  const settingPending = useRef(false);
  const bridge = window.kloda?.background;

  useEffect(() => {
    if (!bridge) return;
    let alive = true;
    let pending = false;
    const refresh = async () => {
      if (pending || settingPending.current) return;
      pending = true;
      const version = settingsVersion.current;
      try {
        const next = await bridge.status();
        if (alive && version === settingsVersion.current) { setStatus(next); setFailed(false); }
      } catch { if (alive && version === settingsVersion.current) setFailed(true); }
      finally { pending = false; }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 1500);
    return () => { alive = false; window.clearInterval(timer); };
  }, [bridge]);

  const changeAutostart = async (enabled: boolean) => {
    if (settingPending.current || !bridge) return;
    settingPending.current = true;
    settingsVersion.current += 1;
    setBusy(true);
    try { setStatus(await bridge.setAutostart(enabled)); setFailed(false); }
    catch { setFailed(true); }
    finally { settingPending.current = false; setBusy(false); }
  };
  const quit = async () => {
    try { await getDesktopBridge().background?.quit(); }
    catch { setFailed(true); }
  };
  const unknown = failed || !bridge;
  if (tray) {
    return <DesktopTray onOpen={() => onOpen?.()} onQuit={() => void quit()} quitDisabled={!bridge} status={status} unknown={unknown} />;
  }
  const quitButton = (className: string) => <button className={className} disabled={!bridge} onClick={() => void quit()} type="button">
    {settings && <LogOut aria-hidden="true" size={16} />}{t('background.quit')}</button>;
  return <>
  <section aria-label={t('background.title')} className="desktop-background pairing-card">
    <div className="receiver-status-heading">
      <h2 className="font-semibold">{t(settings ? 'background.title' : 'receiver.statusTitle')}</h2>
      {!settings && quitButton('pairing-button')}
    </div>
    {failed || !bridge ? <p role="alert">{t('background.unknown')}</p> : status && <>
      <p className={`pairing-state ${status.receiver.available && !status.receiver.errorCode ? 'pairing-state-complete' : ''}`} role="status">{t(status.receiver.available ? 'background.listening' : 'background.unavailable')}</p>
      {status.receiver.errorCode && <p role="alert">{t(`pairing.errors.${status.receiver.errorCode}`)}</p>}
      <p>{t(status.backup.active || status.receiver.activeTransfers > 0 ? 'background.active' : 'background.idle')}</p>
      {status.backup.failed && <p role="alert">{t('background.backupFailed')}</p>}
      {status.shutdownError && <p role="alert">{t('background.shutdownFailed')}</p>}
      <p className="text-sm text-secondary-text">{t('background.sleepHint')}</p>
      {status.environmentLimited && <p role="status">{t('background.environmentLimited')}</p>}
      {(settings || status.autostartChoice === null) && <>
        {status.autostartChoice === null && <p className="mt-2 font-semibold">{t('background.loginQuestion')}</p>}
        <label className="mt-2 flex gap-2">
          <input checked={status.autostart.enabled} disabled={busy || !status.autostart.supported}
            onChange={(event) => void changeAutostart(event.target.checked)} type="checkbox" />
          {t('background.loginLabel')}
        </label>
        <p role="status">{t(status.autostart.enabled ? 'background.loginEnabled' : 'background.loginDisabled')}</p>
        {status.autostartChoice === true && !status.autostart.enabled && <p>{t('background.loginNotApplied')}</p>}
        {status.autostart.reason && <p>{t(`background.loginReasons.${status.autostart.reason}`)}</p>}
        {status.autostartChoice === null && <button className="mt-2 underline" disabled={busy}
          onClick={() => void changeAutostart(false)} type="button">{t('background.notNow')}</button>}
      </>}
    </>}
    {!failed && bridge && !status && <p role="status">{t('receiver.checking')}</p>}
    {settings && !unknown && status && <dl className="mt-2 grid gap-3 border-t border-border-subtle pt-3 text-sm">
      <div>
        <dt className="font-semibold">{t('background.closeBehavior')}</dt>
        <dd>{t(status.canHide ? 'background.closeHides' : 'background.closeStaysVisible')}</dd>
        <dd className="text-secondary-text">{t('background.closeAutomatic')}</dd>
      </div>
    </dl>}
    {!settings && <p className="pairing-caption">{t('receiver.listenerBoundary')}</p>}
  </section>
  {settings && <>
    {general}
    <section aria-label={t('background.version')} className="settings-version pairing-card">
      <dl className="flex flex-wrap justify-between gap-2 text-sm">
        <dt className="font-semibold">{t('background.version')}</dt>
        <dd className="text-secondary-text">{!unknown && status?.appVersion ? status.appVersion : t('background.versionUnknown')}</dd>
      </dl>
    </section>
    <div className="settings-quit">{quitButton('pairing-button')}</div>
  </>}
  </>;
}
