import { Archive, ArrowDownToLine, ChevronRight, LogOut, Smartphone } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import type { BackgroundStatus } from '../../shared/api/desktop';
import { Notice, StatusPill, TrayIconSvg, type StatusTone } from '../../shared/ui/Kit';
import { DesktopTray } from './DesktopTray';
import type { ReceiverSummary } from './DesktopBackground';

export function DesktopTraySection({
  status,
  unknown,
  quitDisabled,
  onOpen,
  onQuit,
}: {
  status: BackgroundStatus | null;
  unknown: boolean;
  quitDisabled: boolean;
  onOpen(): void;
  onQuit(): void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap items-start gap-8">
      <DesktopTray onOpen={onOpen} onQuit={onQuit} quitDisabled={quitDisabled} status={status} unknown={unknown} />
      <section className="pairing-card space-y-3" aria-label={t('ui.trayBarTitle')}>
        <p className="text-sm font-semibold text-primary-text">{t('ui.trayBarTitle')}</p>
        <div className="flex items-center gap-4 text-primary-text">
          <span className="grid h-8 place-items-center rounded-lg bg-surface-2 px-2.5">
            <TrayIconSvg className="size-4" />
          </span>
          <span className="grid h-8 place-items-center rounded-lg bg-surface-2 px-2.5">
            <TrayIconSvg className="size-4" />
          </span>
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-surface-2">
            <TrayIconSvg className="size-5" />
          </span>
        </div>
      </section>
    </div>
  );
}

export function DesktopReceiverSummary({
  status,
  unknown,
  receiverTone,
  receiverActive,
  quitDisabled,
  receiverSummary,
  onQuit,
}: {
  status: BackgroundStatus | null;
  unknown: boolean;
  receiverTone: StatusTone;
  receiverActive: boolean;
  quitDisabled: boolean;
  receiverSummary?: ReceiverSummary;
  onQuit(): void;
}) {
  const { t } = useTranslation();
  return (
    <div className="mb-6 grid gap-3 md:grid-cols-3">
      <section aria-label={t('background.title')} className="desktop-background pairing-card md:col-span-2 !mb-0 flex flex-col justify-between gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold text-primary-text">{t('receiver.statusTitle')}</h2>
            {status && !unknown ? (
              <StatusPill role="status" tone={receiverTone}>
                {t(status.receiver.available ? 'background.listening' : 'background.unavailable')}
              </StatusPill>
            ) : !unknown ? (
              <StatusPill role="status" tone="pending">
                {t('receiver.checking')}
              </StatusPill>
            ) : null}
          </div>
          <button className="pairing-button !min-h-9 !px-3 !py-1.5 !text-xs" disabled={quitDisabled} onClick={onQuit} type="button">
            {t('background.quit')}
          </button>
        </div>

        {unknown ? (
          <Notice role="alert" tone="danger">
            {t('background.unknown')}
          </Notice>
        ) : (
          status && (
            <div className="space-y-3">
              {receiverSummary?.devicesTotal !== null && receiverSummary?.devicesTotal !== undefined && (
                <div>
                  <p className="text-[40px] font-semibold leading-none tracking-tight tabular-nums text-primary-text">
                    {t('ui.summaryCount', { ready: receiverSummary.devicesGranted, total: receiverSummary.devicesTotal })}
                  </p>
                  <p className="mt-1.5 text-sm text-secondary-text">
                    {t('ui.devicesSummary', { total: receiverSummary.devicesTotal, granted: receiverSummary.devicesGranted })}
                  </p>
                </div>
              )}
              <div className="flex flex-wrap items-center gap-2 text-sm text-secondary-text">
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
              {status.environmentLimited && <Notice tone="warn">{t('background.environmentLimited')}</Notice>}
            </div>
          )
        )}

        <div className="space-y-1 text-xs leading-relaxed text-tertiary-text">
          <p>{t('background.sleepHint')}</p>
          <p>{t('receiver.listenerBoundary')}</p>
        </div>
      </section>

      {receiverSummary ? (
        <section className="pairing-card flex flex-col justify-center gap-1 p-2" aria-label={t('ui.receiverGroup')}>
          <button className="kloda-row" onClick={() => receiverSummary.onNavigate('incoming')} type="button">
            <ArrowDownToLine aria-hidden="true" className="size-5 shrink-0 text-secondary-text" strokeWidth={1.5} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-primary-text">{t('incoming.navigation')}</span>
              {receiverSummary.incomingCount !== null && (
                <span className="block truncate text-xs text-secondary-text tabular-nums">
                  {receiverSummary.incomingCount} {t('ui.itemsWord')}
                </span>
              )}
            </span>
            <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-tertiary-text" />
          </button>
          <button className="kloda-row" onClick={() => receiverSummary.onNavigate('devices')} type="button">
            <Smartphone aria-hidden="true" className="size-5 shrink-0 text-secondary-text" strokeWidth={1.5} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-primary-text">{t('devices.navigation')}</span>
              {receiverSummary.devicesTotal !== null && (
                <span className="block truncate text-xs text-secondary-text tabular-nums">{receiverSummary.devicesTotal}</span>
              )}
            </span>
            <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-tertiary-text" />
          </button>
          <button className="kloda-row" onClick={() => receiverSummary.onNavigate('backups')} type="button">
            <Archive aria-hidden="true" className="size-5 shrink-0 text-secondary-text" strokeWidth={1.5} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-primary-text">{t('backups.navigation')}</span>
            </span>
            <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-tertiary-text" />
          </button>
        </section>
      ) : (
        <section className="pairing-card flex items-center justify-center p-4 text-xs text-secondary-text">{t('background.sleepHint')}</section>
      )}
    </div>
  );
}

export function SettingsQuitButton({ disabled, onQuit }: { disabled: boolean; onQuit(): void }) {
  const { t } = useTranslation();
  return (
    <button className="pairing-button" disabled={disabled} onClick={onQuit} type="button">
      <LogOut aria-hidden="true" size={16} />
      {t('background.quit')}
    </button>
  );
}
