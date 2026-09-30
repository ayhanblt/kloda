import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('kloda', {
  getDraft: () => ipcRenderer.invoke('kloda:get-draft'),
  pickSources: () => ipcRenderer.invoke('kloda:pick-sources'),
  saveSchedule: (intervalHours: 12 | 24, localTime: string) => ipcRenderer.invoke('kloda:save-schedule', intervalHours, localTime),
  saveStorage: (storage: { endpoint: string; password: string; targetPath: string; username: string }) => ipcRenderer.invoke('kloda:save-storage', storage),
  startSync: () => ipcRenderer.invoke('kloda:start-sync'),
  testStorage: () => ipcRenderer.invoke('kloda:test-storage'),
});
