import { contextBridge, ipcRenderer } from 'electron';

async function pairingInvoke(method: string, ...args: unknown[]): Promise<unknown> {
  const reply: unknown = await ipcRenderer.invoke(`kloda:pairing:${method}`, ...args);
  if (!reply || typeof reply !== 'object' || !('ok' in reply)) return Promise.reject({ code: 'outcome_unknown' });
  if (reply.ok !== true) {
    const code = 'code' in reply && typeof reply.code === 'string' ? reply.code : 'outcome_unknown';
    // Plain data survives the contextBridge promise boundary; Error custom properties do not.
    return Promise.reject({ code });
  }
  return 'value' in reply ? reply.value : undefined;
}

contextBridge.exposeInMainWorld('kloda', {
  webdav: {
    issues: () => ipcRenderer.invoke('kloda:webdav:issues'),
    review: (id: string, action: 'recheck' | 'keep_both' | 'skip', language: 'tr' | 'en' | 'de') => ipcRenderer.invoke('kloda:webdav:review', id, action, language),
  },
  background: {
    activity: (after?: string) => pairingInvoke('activity', after),
    status: () => ipcRenderer.invoke('kloda:background:status'),
    setAutostart: (enabled: boolean) => ipcRenderer.invoke('kloda:background:autostart', enabled),
    quit: () => ipcRenderer.invoke('kloda:background:quit'),
  },
  backups: {
    list: (after?: string, trash = false) => pairingInvoke(trash ? 'backup-trash-list' : 'backup-list', after),
    trash: (ids: string[], language: string) => pairingInvoke('backup-trash', ids, language),
    restore: (ids: string[], language: string) => pairingInvoke('backup-restore', ids, language),
  },
  devices: {
    removeDevice: (record: string, language: string) => pairingInvoke('device-remove', record, language),
    list: (after?: string) => pairingInvoke('devices', after),
    approveBackup: (record: string) => pairingInvoke('device-approve', record),
    revokeBackup: (record: string) => pairingInvoke('device-revoke', record),
  },
  pairing: {
    status: () => pairingInvoke('status'),
    createInvitation: () => pairingInvoke('create'),
    approve: (operation: string, generation: string) => pairingInvoke('approve', operation, generation),
    deny: (operation: string, generation: string) => pairingInvoke('deny', operation, generation),
    cancel: (operation: string) => pairingInvoke('cancel', operation),
    resume: (record: string) => pairingInvoke('resume', record),
    approveBackup: (record: string) => pairingInvoke('approve-backup', record),
    revokeBackup: (record: string) => pairingInvoke('revoke-backup', record),
    close: () => pairingInvoke('close'),
  },
  getDraft: () => ipcRenderer.invoke('kloda:get-draft'),
  getProgress: () => ipcRenderer.invoke('kloda:get-progress'),
  pickSources: () => ipcRenderer.invoke('kloda:pick-sources'),
  saveSchedule: (intervalHours: 12 | 24, localTime: string) => ipcRenderer.invoke('kloda:save-schedule', intervalHours, localTime),
  saveStorage: (storage: { endpoint: string; password: string; targetPath: string; username: string }) => ipcRenderer.invoke('kloda:save-storage', storage),
  startSync: () => ipcRenderer.invoke('kloda:start-sync'),
  testStorage: () => ipcRenderer.invoke('kloda:test-storage'),
});
