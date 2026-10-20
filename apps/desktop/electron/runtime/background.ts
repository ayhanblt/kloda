import { app, dialog, ipcMain, Menu, nativeImage, Tray, type BrowserWindow, type IpcMainInvokeEvent } from 'electron';

import type { DesktopAutostart } from './autostart.js';
import type { DesktopSyncJournal } from './journal.js';
import type { DesktopSyncRuntime } from './runtime.js';

interface ReceiverState { available: boolean; activeTransfers: number; errorCode?: string }
interface BackgroundOptions {
  showWindow(): BrowserWindow;
  window(): BrowserWindow | null;
  receiverStatus(): Promise<ReceiverState>;
  closeReceiver(): Promise<void>;
  stopSchedule(): void;
  runtime: DesktopSyncRuntime;
  journal: DesktopSyncJournal;
  autostart: DesktopAutostart;
  iconPath: string;
  platform?: NodeJS.Platform;
}

export class DesktopBackground {
  private tray: Tray | undefined;
  private linuxControlVerified = false;
  private timer: NodeJS.Timeout | undefined;
  private polling: Promise<void> | undefined;
  private quitPrompt: Promise<void> | undefined;
  private quitting = false;
  private quitComplete = false;
  private shutdownError = false;
  private readonly platform: NodeJS.Platform;
  private receiver: ReceiverState = { available: false, activeTransfers: 0 };
  private backup = { active: false, failed: false };
  private badge: boolean | undefined;

  constructor(private readonly options: BackgroundOptions) { this.platform = options.platform ?? process.platform; }

  start(): void {
    try {
      const image = nativeImage.createFromPath(this.options.iconPath).resize({ height: 18 });
      if (image.isEmpty()) throw new Error('Tray image unavailable');
      this.tray = new Tray(image);
      this.tray.on('click', () => { this.linuxControlVerified = true; this.options.showWindow(); });
      this.tray.on('right-click', () => { this.linuxControlVerified = true; });
    } catch { this.tray = undefined; }
    const quit = () => app.quit();
    Menu.setApplicationMenu(Menu.buildFromTemplate([
      { label: 'Kloda', submenu: [
        { label: 'Kloda’yı aç', click: () => this.options.showWindow() },
        { label: 'Ayarlar ve durum', click: () => this.options.showWindow() },
        { type: 'separator' },
        { label: 'Kloda’dan çık', accelerator: 'CommandOrControl+Q', click: quit },
      ] },
      { role: 'editMenu' }, { role: 'viewMenu' }, { role: 'windowMenu' },
    ]));
    app.on('before-quit', (event) => {
      if (this.quitComplete) return;
      event.preventDefault();
      if (!this.quitPrompt) this.quitPrompt = this.confirmQuit().finally(() => { this.quitPrompt = undefined; });
    });
    this.registerHandlers();
    void this.refresh();
    this.timer = setInterval(() => { void this.refresh(); }, 1500);
  }

  attach(window: BrowserWindow): void {
    window.on('close', (event) => {
      if (this.quitting) return;
      event.preventDefault();
      if (this.canHide()) window.hide();
      else this.options.showWindow();
    });
  }

  canHide(): boolean {
    return Boolean(this.tray && !this.tray.isDestroyed() &&
      (this.platform !== 'linux' || this.linuxControlVerified));
  }

  snapshot() {
    return {
      receiver: this.receiver, backup: this.backup,
      autostart: this.options.autostart.status(),
      autostartChoice: this.options.journal.getAutostartChoice() ?? null,
      canHide: this.canHide(),
      environmentLimited: !this.canHide(),
      shutdownError: this.shutdownError,
    };
  }

  refresh(): Promise<void> {
    if (this.polling) return this.polling;
    if (this.quitting) return Promise.resolve();
    this.polling = (async () => {
      try { this.receiver = await this.options.receiverStatus(); }
      catch { this.receiver = { available: false, activeTransfers: 0, errorCode: 'outcome_unknown' }; }
      try { this.backup = this.options.runtime.getBackgroundState(); }
      catch { this.backup = { active: false, failed: true }; }
      if (!this.quitting) this.updateTray();
      if (!this.canHide()) {
        const window = this.options.window();
        if (window && !window.isDestroyed() && !window.isVisible()) this.options.showWindow();
      }
    })().finally(() => { this.polling = undefined; });
    return this.polling;
  }

  private updateTray(): void {
    if (!this.tray || this.tray.isDestroyed()) return;
    const error = Boolean(this.receiver.errorCode || this.backup.failed || this.shutdownError);
    if (this.badge !== error) {
      const image = nativeImage.createFromPath(this.options.iconPath).resize({ width: 18, height: 18 });
      if (error) {
        const bitmap = image.toBitmap();
        // BGRA pixels: a high-contrast exclamation mark, not a synthetic error state.
        for (let y = 1; y < 17; y += 1) for (let x = 11; x < 18; x += 1) {
          const white = x >= 13 && x <= 15 && ((y >= 3 && y <= 10) || (y >= 13 && y <= 14));
          const offset = (y * 18 + x) * 4;
          bitmap.set(white ? [255, 255, 255, 255] : [35, 35, 210, 255], offset);
        }
        this.tray.setImage(nativeImage.createFromBitmap(bitmap, { width: 18, height: 18 }));
      } else this.tray.setImage(image);
      this.badge = error;
    }
    const receiver = this.receiver.errorCode ? `Alıcı: ${this.errorText(this.receiver.errorCode)}`
      : this.receiver.available ? 'Alıcı dinliyor (erişilebilirlik garantisi değil)' : 'Alıcı durumu doğrulanmadı';
    const backup = this.backup.active || this.receiver.activeTransfers > 0 ? 'Etkin yedekleme/bağlantı var'
      : this.backup.failed ? 'Son WebDAV yedeklemesi tamamlanmadı' : 'Etkin yedekleme yok';
    this.tray.setToolTip(`${error ? '! ' : ''}Kloda — ${receiver} — ${backup}`);
    this.tray.setContextMenu(Menu.buildFromTemplate([
      { label: 'Kloda’yı aç', click: () => { this.linuxControlVerified = true; this.options.showWindow(); } },
      { label: receiver, enabled: false }, { label: backup, enabled: false },
      { label: error ? 'Hata ayrıntıları ve ayarlar' : 'Durum ve ayarlar', click: () => this.options.showWindow() },
      { type: 'separator' }, { label: 'Kloda’dan çık', click: () => app.quit() },
    ]));
  }

  private errorText(code: string): string {
    const errors: Record<string, string> = {
      native_unsupported: 'bu platformda yerel alıcı desteklenmiyor', identity_unavailable: 'cihaz kimliği kullanılamıyor',
      storage_failure: 'yerel kayıt deposu kullanılamıyor', continuity_lost: 'kurulum sürekliliği doğrulanamadı',
      lan_unavailable: 'doğrudan yerel ağ kullanılamıyor', backup_full: 'yedekleme diski veya kota dolu',
      backup_unavailable: 'yedekleme klasörü kullanılamıyor', backup_permission_denied: 'klasör erişimi reddedildi',
      backup_busy: 'yedekleme klasörü kilitli', backup_scope_changed: 'onaylanan klasör değişti',
      acl_busy: 'izin deposu meşgul', acl_unavailable: 'izin deposu kullanılamıyor',
    };
    return errors[code] ?? 'yerel alıcı hatası; ayrıntılar için pencereyi açın';
  }

  private async confirmQuit(): Promise<void> {
    try {
      await this.refresh();
      const window = this.options.showWindow();
      const active = this.backup.active || this.receiver.activeTransfers > 0;
      const answer = await dialog.showMessageBox(window, {
        type: 'warning', title: 'Kloda’dan çık',
        message: 'Kloda’dan çıkarsanız bu bilgisayara yedekleme yapılamaz. Yedeklemelerin devam etmesi için Kloda’yı yeniden açmanız gerekir.',
        detail: active ? 'Etkin aktarım veya devam eden yedekleme işlemi kesilecek. Tamamlanmamış işler tamamlandı gösterilmeyecek; kurtarma kayıtları korunacak.'
          : 'Tamamlanmamış işler ve kurtarma kayıtları korunur. Bilgisayar uyurken veya kapalıyken aktarım garantisi yoktur.',
        buttons: ['Vazgeç', 'Çık'], defaultId: 0, cancelId: 0, noLink: true,
      });
      if (answer.response !== 1) return;
      this.quitting = true;
      this.options.stopSchedule();
      this.options.runtime.prepareToQuit();
      await this.options.closeReceiver();
      clearInterval(this.timer);
      this.tray?.destroy();
      this.quitComplete = true;
      app.quit();
    } catch {
      this.quitting = false;
      this.shutdownError = true;
      this.options.showWindow();
      this.updateTray();
    }
  }

  private trusted(event: IpcMainInvokeEvent, active = false): void {
    const window = this.options.window();
    if (!window || window.isDestroyed() || event.sender !== window.webContents ||
      event.senderFrame !== window.webContents.mainFrame ||
      (active && (!window.isVisible() || window.isMinimized() || !window.isFocused()))) throw new Error('Untrusted desktop settings request');
    const actual = new URL(event.senderFrame.url);
    const expected = process.env.VITE_DEV_SERVER_URL ? new URL(process.env.VITE_DEV_SERVER_URL)
      : new URL('../../renderer/index.html', import.meta.url);
    if (actual.protocol !== expected.protocol || actual.origin !== expected.origin || actual.pathname !== expected.pathname ||
      actual.search !== expected.search) throw new Error('Untrusted desktop settings request');
  }

  private registerHandlers(): void {
    ipcMain.handle('kloda:background:status', async (event) => {
      this.trusted(event); await this.refresh(); return this.snapshot();
    });
    ipcMain.handle('kloda:background:autostart', (event, enabled: unknown) => {
      this.trusted(event, true);
      if (typeof enabled !== 'boolean') throw new Error('Invalid login-start choice');
      this.options.autostart.setEnabled(enabled);
      this.options.journal.saveAutostartChoice(enabled);
      return this.snapshot();
    });
    ipcMain.handle('kloda:background:quit', (event) => { this.trusted(event, true); app.quit(); });
  }
}
