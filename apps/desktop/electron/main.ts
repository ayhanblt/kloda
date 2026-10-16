import { app, BrowserWindow, ipcMain, Menu, nativeImage, powerMonitor, Tray } from 'electron';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { DesktopSyncJournal } from './runtime/journal.js';
import { ElectronScheduleAdapter } from './runtime/scheduler.js';
import { DesktopSyncRuntime } from './runtime/runtime.js';
import { bindPairingWindow, closeNativePairing, registerPairingHandlers } from './runtime/pairing.js';
import { desktopDisplayName, initializeDesktopProfile } from './runtime/desktop-profile.js';

let primaryInstance = false;
try {
  initializeDesktopProfile(app);
  primaryInstance = app.requestSingleInstanceLock();
} catch (error) {
  console.error('Kloda desktop initialization failed.', error);
  app.exit(1);
  throw error;
}
if (!primaryInstance) app.quit();

let mainWindow: BrowserWindow | null = null;
let runtime: DesktopSyncRuntime;
let scheduler: ElectronScheduleAdapter;
let tray: Tray;
let quitting = false;

function createWindow(): BrowserWindow {
  const window = new BrowserWindow({
    title: desktopDisplayName,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: fileURLToPath(new URL('./preload.cjs', import.meta.url)),
      sandbox: true,
    },
  });
  bindPairingWindow(window);
  window.on('close', (event) => {
    if (quitting) return;
    event.preventDefault();
    window.hide();
  });
  window.on('closed', () => { if (mainWindow === window) mainWindow = null; });
  const developmentServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (developmentServerUrl) void window.loadURL(developmentServerUrl);
  else void window.loadFile(fileURLToPath(new URL('../renderer/index.html', import.meta.url)));
  mainWindow = window;
  return window;
}

function showWindow(): void {
  const window = mainWindow ?? createWindow();
  if (window.isMinimized()) window.restore();
  window.show();
  window.focus();
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
  handle('kloda:get-progress', () => runtime.getProgress());
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

// Do not suspend Electron's ESM entrypoint on ready: entry loading precedes ready.
void app.whenReady().then(async () => {
  if (!primaryInstance) return;
  const icon = nativeImage.createFromPath(fileURLToPath(new URL('../renderer/tray-logo.png', import.meta.url)));
  if (icon.isEmpty()) throw new Error('Desktop tray image is unavailable.');
  tray = new Tray(icon.resize({ height: 18 }));
  tray.setToolTip(desktopDisplayName);
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: desktopDisplayName, click: showWindow },
    { type: 'separator' },
    { role: 'quit' },
  ]));
  tray.on('click', showWindow);
  const sqliteBinding = fileURLToPath(new URL('../native/better_sqlite3.node', import.meta.url));
  const journal = new DesktopSyncJournal(join(app.getPath('userData'), 'sync.sqlite'), sqliteBinding);
  runtime = new DesktopSyncRuntime(journal, () => mainWindow);
  scheduler = new ElectronScheduleAdapter(async () => { await runtime.startSync(); }, journal);
  scheduler.schedule(await runtime.getSchedule());
  powerMonitor.on('resume', () => scheduler.resume());
  registerHandlers();
  registerPairingHandlers(() => mainWindow);
  createWindow();

  app.on('second-instance', showWindow);
  app.on('activate', showWindow);

  let pairingClosedForQuit = false;
  app.on('before-quit', (event) => {
    if (pairingClosedForQuit) return;
    quitting = true;
    scheduler.cancel();
    event.preventDefault();
    void closeNativePairing().catch(() => {
      console.error('Kloda pairing shutdown could not be confirmed.');
    }).finally(() => {
      pairingClosedForQuit = true;
      tray.destroy();
      app.quit();
    });
  });
}).catch(() => {
  console.error('Kloda startup failed.');
  app.exit(1);
});
