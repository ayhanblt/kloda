import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Archive, ArrowUpFromLine, Download, FolderSync, Home, MonitorSmartphone, PanelTop, QrCode, Settings, Trash2, Waypoints } from 'lucide-react';

import { Brand } from '../../shared/ui/Brand';
import type { DesktopLocation, DesktopRoute } from '../../shared/navigation/desktop-route';

const groups = [
  { label: 'ui.receiverGroup', items: [
    ['receiver', Home, 'receiver.navigation'], ['pairing', QrCode, 'pairing.pairingNavigation'],
    ['devices', MonitorSmartphone, 'devices.navigation'], ['incoming', Download, 'incoming.navigation'],
    ['backups', Archive, 'backups.navigation'], ['trash', Trash2, 'backups.trash'],
  ] },
  { label: 'ui.outgoingGroup', items: [
    ['connections', Waypoints, 'ui.connections'], ['backup', FolderSync, 'receiver.advancedNavigation'], ['jobs', ArrowUpFromLine, 'ui.jobs'],
  ] },
  { label: 'ui.brand', items: [
    ['settings', Settings, 'receiver.settingsNavigation'], ['tray', PanelTop, 'ui.tray'],
  ] },
] as const;

export function DesktopShell({ location, blocked, onNavigate, children }: {
  location: DesktopLocation; blocked: boolean; onNavigate: (page: DesktopRoute) => void; children: ReactNode;
}) {
  const { t, i18n } = useTranslation();
  const welcome = location.page === 'welcome';
  return <div className={`desktop-shell ${welcome ? 'desktop-shell-welcome' : ''}`}>
    {!welcome && <aside className="desktop-sidebar">
      <button className="desktop-brand-button" type="button" disabled={blocked} onClick={() => onNavigate('receiver')} aria-label={t('ui.home')}><Brand /></button>
      <nav aria-label={t('pairing.navigationLabel')} className="desktop-navigation">
        {groups.map((group) => <section key={group.label}>
          <h2>{t(group.label)}</h2>
          {group.items.map(([destination, Icon, label]) => <button aria-current={location.page === destination || destination === 'connections' && location.page.startsWith('connection-') ? 'page' : undefined}
            disabled={blocked} key={destination} onClick={() => onNavigate(destination)} type="button">
            <Icon aria-hidden="true" size={18} /><span>{t(label)}</span>
          </button>)}
        </section>)}
      </nav>
    </aside>}
    <div className="desktop-main">
      <header className="desktop-toolbar">
        {welcome ? <Brand /> : <span className="desktop-profile-label">{t('ui.localComputer')}</span>}
        <div className="desktop-toolbar-controls">
          {!welcome && <button className="pairing-button" disabled={blocked} onClick={() => onNavigate('welcome')} type="button">{t('ui.setup')}</button>}
          <label className="desktop-language"><span className="sr-only">{t('ui.language')}</span>
            <select aria-label={t('ui.language')} value={i18n.resolvedLanguage?.split('-')[0] ?? 'tr'} onChange={(event) => { void i18n.changeLanguage(event.target.value); }}>
              {(['tr', 'en', 'de'] as const).map((language) => <option key={language} value={language}>{t(`ui.languages.${language}`)}</option>)}
            </select>
          </label>
        </div>
      </header>
      {children}
    </div>
  </div>;
}
