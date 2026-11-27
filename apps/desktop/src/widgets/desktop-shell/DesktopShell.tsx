import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Archive, ArrowUpFromLine, Download, FolderSync, Home, Menu, MonitorSmartphone, PanelTop, QrCode, Settings, Trash2, Waypoints, X } from 'lucide-react';

import type { BackgroundStatus } from '../../shared/api/desktop';
import type { DesktopLocation, DesktopRoute } from '../../shared/navigation/desktop-route';
import { Brand } from '../../shared/ui/Brand';
import { StatusPill, type StatusTone } from '../../shared/ui/Kit';

const groups = [
  {
    label: 'ui.receiverGroup',
    items: [
      ['receiver', Home, 'receiver.navigation'],
      ['pairing', QrCode, 'pairing.pairingNavigation'],
      ['devices', MonitorSmartphone, 'devices.navigation'],
      ['incoming', Download, 'incoming.navigation'],
      ['backups', Archive, 'backups.navigation'],
      ['trash', Trash2, 'backups.trash'],
    ],
  },
  {
    label: 'ui.outgoingGroup',
    items: [
      ['connections', Waypoints, 'ui.connections'],
      ['backup', FolderSync, 'receiver.advancedNavigation'],
      ['jobs', ArrowUpFromLine, 'ui.jobs'],
    ],
  },
  {
    label: 'ui.brand',
    items: [
      ['settings', Settings, 'receiver.settingsNavigation'],
      ['tray', PanelTop, 'ui.tray'],
    ],
  },
] as const;

export function DesktopShell({
  location,
  blocked,
  bgStatus = null,
  bgFailed = false,
  onNavigate,
  children,
}: {
  location: DesktopLocation;
  blocked: boolean;
  bgStatus?: BackgroundStatus | null;
  bgFailed?: boolean;
  onNavigate: (page: DesktopRoute) => void;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const welcome = location.page === 'welcome';
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.page]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [menuOpen]);

  let statusLabel = t('tray.state.checking');
  let statusTone: StatusTone = 'pending';
  if (bgFailed) {
    statusLabel = t('tray.state.unknown');
    statusTone = 'danger';
  } else if (bgStatus) {
    const active = bgStatus.backup.active || bgStatus.receiver.activeTransfers > 0;
    const err = Boolean(bgStatus.receiver.errorCode || bgStatus.backup.failed || bgStatus.shutdownError);
    if (err) {
      statusLabel = t('tray.state.error');
      statusTone = 'danger';
    } else if (active) {
      statusLabel = t('tray.state.active');
      statusTone = 'syncing';
    } else if (bgStatus.receiver.available) {
      statusLabel = t('tray.state.listening');
      statusTone = 'synced';
    } else {
      statusLabel = t('tray.state.unavailable');
      statusTone = 'review';
    }
  }

  const choose = (destination: DesktopRoute) => {
    setMenuOpen(false);
    onNavigate(destination);
  };

  return (
    <div className={`desktop-shell ${welcome ? 'desktop-shell-welcome' : ''}`}>
      {!welcome && menuOpen && (
        <button
          aria-label={t('pairing.dismissNotification')}
          className="desktop-drawer-backdrop"
          onClick={() => setMenuOpen(false)}
          tabIndex={-1}
          type="button"
        />
      )}
      {!welcome && (
        <aside className={`desktop-sidebar ${menuOpen ? 'desktop-sidebar-open' : ''}`}>
          <div className="desktop-sidebar-top">
            <button className="desktop-brand-button" type="button" disabled={blocked} onClick={() => choose('receiver')} aria-label={t('ui.home')}>
              <Brand />
            </button>
            <button
              aria-label={t('pairing.dismissNotification')}
              className="desktop-sidebar-close"
              onClick={() => setMenuOpen(false)}
              type="button"
            >
              <X aria-hidden="true" size={18} />
            </button>
          </div>
          <nav aria-label={t('pairing.navigationLabel')} className="desktop-navigation">
            {groups.map((group) => (
              <section key={group.label}>
                <h2>{t(group.label)}</h2>
                {group.items.map(([destination, Icon, label]) => (
                  <button
                    aria-current={location.page === destination || (destination === 'connections' && location.page.startsWith('connection-')) ? 'page' : undefined}
                    disabled={blocked}
                    key={destination}
                    onClick={() => choose(destination)}
                    type="button"
                  >
                    <Icon aria-hidden="true" size={18} />
                    <span>{t(label)}</span>
                  </button>
                ))}
              </section>
            ))}
          </nav>
          <div className="desktop-sidebar-status">
            <StatusPill tone={statusTone}>{statusLabel}</StatusPill>
            <p className="!font-normal !text-secondary-text">
              {bgStatus && !bgFailed
                ? t(bgStatus.backup.active || bgStatus.receiver.activeTransfers > 0 ? 'background.active' : 'background.idle')
                : t('ui.localComputer')}
            </p>
          </div>
        </aside>
      )}
      <div className="desktop-main">
        <header className="desktop-toolbar">
          <div className="flex items-center gap-3">
            {welcome ? (
              <Brand />
            ) : (
              <>
                <button
                  aria-expanded={menuOpen}
                  aria-label={t('pairing.navigationLabel')}
                  className="desktop-hamburger"
                  disabled={blocked}
                  onClick={() => setMenuOpen((current) => !current)}
                  type="button"
                >
                  {menuOpen ? <X aria-hidden="true" size={20} /> : <Menu aria-hidden="true" size={20} />}
                </button>
                <span className="desktop-mobile-brand">
                  <Brand />
                </span>
              </>
            )}
          </div>
          <div className="desktop-toolbar-controls" />
        </header>
        {children}
      </div>
    </div>
  );
}
