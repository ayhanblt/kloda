// @vitest-environment node
import { beforeEach, expect, it, vi } from 'vitest';

import type { BrowserWindow, IpcMainInvokeEvent } from 'electron';
import type { DesktopSyncRuntime } from './runtime.js';
import { registerWebDavHandlers } from './webdav-ipc.js';

type Handler = (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown;
const fixture = vi.hoisted(() => ({ handlers: new Map<string, Handler>(), dialog: vi.fn() }));
vi.mock('electron', () => ({ ipcMain: { handle: (name: string, callback: Handler) => fixture.handlers.set(name, callback) },
  dialog: { showMessageBox: fixture.dialog } }));
const id = 'a'.repeat(43);
let state: { visible: boolean; focused: boolean; minimized: boolean; destroyed: boolean };
let parent: BrowserWindow;
let event: IpcMainInvokeEvent;
let issues: ReturnType<typeof vi.fn>;
let review: ReturnType<typeof vi.fn>;
beforeEach(() => {
  fixture.handlers.clear(); vi.resetAllMocks();
  state = { visible: true, focused: true, minimized: false, destroyed: false };
  const mainFrame = { url: new URL('../../renderer/index.html', import.meta.url).href };
  const webContents = { mainFrame };
  parent = { webContents, isDestroyed: () => state.destroyed, isVisible: () => state.visible,
    isFocused: () => state.focused, isMinimized: () => state.minimized } as unknown as BrowserWindow;
  event = { sender: webContents, senderFrame: mainFrame } as unknown as IpcMainInvokeEvent;
  issues = vi.fn().mockResolvedValue([{ id, relativePath: 'foto.jpg', canKeepBoth: true }]);
  review = vi.fn(async (_id: string, _action: string, check: () => void) => { check(); });
  fixture.dialog.mockResolvedValue({ response: 0 });
  registerWebDavHandlers({ getWebDavIssues: issues, reviewWebDavIssue: review } as unknown as DesktopSyncRuntime, () => parent);
});
const request = (action: unknown = 'recheck', language: unknown = 'tr', requestId: unknown = id, sender = event) =>
  fixture.handlers.get('kloda:webdav:review')!(sender, requestId, action, language);

it.each(['sender', 'subframe', 'destroyed'])('rejects %s mismatches for reads and mutations', async mode => {
  const foreign = { ...event };
  if (mode === 'sender') Object.assign(foreign, { sender: {} });
  if (mode === 'subframe') Object.assign(foreign, { senderFrame: {} });
  if (mode === 'destroyed') state.destroyed = true;
  expect(() => fixture.handlers.get('kloda:webdav:issues')!(foreign)).toThrow('Untrusted');
  await expect(request('skip', 'tr', id, foreign)).rejects.toThrow('Untrusted');
  expect(issues).not.toHaveBeenCalled(); expect(review).not.toHaveBeenCalled();
});

it.each(['hidden', 'unfocused', 'minimized'])('denies %s management but allows trusted read-only history', async mode => {
  if (mode === 'hidden') state.visible = false;
  if (mode === 'unfocused') state.focused = false;
  if (mode === 'minimized') state.minimized = true;
  await expect(fixture.handlers.get('kloda:webdav:issues')!(event)).resolves.toHaveLength(1);
  await expect(request()).rejects.toThrow('Visible active window');
  expect(review).not.toHaveBeenCalled();
});

it.each([
  ['invalid', 'recheck', 'tr'], [12, 'recheck', 'tr'], [id, 'delete', 'tr'], [id, 'skip', 'fr'], [id, 'recheck', null],
])('validates id/action/language %s %s %s before action', async (requestId, action, language) => {
  await expect(request(action, language, requestId)).rejects.toThrow('Invalid');
  expect(issues).not.toHaveBeenCalled(); expect(review).not.toHaveBeenCalled(); expect(fixture.dialog).not.toHaveBeenCalled();
});

it.each(['tr', 'en', 'de'])('uses default-cancel confirmation in %s and performs no action when canceled', async language => {
  await request('keep_both', language);
  expect(fixture.dialog).toHaveBeenCalledWith(parent, expect.objectContaining({ defaultId: 0, cancelId: 0, noLink: true }));
  expect(review).not.toHaveBeenCalled();
});

it('requires a current verified conflict before presenting keep-both confirmation', async () => {
  issues.mockResolvedValue([{ id, canKeepBoth: false }]);
  await expect(request('keep_both')).rejects.toThrow('Verified conflict');
  expect(fixture.dialog).not.toHaveBeenCalled(); expect(review).not.toHaveBeenCalled();
});

it('rechecks foreground after the confirmation and on every supplied action fence', async () => {
  fixture.dialog.mockImplementationOnce(async () => { state.visible = false; return { response: 1 }; });
  await expect(request('keep_both')).rejects.toThrow('Visible active');
  expect(review).not.toHaveBeenCalled();
  state.visible = true; fixture.dialog.mockResolvedValue({ response: 1 });
  await request('keep_both');
  expect(review).toHaveBeenCalledWith(id, 'keep_both', expect.any(Function));
  const check = review.mock.calls[0][2];
  state.focused = false;
  expect(check).toThrow('Visible active');
});

it.each(['skip', 'recheck'])('passes foreground fences for explicit %s without a keep-both dialog', async action => {
  await request(action);
  expect(review).toHaveBeenCalledWith(id, action, expect.any(Function));
  expect(fixture.dialog).not.toHaveBeenCalled();
});

it.each(['https://foreign.invalid/', 'file:///unapproved.html',
  new URL('../../renderer/index.html?foreign=1', import.meta.url).href])('rejects foreign main-frame URL %s for reads and mutations', async url => {
  Object.assign(event.senderFrame!, { url });
  expect(() => fixture.handlers.get('kloda:webdav:issues')!(event)).toThrow('Untrusted');
  await expect(request('skip')).rejects.toThrow('Untrusted');
  expect(issues).not.toHaveBeenCalled(); expect(review).not.toHaveBeenCalled();
});

it('rejects navigation to a foreign main-frame URL during confirmation and later action fences', async () => {
  const original = event.senderFrame!.url;
  fixture.dialog.mockImplementationOnce(async () => {
    Object.assign(event.senderFrame!, { url: 'https://foreign.invalid/' }); return { response: 1 };
  });
  await expect(request('keep_both')).rejects.toThrow('Untrusted');
  expect(review).not.toHaveBeenCalled();
  Object.assign(event.senderFrame!, { url: original });
  await request('recheck');
  const check = review.mock.calls[0][2];
  Object.assign(event.senderFrame!, { url: 'https://foreign.invalid/' });
  expect(check).toThrow('Untrusted');
});
