import { app, BrowserWindow, ipcMain, powerMonitor } from 'electron';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { DesktopSyncJournal } from './runtime/journal.js';
import { ElectronScheduleAdapter } from './runtime/scheduler.js';
import { DesktopSyncRuntime } from './runtime/runtime.js';

let mainWindow: BrowserWindow | null = null;

function createWindow(): BrowserWindow {
  const window = new BrowserWindow({
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: fileURLToPath(new URL('./preload.cjs', import.meta.url)),
      sandbox: true,
    },
  });
  const developmentServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (developmentServerUrl) void window.loadURL(developmentServerUrl);
  else void window.loadFile(fileURLToPath(new URL('../renderer/index.html', import.meta.url)));
  mainWindow = window;
  return window;
}

function assertTrustedSender(url: string): void {
  if (url.startsWith('file:') || url.startsWith('http://127.0.0.1:5173')) return;
  throw new Error('Untrusted renderer request.');
}

function registerHandlers(): void {
  const handle = <T>(channel: string, action: () => Promise<T>) => {
    ipcMain.handle(channel, (event) => {
      assertTrustedSender(event.senderFrame?.url ?? '');
      return action();
    });
  };
  handle('kloda:get-draft', () => runtime.getDraft());
  handle('kloda:pick-sources', () => runtime.pickSources());
  ipcMain.handle('kloda:save-schedule', (event, intervalHours: unknown, localTime: unknown) => {
    assertTrustedSender(event.senderFrame?.url ?? '');
    if ((intervalHours !== 12 && intervalHours !== 24) || typeof localTime !== 'string') throw new Error('Invalid schedule payload.');
    return runtime.saveSchedule(intervalHours, localTime).then(() => runtime.getSchedule()).then((schedule) => scheduler.schedule(schedule));
  });
  ipcMain.handle('kloda:save-storage', (event, storage: unknown) => {
    assertTrustedSender(event.senderFrame?.url ?? '');
    if (!isStorageForm(storage)) throw new Error('Invalid storage payload.');
    return runtime.saveStorage(storage);
  });
  handle('kloda:test-storage', () => runtime.testStorage());
  handle('kloda:start-sync', () => runtime.startSync());
}

function isStorageForm(value: unknown): value is { endpoint: string; password: string; targetPath: string; username: string } {
  if (!value || typeof value !== 'object') return false;
  const storage = value as Record<string, unknown>;
  return ['endpoint', 'password', 'targetPath', 'username'].every((key) => typeof storage[key] === 'string');
}

await app.whenReady();
const runtime = new DesktopSyncRuntime(new DesktopSyncJournal(join(app.getPath('userData'), 'sync.sqlite')), () => mainWindow);
const scheduler = new ElectronScheduleAdapter(async () => { await runtime.startSync(); });
scheduler.schedule(await runtime.getSchedule());
powerMonitor.on('resume', () => scheduler.resume());
registerHandlers();
createWindow();

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
