import { ChevronRight } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { getDesktopBridge, type BackgroundStatus } from '../../shared/api/desktop';
import { Notice, StatusPill } from '../../shared/ui/Kit';
import { DesktopReceiverSummary, DesktopTraySection, SettingsQuitButton } from './DesktopBackgroundViews';

export interface ReceiverSummary {
  devicesTotal: number | null;
  devicesGranted: number;
  incomingCount: number | null;
  onNavigate(route: 'pairing' | 'devices' | 'incoming' | 'settings' | 'backups'): void;
}

interface DesktopBackgroundProps {
  settings?: boolean;
  /** D13 presentation of the same observed status; the native tray stays authoritative. */
  tray?: boolean;
  /** Route-specific presentation sharing the single background poller (`App.tsx`). */
  mode?: 'settings' | 'tray' | 'receiver' | 'silent';
  onOpen?(): void;
  onStatusChange?: (status: BackgroundStatus | null, failed: boolean) => void;
  onRestartSetup?: () => void;
  receiverSummary?: ReceiverSummary;
  /** Settings-only slot rendered between the background panel and the version/quit footer. */
  general?: ReactNode;
}

export function DesktopBackground({
  settings = true,
  tray = false,
  mode,
  onOpen,
  onStatusChange,
  onRestartSetup,
  receiverSummary,
  general,
}: DesktopBackgroundProps) {
  const { t } = useTranslation();
  const [status, setStatus] = useState<BackgroundStatus | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const settingsVersion = useRef(0);
  const settingPending = useRef(false);
  const bridge = window.kloda?.background;

  const activeMode = mode ?? (tray ? 'tray' : settings ? 'settings' : 'receiver');

  useEffect(() => {
    onStatusChange?.(status, failed);
  }, [status, failed, onStatusChange]);

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
        if (alive && version === settingsVersion.current) {
          setStatus(next);
          setFailed(false);
        }
      } catch {
        if (alive && version === settingsVersion.current) setFailed(true);
      } finally {
        pending = false;
      }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 1500);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [bridge]);

  const changeAutostart = async (enabled: boolean) => {
    if (settingPending.current || !bridge) return;
    settingPending.current = true;
    settingsVersion.current += 1;
    setBusy(true);
    try {
      setStatus(await bridge.setAutostart(enabled));
      setFailed(false);
    } catch {
      setFailed(true);
    } finally {
      settingPending.current = false;
      setBusy(false);
    }
  };

  const quit = async () => {
    try {
      await getDesktopBridge().background?.quit();
    } catch {
      setFailed(true);
    }
  };

  const unknown = failed || !bridge;

  if (activeMode === 'silent') return null;

  if (activeMode === 'tray') {
    return (
      <DesktopTraySection
        onOpen={() => onOpen?.()}
        onQuit={() => void quit()}
        quitDisabled={!bridge}
        status={status}
        unknown={unknown}
      />
    );
  }

  const receiverActive = Boolean(status && (status.backup.active || status.receiver.activeTransfers > 0));
  const receiverError = Boolean(status && (status.receiver.errorCode || status.backup.failed || status.shutdownError));
  const receiverTone = unknown || receiverError ? 'danger' : !status ? 'pending' : status.receiver.available ? (receiverActive ? 'syncing' : 'synced') : 'review';

  if (activeMode === 'receiver') {
    return (
      <DesktopReceiverSummary
        onQuit={() => void quit()}
        quitDisabled={!bridge}
        receiverActive={receiverActive}
        receiverSummary={receiverSummary}
        receiverTone={receiverTone}
        status={status}
        unknown={unknown}
      />
    );
  }

  return (
    <>
      <h2 className="settings-section-title">{t('background.title')}</h2>
      <section aria-label={t('background.title')} className="desktop-background pairing-card space-y-4">
        {unknown ? (
          <Notice role="alert" tone="danger">
            {t('background.unknown')}
          </Notice>
        ) : status ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border-subtle bg-surface-2/50 p-3">
              <StatusPill role="status" tone={receiverTone}>
                {t(status.receiver.available ? 'background.listening' : 'background.unavailable')}
              </StatusPill>
              <StatusPill tone={receiverActive ? 'syncing' : 'neutral'}>{t(receiverActive ? 'background.active' : 'background.idle')}</StatusPill>
            </div>

            {status.receiver.errorCode && (
              <Notice role="alert" tone="danger">
                {t(`pairing.errors.${status.receiver.errorCode}`)}
              </Notice>
            )}
            {status.backup.failed && (
              <Notice role="alert" tone="danger">
                {t('background.backupFailed')}
              </Notice>
            )}
            {status.shutdownError && (
              <Notice role="alert" tone="danger">
                {t('background.shutdownFailed')}
              </Notice>
            )}

            <dl className="grid gap-1.5 rounded-xl border border-border-subtle bg-surface-2/40 p-3.5 text-sm">
              <dt className="font-semibold text-primary-text">{t('background.closeBehavior')}</dt>
              <dd className="text-primary-text">{t(status.canHide ? 'background.closeHides' : 'background.closeStaysVisible')}</dd>
              <dd className="text-xs text-secondary-text">{t('background.closeAutomatic')}</dd>
            </dl>

            <div className="space-y-3 border-t border-border-subtle pt-4">
              {status.autostartChoice === null && <p className="text-sm font-semibold text-primary-text">{t('background.loginQuestion')}</p>}
              <label className="relative flex min-h-12 cursor-pointer items-center justify-between gap-4 rounded-xl border border-border-subtle bg-surface-2/30 px-3.5 py-2.5">
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-primary-text">{t('background.loginLabel')}</span>
                  <span className="mt-0.5 block text-xs text-secondary-text" role="status">
                    {t(status.autostart.enabled ? 'background.loginEnabled' : 'background.loginDisabled')}
                  </span>
                </span>
                <span className="relative inline-flex shrink-0 items-center">
                  <input
                    aria-label={t('background.loginLabel')}
                    checked={status.autostart.enabled}
                    className="kloda-switch-input"
                    disabled={busy || !status.autostart.supported}
                    onChange={(event) => void changeAutostart(event.target.checked)}
                    type="checkbox"
                  />
                  <span aria-hidden="true" className="kloda-switch-track">
                    <span className="kloda-switch-thumb" />
                  </span>
                </span>
              </label>

              {status.autostartChoice === null && (
                <div>
                  <button className="pairing-button !min-h-9 !px-3 !py-1.5 !text-xs" disabled={busy} onClick={() => void changeAutostart(false)} type="button">
                    {t('background.notNow')}
                  </button>
                </div>
              )}
              {status.autostartChoice === true && !status.autostart.enabled && <Notice tone="warn">{t('background.loginNotApplied')}</Notice>}
              {status.autostart.reason && <Notice tone="warn">{t(`background.loginReasons.${status.autostart.reason}`)}</Notice>}
            </div>

            {status.environmentLimited && <Notice tone="warn">{t('background.environmentLimited')}</Notice>}
            <Notice>{t('background.sleepHint')}</Notice>
          </div>
        ) : (
          <p className="text-sm text-secondary-text" role="status">
            {t('receiver.checking')}
          </p>
        )}
      </section>
      {general}
      <section aria-label={t('background.version')} className="settings-version pairing-card !p-2">
        {onRestartSetup && (
          <button className="kloda-row border-b border-border-subtle !rounded-b-none" onClick={onRestartSetup} type="button">
            <span className="min-w-0 flex-1 text-sm font-medium text-primary-text">{t('ui.restartSetup')}</span>
            <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-tertiary-text" />
          </button>
        )}
        <dl className="flex flex-wrap items-center justify-between gap-2 px-3 py-3 text-sm">
          <dt className="font-semibold text-primary-text">{t('background.version')}</dt>
          <dd className="text-secondary-text tabular-nums">{!unknown && status?.appVersion ? status.appVersion : t('background.versionUnknown')}</dd>
        </dl>
      </section>
      <div className="settings-quit">
        <SettingsQuitButton disabled={!bridge} onQuit={() => void quit()} />
      </div>
    </>
  );
}
