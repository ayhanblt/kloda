export type MobilePage = 'welcome' | 'home' | 'photos' | 'sources' | 'schedule' | 'computer' | 'pairing' | 'activity' | 'backups' | 'connections' | 'add-connection' | 'provider' | 'settings' | 'storage';
export type NavigateMobile = (page: MobilePage) => void;
