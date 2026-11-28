// @vitest-environment node
import { EventEmitter } from 'node:events';
import { expect, it, vi } from 'vitest';
import type { BrowserWindow } from 'electron';
import { resolveDesktopDeviceName } from './device-name.js';

const mockState = vi.hoisted(() => ({
  showMessageBox: vi.fn(),
  windowCtor: undefined as unknown,
}));
vi.mock('electron', () => {
  const mod = {
    app: { getLocale: () => 'tr-TR' },
    dialog: { showMessageBox: mockState.showMessageBox },
  };
  Object.defineProperty(mod, 'BrowserWindow', {
    enumerable: true,
    get: () => mockState.windowCtor,
  });
  return mod;
});

import {
  escapeConsentHtml,
  restoreParentFocus,
  showKlodaConfirmDialog,
} from './consent-dialog.js';
import {
  backupPermissionText,
  normalizeConsentLanguage,
  normalizeConsentTheme,
} from './consent-dialog-copy.js';

it('localizes backup permission copy cleanly for TR, EN, and DE and normalizes defaults', () => {
  expect(normalizeConsentLanguage(undefined)).toBe('tr');
  expect(normalizeConsentLanguage('en')).toBe('en');
  expect(normalizeConsentLanguage('de')).toBe('de');
  expect(normalizeConsentTheme('light')).toBe('light');
  expect(normalizeConsentTheme('unexpected')).toBe('dark');

  const tr = backupPermissionText('tr');
  expect(tr.title).toContain('Kloda');
  expect(tr.confirmButton).toBe('Yedeklemeye izin ver');
  expect(tr.cancelButton).toBe('Vazgeç');
  expect(tr.pickTitle).toContain('klasörünü');

  const de = backupPermissionText('de');
  expect(de.confirmButton).toBe('Sicherung erlauben');

  const en = backupPermissionText('en');
  expect(en.confirmButton).toBe('Allow backup');
});

it('escapes HTML characters strictly and falls back to localized showMessageBox when BrowserWindow is absent', async () => {
  expect(escapeConsentHtml('<script>"a\'&</script>')).toBe('&lt;script&gt;&quot;a&#39;&amp;&lt;/script&gt;');
  mockState.showMessageBox.mockResolvedValueOnce({ response: 0 });
  const tr = backupPermissionText('tr');
  const accepted = await showKlodaConfirmDialog({} as BrowserWindow, {
    title: tr.title,
    message: tr.message,
    fields: [
      { label: tr.fingerprintLabel, value: 'FP-1', mono: true },
      { label: tr.folderLabel, value: 'C:\\Users\\ayhan\\Downloads', mono: true },
    ],
    body: tr.body,
    note: tr.note,
    confirmLabel: tr.confirmButton,
    cancelLabel: tr.cancelButton,
  });
  expect(accepted).toBe(true);
  expect(mockState.showMessageBox).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
    title: tr.title,
    message: tr.message,
    buttons: [tr.confirmButton, tr.cancelButton],
    defaultId: 1,
    cancelId: 1,
  }));
});

it('restoreParentFocus waits for the focus event after sheet/modal dismissal and caps waiting cleanly', async () => {
  let focused = false;
  const parent = Object.assign(new EventEmitter(), {
    isDestroyed: () => false,
    isFocused: () => focused,
    focus: vi.fn(() => {
      setTimeout(() => {
        focused = true;
        parent.emit('focus');
      }, 15);
    }),
  });
  await restoreParentFocus(parent as unknown as BrowserWindow, 300);
  expect(parent.focus).toHaveBeenCalledOnce();
  expect(focused).toBe(true);

  const unfocused = Object.assign(new EventEmitter(), {
    isDestroyed: () => false,
    isFocused: () => false,
    focus: vi.fn(),
  });
  await restoreParentFocus(unfocused as unknown as BrowserWindow, 20);
  expect(unfocused.focus).toHaveBeenCalledOnce();
});

it('modal BrowserWindow intercepts https://kloda-consent.invalid confirm navigation and waits for parent focus', async () => {
  let parentFocused = false;
  const parent = Object.assign(new EventEmitter(), {
    isDestroyed: () => false,
    isFocused: () => parentFocused,
    focus: vi.fn(() => {
      setTimeout(() => {
        parentFocused = true;
        parent.emit('focus');
      }, 10);
    }),
  });

  const closeModal = vi.fn();
  mockState.windowCtor = class MockWindow extends EventEmitter {
    webContents = Object.assign(new EventEmitter(), { setWindowOpenHandler: vi.fn() });
    private destroyed = false;
    isDestroyed = () => this.destroyed;
    show = vi.fn();
    close = () => {
      closeModal();
      this.destroyed = true;
      setTimeout(() => this.emit('closed'), 10);
    };
    loadURL = vi.fn(async (dataUrl: string) => {
      const html = decodeURIComponent(dataUrl.replace('data:text/html;charset=utf-8,', ''));
      const match = /https:\/\/kloda-consent\.invalid\/([a-f0-9]+)\/confirm/.exec(html);
      expect(match).not.toBeNull();
      const preventDefault = vi.fn();
      this.webContents.emit('will-navigate', { preventDefault }, match![0]);
      expect(preventDefault).toHaveBeenCalledOnce();
    });
  };

  try {
    const tr = backupPermissionText('tr');
    const accepted = await showKlodaConfirmDialog(parent as unknown as BrowserWindow, {
      title: tr.title,
      message: tr.message,
      body: tr.body,
      confirmLabel: tr.confirmButton,
      cancelLabel: tr.cancelButton,
    });
    expect(accepted).toBe(true);
    expect(closeModal).toHaveBeenCalledOnce();
    expect(parentFocused).toBe(true);
  } finally {
    mockState.windowCtor = undefined;
  }
});

it('resolves a non-empty desktop device name for native pairing metadata', () => {
  const name = resolveDesktopDeviceName();
  expect(name.trim().length).toBeGreaterThan(0);
});
