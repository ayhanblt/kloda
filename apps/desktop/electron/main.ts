import { app, BrowserWindow, ipcMain, powerMonitor } from 'electron';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { DesktopSyncJournal } from './runtime/journal.js';
import { ElectronScheduleAdapter } from './runtime/scheduler.js';
import { registerWebDavHandlers } from './runtime/webdav-ipc.js';
import { DesktopSyncRuntime } from './runtime/runtime.js';
import { bindPairingWindow, closeNativePairing, receiverStatus, registerPairingHandlers, startNativeReceiver } from './runtime/pairing.js';
import { desktopDisplayName, initializeDesktopProfile } from './runtime/desktop-profile.js';
import { DesktopBackground } from './runtime/background.js';
import { backgroundLaunchArgument, DesktopAutostart } from './runtime/autostart.js';

let primaryInstance = false;
let profile: ReturnType<typeof initializeDesktopProfile>;
try {
  profile = initializeDesktopProfile(app);
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
let background: DesktopBackground;
let loginLaunch = false;

function createWindow(): BrowserWindow {
  const window = new BrowserWindow({
    title: desktopDisplayName,
    show: !(loginLaunch && background.canHide()),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: fileURLToPath(new URL('./preload.cjs', import.meta.url)),
      sandbox: true,
    },
  });
  bindPairingWindow(window);
  background.attach(window);
  window.on('closed', () => { if (mainWindow === window) mainWindow = null; });
  const developmentServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (developmentServerUrl) void window.loadURL(developmentServerUrl);
  else void window.loadFile(fileURLToPath(new URL('../renderer/index.html', import.meta.url)));
  mainWindow = window;
  return window;
}

function showWindow(): BrowserWindow {
  const window = mainWindow ?? createWindow();
  if (window.isMinimized()) window.restore();
  window.show();
  window.focus();
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
  const sqliteBinding = fileURLToPath(new URL('../native/better_sqlite3.node', import.meta.url));
  const journal = new DesktopSyncJournal(join(app.getPath('userData'), 'sync.sqlite'), sqliteBinding);
  runtime = new DesktopSyncRuntime(journal, () => mainWindow);
  scheduler = new ElectronScheduleAdapter(async () => { await runtime.startScheduledSync(); }, journal);
  const autostart = new DesktopAutostart({ app, registrationId: profile.applicationId });
  loginLaunch = journal.getAutostartChoice() === true && autostart.status().enabled &&
    (process.argv.includes(backgroundLaunchArgument) ||
      (process.platform === 'darwin' && app.getLoginItemSettings().wasOpenedAtLogin));
  background = new DesktopBackground({
    window: () => mainWindow, showWindow, runtime, journal, autostart,
    receiverStatus, closeReceiver: closeNativePairing, stopSchedule: () => scheduler.cancel(),
    iconPath: fileURLToPath(new URL('../renderer/tray-logo.png', import.meta.url)),
  });
  background.start();
  runtime.resumeRetries();
  scheduler.schedule(await runtime.getSchedule());
  powerMonitor.on('resume', () => scheduler.resume());
  registerHandlers();
  registerWebDavHandlers(runtime, () => mainWindow);
  registerPairingHandlers(() => mainWindow);
  createWindow();
  // Receiver startup uses the existing native custody/storage gates, never a software fallback.
  void startNativeReceiver().catch(() => undefined).finally(() => { void background.refresh(); });

  app.on('second-instance', showWindow);
  app.on('activate', showWindow);

}).catch(() => {
  console.error('Kloda startup failed.');
  app.exit(1);
});
