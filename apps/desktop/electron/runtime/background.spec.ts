// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DesktopBackground } from './background.js';

const electron = vi.hoisted(() => {
  const appEvents = new Map<string, (event: { preventDefault(): void }) => void>();
  const handlers = new Map<string, (...args: unknown[]) => unknown>();
  const trays: MockTray[] = [];
  class MockTray {
    events = new Map<string, () => void>();
    menu: { label?: string; click?: () => void }[] = [];
    destroyed = false;
    on = vi.fn((name: string, callback: () => void) => { this.events.set(name, callback); });
    isDestroyed = () => this.destroyed;
    setImage = vi.fn();
    setToolTip = vi.fn();
    setContextMenu = vi.fn((menu: MockTray['menu']) => { this.menu = menu; });
    destroy = vi.fn(() => { this.destroyed = true; });
    constructor() { trays.push(this); }
  }
  const image = { resize: vi.fn(), isEmpty: vi.fn(() => false), toBitmap: () => Buffer.alloc(18 * 18 * 4) };
  image.resize.mockImplementation(() => image);
  const app = {
    on: vi.fn((name: string, callback: (event: { preventDefault(): void }) => void) => { appEvents.set(name, callback); }),
    quit: vi.fn(() => { appEvents.get('before-quit')?.({ preventDefault: vi.fn() }); }),
  };
  return { appEvents, handlers, trays, image, app,
    dialog: { showMessageBox: vi.fn() },
    Menu: { buildFromTemplate: vi.fn((template) => template), setApplicationMenu: vi.fn() },
    nativeImage: { createFromPath: vi.fn(() => image), createFromBitmap: vi.fn(() => image) },
    Tray: MockTray,
    ipcMain: { handle: vi.fn((name: string, callback: (...args: unknown[]) => unknown) => { handlers.set(name, callback); }) },
  };
});

vi.mock('electron', () => electron);

async function settle() { for (let index = 0; index < 15; index += 1) await Promise.resolve(); }

function fixture(platform: NodeJS.Platform = 'win32') {
  const events = new Map<string, (event: { preventDefault(): void }) => void>();
  const mainFrame = { url: 'http://127.0.0.1:5173/' };
  const window = {
    visible: true, focused: true, minimized: false,
    webContents: { mainFrame },
    isDestroyed: () => false,
    isVisible: () => window.visible,
    isFocused: () => window.focused,
    isMinimized: () => window.minimized,
    hide: vi.fn(() => { window.visible = false; }),
    on: vi.fn((name: string, callback: (event: { preventDefault(): void }) => void) => { events.set(name, callback); }),
  };
  const showWindow = vi.fn(() => { window.visible = true; return window; });
  const receiverStatus = vi.fn(async () => ({ available: true, activeTransfers: 0 }));
  const runtime = { getBackgroundState: vi.fn(() => ({ active: false, failed: false })), prepareToQuit: vi.fn() };
  const journal = { getAutostartChoice: vi.fn(() => undefined), saveAutostartChoice: vi.fn() };
  const autostart = { status: vi.fn(() => ({ enabled: false, supported: true })), setEnabled: vi.fn() };
  const closeReceiver = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
  const stopSchedule = vi.fn();
  const background = new DesktopBackground({ showWindow, window: () => window, receiverStatus, runtime,
    journal, autostart, closeReceiver, stopSchedule, iconPath: '/fixture/tray.png', platform } as never);
  background.start();
  background.attach(window as never);
  const event = { sender: window.webContents, senderFrame: mainFrame };
  const close = () => { const preventDefault = vi.fn(); events.get('close')!({ preventDefault }); return preventDefault; };
  return { background, window, showWindow, runtime, journal, autostart, receiverStatus,
    closeReceiver, stopSchedule, event, close };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  electron.appEvents.clear(); electron.handlers.clear(); electron.trays.length = 0;
  electron.image.isEmpty.mockReturnValue(false);
  electron.dialog.showMessageBox.mockResolvedValue({ response: 0 });
  vi.stubEnv('VITE_DEV_SERVER_URL', 'http://127.0.0.1:5173/');
});
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllEnvs(); });

describe('DesktopBackground lifecycle', () => {
  it.each(['win32', 'darwin'] as const)('hides on %s close while retaining receiver and schedule', async (platform) => {
    const fixtureState = fixture(platform);
    await settle();
    expect(fixtureState.close()).toHaveBeenCalled();
    expect(fixtureState.window.visible).toBe(false);
    expect(fixtureState.closeReceiver).not.toHaveBeenCalled();
    expect(fixtureState.stopSchedule).not.toHaveBeenCalled();
  });

  it('keeps Linux visible until actual tray activation or menu reopen proves a control path', async () => {
    const { background, window, close } = fixture('linux');
    await settle();
    close();
    expect(window.visible).toBe(true);
    expect(background.snapshot().environmentLimited).toBe(true);
    electron.trays[0].events.get('click')!();
    close();
    expect(window.visible).toBe(false);
    expect(background.snapshot().environmentLimited).toBe(false);
  });

  it('accepts reopening through the actual Linux tray menu', async () => {
    const { background, close, window } = fixture('linux');
    await settle();
    electron.trays[0].menu.find((item) => item.label === 'Kloda’yı aç')!.click!();
    expect(background.canHide()).toBe(true);
    close(); expect(window.visible).toBe(false);
  });

  it('keeps a visible control and exit path when no tray is available', async () => {
    electron.image.isEmpty.mockReturnValue(true);
    const { background, window, close } = fixture();
    await settle();
    close();
    expect(window.visible).toBe(true);
    expect(background.canHide()).toBe(false);
    expect(electron.Menu.setApplicationMenu).toHaveBeenCalled();
  });

  it('coalesces concurrent quit requests and cancelling leaves work running', async () => {
    const { closeReceiver, stopSchedule, runtime } = fixture();
    let respond!: (value: { response: number }) => void;
    electron.dialog.showMessageBox.mockImplementation(() => new Promise((resolve) => { respond = resolve; }));
    electron.app.quit(); electron.app.quit();
    await settle();
    expect(electron.dialog.showMessageBox).toHaveBeenCalledTimes(1);
    respond({ response: 0 }); await settle();
    expect(closeReceiver).not.toHaveBeenCalled();
    expect(stopSchedule).not.toHaveBeenCalled();
    expect(runtime.prepareToQuit).not.toHaveBeenCalled();
    expect(electron.app.quit).toHaveBeenCalledTimes(2);
  });

  it('warns about active transfer, preserves recovery, then closes before real quit', async () => {
    const { receiverStatus, closeReceiver, runtime, stopSchedule } = fixture();
    await settle();
    receiverStatus.mockResolvedValue({ available: true, activeTransfers: 2 });
    electron.dialog.showMessageBox.mockResolvedValue({ response: 1 });
    const order: string[] = [];
    runtime.prepareToQuit.mockImplementation(() => { order.push('prepare'); });
    let finishClose!: () => void;
    closeReceiver.mockImplementation(() => { order.push('close'); return new Promise<void>((resolve) => { finishClose = resolve; }); });
    electron.app.quit(); await settle();
    expect(electron.dialog.showMessageBox.mock.calls[0][1]).toMatchObject({
      buttons: ['Vazgeç', 'Çık'], cancelId: 0, defaultId: 0,
      detail: expect.stringContaining('Etkin aktarım'),
    });
    expect(stopSchedule).toHaveBeenCalledOnce();
    expect(order).toEqual(['prepare', 'close']);
    expect(electron.app.quit).toHaveBeenCalledOnce();
    expect(electron.trays[0].destroy).not.toHaveBeenCalled();
    finishClose(); await settle();
    expect(electron.app.quit).toHaveBeenCalledTimes(2);
    expect(electron.trays[0].destroy).toHaveBeenCalledOnce();
    // No completion/publication API is available to the lifecycle controller.
    expect(runtime.prepareToQuit).toHaveBeenCalledOnce();
  });

  it('failed receiver shutdown retains a visible window and reports the error', async () => {
    const { background, closeReceiver, window } = fixture();
    closeReceiver.mockRejectedValue(new Error('cannot close'));
    electron.dialog.showMessageBox.mockResolvedValue({ response: 1 });
    electron.app.quit(); await settle();
    expect(electron.app.quit).toHaveBeenCalledOnce();
    expect(window.visible).toBe(true);
    expect(background.snapshot().shutdownError).toBe(true);
    expect(electron.trays[0].destroy).not.toHaveBeenCalled();
  });

  it('marks actual receiver and backup errors and clears the badge after idle recovery', async () => {
    const { background, receiverStatus, runtime } = fixture();
    await settle();
    expect(electron.nativeImage.createFromBitmap).not.toHaveBeenCalled();
    receiverStatus.mockResolvedValue({ available: false, activeTransfers: 0, errorCode: 'storage_failure' } as never);
    await background.refresh();
    expect(electron.nativeImage.createFromBitmap).toHaveBeenCalledOnce();
    expect(electron.trays[0].setToolTip).toHaveBeenLastCalledWith(expect.stringMatching(/^! Kloda/));
    receiverStatus.mockResolvedValue({ available: true, activeTransfers: 0 });
    await background.refresh();
    expect(electron.trays[0].setToolTip).toHaveBeenLastCalledWith(expect.not.stringMatching(/^!/));
    runtime.getBackgroundState.mockReturnValue({ active: false, failed: true });
    await background.refresh();
    expect(electron.nativeImage.createFromBitmap).toHaveBeenCalledTimes(2);
  });

  it('rejects foreign frames and hidden-window setting changes while permitting own status reads', async () => {
    const { window, event, autostart, journal } = fixture();
    const status = electron.handlers.get('kloda:background:status')!;
    const setAutostart = electron.handlers.get('kloda:background:autostart')!;
    await expect(status({ ...event, senderFrame: { url: event.senderFrame.url } })).rejects.toThrow('Untrusted');
    window.visible = false;
    expect(() => setAutostart(event, true)).toThrow('Untrusted');
    expect(autostart.setEnabled).not.toHaveBeenCalled();
    await expect(status(event)).resolves.toMatchObject({ autostart: { enabled: false } });
    window.visible = true;
    expect(() => setAutostart(event, 'true')).toThrow('Invalid');
    setAutostart(event, true);
    expect(autostart.setEnabled).toHaveBeenCalledWith(true);
    expect(journal.saveAutostartChoice).toHaveBeenCalledWith(true);
  });
});
