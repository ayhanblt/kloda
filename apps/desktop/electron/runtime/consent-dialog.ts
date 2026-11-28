import * as electron from 'electron';
import type { BrowserWindow as ElectronBrowserWindow } from 'electron';
import { randomBytes } from 'node:crypto';
import type { ConsentTheme } from './consent-dialog-copy.js';

export interface ConsentField {
  label: string;
  value: string;
  mono?: boolean;
}

export interface KlodaConfirmOptions {
  title: string;
  message: string;
  fields?: ConsentField[];
  body: string;
  note?: string;
  confirmLabel: string;
  cancelLabel: string;
  tone?: 'brand' | 'danger';
  theme?: ConsentTheme;
  fallbackType?: 'question' | 'warning';
}

export function escapeConsentHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function palette(theme?: ConsentTheme, tone?: 'brand' | 'danger') {
  const dark = theme !== 'light';
  const danger = tone === 'danger';
  if (dark) {
    return {
      bg: '#161412', surface: '#221F1C', border: '#2E2A26', text: '#F4EFE9', muted: '#A89F96',
      tile: '#2A2521', ring: '#F4EFE9', dot: '#E5C39E',
      confirmBg: danger ? '#C85C5C' : '#E5C39E', confirmText: danger ? '#FFF8F8' : '#1A1612',
      cancelBg: '#2A2521', cancelText: '#F4EFE9', cancelBorder: '#3C3630',
    };
  }
  return {
    bg: '#F7F3EE', surface: '#FFFFFF', border: '#E5DDD3', text: '#1C1917', muted: '#6E655D',
    tile: '#EFE7DD', ring: '#1C1917', dot: '#9A6640',
    confirmBg: danger ? '#B43E3E' : '#8C5A34', confirmText: '#FFFFFF',
    cancelBg: '#EFE7DD', cancelText: '#1C1917', cancelBorder: '#D8CFC4',
  };
}

function buildConsentHtml(options: KlodaConfirmOptions, nonce: string): string {
  const colors = palette(options.theme, options.tone);
  const fieldsHtml = (options.fields ?? [])
    .map((field) => `<div class="field"><span class="field-label">${escapeConsentHtml(field.label)}</span>`
      + `<span class="field-value${field.mono ? ' mono' : ''}">${escapeConsentHtml(field.value)}</span></div>`)
    .join('');
  const noteHtml = options.note ? `<p class="note">${escapeConsentHtml(options.note)}</p>` : '';
  const confirmUrl = `https://kloda-consent.invalid/${nonce}/confirm`;
  const cancelUrl = `https://kloda-consent.invalid/${nonce}/cancel`;

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8" /><title>${escapeConsentHtml(options.title)}</title>
<style>
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: ${colors.bg}; color: ${colors.text}; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, sans-serif; user-select: none; overflow-x: hidden; overflow-y: auto; }
.wrap { display: flex; flex-direction: column; min-height: 100vh; padding: 22px 24px 20px; border: 1px solid ${colors.border}; background: ${colors.bg}; }
.header { display: flex; align-items: center; gap: 12px; margin-bottom: 14px; }
.logo-tile { width: 38px; height: 38px; border-radius: 10px; background: ${colors.tile}; border: 1px solid ${colors.border}; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.eyebrow { font-size: 12px; font-weight: 600; color: ${colors.muted}; margin: 0 0 2px; }
h1 { font-size: 17px; line-height: 1.3; font-weight: 600; margin: 0; }
.card { background: ${colors.surface}; border: 1px solid ${colors.border}; border-radius: 14px; padding: 12px 14px; margin-bottom: 12px; display: flex; flex-direction: column; gap: 8px; }
.field { display: flex; flex-direction: column; gap: 2px; }
.field-label { font-size: 11px; font-weight: 600; color: ${colors.muted}; }
.field-value { font-size: 13px; color: ${colors.text}; word-break: break-word; user-select: text; }
.field-value.mono { font-family: ui-monospace, SFMono-Regular, Consolas, monospace; font-size: 12px; }
.body { font-size: 13px; line-height: 1.48; color: ${colors.text}; margin: 0 0 8px; }
.note { font-size: 12px; line-height: 1.45; color: ${colors.muted}; margin: 0; }
.spacer { flex: 1; }
.actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 14px; }
button { min-height: 38px; padding: 0 18px; border-radius: 999px; font-size: 13px; font-weight: 600; cursor: pointer; border: 1px solid transparent; }
button:focus-visible { outline: 2px solid ${colors.dot}; outline-offset: 2px; }
.btn-cancel { background: ${colors.cancelBg}; color: ${colors.cancelText}; border-color: ${colors.cancelBorder}; }
.btn-confirm { background: ${colors.confirmBg}; color: ${colors.confirmText}; }
</style></head><body><div class="wrap"><div class="header"><div class="logo-tile">
<svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
<circle cx="12" cy="12" r="8" stroke="${colors.ring}" stroke-width="2.4" stroke-linecap="round" stroke-dasharray="38 12" transform="rotate(-90 12 12)" />
<circle cx="12" cy="12" r="2.6" fill="${colors.dot}" /></svg></div><div>
<p class="eyebrow">${escapeConsentHtml(options.title)}</p><h1>${escapeConsentHtml(options.message)}</h1>
</div></div>${fieldsHtml ? `<div class="card">${fieldsHtml}</div>` : ''}<p class="body">${escapeConsentHtml(options.body)}</p>${noteHtml}
<div class="spacer"></div><div class="actions">
<button id="cancel" class="btn-cancel" type="button" autofocus>${escapeConsentHtml(options.cancelLabel)}</button>
<button id="confirm" class="btn-confirm" type="button">${escapeConsentHtml(options.confirmLabel)}</button>
</div></div><script>
document.getElementById('cancel').addEventListener('click', function () { window.location.href = '${cancelUrl}'; });
document.getElementById('confirm').addEventListener('click', function () { window.location.href = '${confirmUrl}'; });
window.addEventListener('keydown', function (event) { if (event.key === 'Escape') { event.preventDefault(); window.location.href = '${cancelUrl}'; } });
</script></body></html>`;
}

function modalWindowClass(): typeof ElectronBrowserWindow | undefined {
  try {
    const candidate = Reflect.get(electron, 'BrowserWindow');
    return typeof candidate === 'function' ? (candidate as typeof ElectronBrowserWindow) : undefined;
  } catch {
    return undefined;
  }
}

export async function restoreParentFocus(parent: ElectronBrowserWindow, timeoutMs = 350): Promise<void> {
  if (parent.isDestroyed() || parent.isFocused()) return;
  if (typeof parent.focus === 'function') parent.focus();
  if (parent.isFocused() || typeof parent.once !== 'function') return;
  await new Promise<void>((resolve) => {
    const done = () => {
      clearTimeout(timer);
      if (typeof parent.off === 'function') parent.off('focus', done);
      resolve();
    };
    const timer = setTimeout(done, timeoutMs);
    parent.once('focus', done);
  });
}

export async function showKlodaConfirmDialog(parent: ElectronBrowserWindow, options: KlodaConfirmOptions): Promise<boolean> {
  const WindowCtor = modalWindowClass();
  if (typeof WindowCtor !== 'function') {
    const fieldLines = (options.fields ?? []).map((f) => `${f.label}: ${f.value}`).join('\n');
    const detail = [fieldLines, options.body, options.note].filter(Boolean).join('\n\n');
    const result = await electron.dialog.showMessageBox(parent, {
      type: options.fallbackType ?? 'question',
      title: options.title,
      message: options.message,
      detail,
      buttons: [options.confirmLabel, options.cancelLabel],
      defaultId: 1,
      cancelId: 1,
      noLink: true,
    });
    return result.response === 0;
  }

  const nonce = randomBytes(16).toString('hex');
  const confirmUrl = `https://kloda-consent.invalid/${nonce}/confirm`;
  const cancelUrl = `https://kloda-consent.invalid/${nonce}/cancel`;
  const dark = options.theme !== 'light';

  return new Promise<boolean>((resolve) => {
    let settled = false;
    const finish = (accepted: boolean, modal?: ElectronBrowserWindow) => {
      if (settled) return;
      settled = true;
      void (async () => {
        if (modal && !modal.isDestroyed()) {
          await new Promise<void>((closed) => {
            const done = () => {
              clearTimeout(timer);
              closed();
            };
            const timer = setTimeout(done, 350);
            modal.once('closed', done);
            modal.close();
          });
        }
        await restoreParentFocus(parent);
        resolve(accepted);
      })();
    };

    const modal = new WindowCtor({
      parent, modal: true, frame: false, resizable: false, minimizable: false, maximizable: false,
      show: false, width: 520, height: 460, useContentSize: true,
      backgroundColor: dark ? '#161412' : '#F7F3EE',
      webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true, devTools: false },
    });

    modal.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    modal.webContents.on('will-navigate', (event, url) => {
      event.preventDefault();
      if (url === confirmUrl) finish(true, modal);
      else if (url === cancelUrl) finish(false, modal);
    });
    modal.once('ready-to-show', () => { if (!modal.isDestroyed()) modal.show(); });
    modal.once('closed', () => finish(false));

    const html = buildConsentHtml(options, nonce);
    void modal.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`).catch(() => finish(false, modal));
  });
}
