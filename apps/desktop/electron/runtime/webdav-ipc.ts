import { dialog, ipcMain, type BrowserWindow, type IpcMainInvokeEvent } from 'electron';
import type { DesktopSyncRuntime } from './runtime.js';

const confirmations = {
  tr: ['İki kopyayı da koru', 'Mevcut uzak dosyanın üzerine yazılmaz. Doğrulanmış yükleme PC adı, UTC zaman ve revision içeren ayrı bir adla korunur.', 'Vazgeç'],
  en: ['Keep both copies', 'The existing remote file is preserved. The verified upload is saved separately with the PC name, UTC time and revision in its name.', 'Cancel'],
  de: ['Beide Kopien behalten', 'Die vorhandene entfernte Datei bleibt erhalten. Der verifizierte Upload wird separat mit PC-Name, UTC-Zeit und Revision im Namen gespeichert.', 'Abbrechen'],
};

export function registerWebDavHandlers(runtime: DesktopSyncRuntime, window: () => BrowserWindow | null): void {
  function trusted(event: IpcMainInvokeEvent, foreground = false): BrowserWindow {
    const parent = window();
    if (!parent || parent.isDestroyed() || event.sender !== parent.webContents ||
      event.senderFrame !== parent.webContents.mainFrame) throw new Error('Untrusted WebDAV renderer.');
    const actual = new URL(event.senderFrame.url);
    const expected = process.env.VITE_DEV_SERVER_URL ? new URL(process.env.VITE_DEV_SERVER_URL)
      : new URL('../../renderer/index.html', import.meta.url);
    if (actual.protocol !== expected.protocol || actual.origin !== expected.origin || actual.pathname !== expected.pathname ||
      actual.search !== expected.search) throw new Error('Untrusted WebDAV renderer.');
    if (foreground && (!parent.isVisible() || !parent.isFocused() || parent.isMinimized())) throw new Error('Visible active window required.');
    return parent;
  }
  ipcMain.handle('kloda:webdav:issues', event => { trusted(event); return runtime.getWebDavIssues(); });
  ipcMain.handle('kloda:webdav:review', async (event, id: unknown, action: unknown, language: unknown) => {
    const parent = trusted(event, true);
    if (typeof id !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(id) ||
      (action !== 'recheck' && action !== 'keep_both' && action !== 'skip') ||
      (language !== 'tr' && language !== 'en' && language !== 'de')) throw new Error('Invalid WebDAV review request.');
    if (action === 'keep_both') {
      const issue = (await runtime.getWebDavIssues()).find(issue => issue.id === id);
      if (!issue?.canKeepBoth) throw new Error('Verified conflict required.');
      const [title, detail, cancel] = confirmations[language];
      const result = await dialog.showMessageBox(parent, { type: 'question', title, message: title,
        detail: `${issue.relativePath}\n\n${detail}`, buttons: [cancel, title], defaultId: 0, cancelId: 0, noLink: true });
      trusted(event, true);
      if (result.response !== 1) return;
    }
    return runtime.reviewWebDavIssue(id, action, () => { trusted(event, true); });
  });
}
