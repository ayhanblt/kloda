import { destinationProviders, type DestinationProviderId } from '@kloda/sync-core';

export type DesktopRoute = 'welcome' | 'receiver' | 'backup' | 'jobs' | 'pairing' | 'incoming' | 'devices' | 'settings' | 'backups' | 'trash' | 'connections' | 'connection-add' | 'connection-detail' | 'tray';
export interface DesktopLocation { page: DesktopRoute; provider?: DestinationProviderId }
const pages: DesktopRoute[] = ['welcome', 'receiver', 'backup', 'jobs', 'pairing', 'incoming', 'devices', 'settings', 'backups', 'trash', 'connections', 'tray'];

export function currentDesktopLocation(): DesktopLocation {
  const [name, action, id] = window.location.hash.slice(2).split('/');
  const provider = destinationProviders.find((item) => item.id === id)?.id;
  if (name === 'connections' && action === 'new') return { page: 'connection-add', provider };
  if (name === 'connections' && action === 'detail' && provider) return { page: 'connection-detail', provider };
  if (!name) return { page: 'welcome' };
  return { page: pages.includes(name as DesktopRoute) ? name as DesktopRoute : 'receiver' };
}
export function desktopHash(location: DesktopLocation): string {
  if (location.page === 'connection-add') return `#/connections/new${location.provider ? `/${location.provider}` : ''}`;
  if (location.page === 'connection-detail') return `#/connections/detail/${location.provider}`;
  return `#/${location.page}`;
}
