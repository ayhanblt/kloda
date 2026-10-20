// @vitest-environment node
import type { BrowserWindow } from 'electron';
import { beforeEach, expect, it, vi } from 'vitest';
import { confirmBackupMutation } from './backup-management.js';
import type { NativePairingOwner } from './native-pairing-owner.js';
const dialog = vi.hoisted(() => vi.fn());
vi.mock('electron', () => ({ dialog: { showMessageBox: dialog } }));
const parent = {} as BrowserWindow;
const id = (value: number) => Buffer.alloc(16, value).toString('base64url');
function fixture() {
  const run = vi.fn(async (value: string) => JSON.stringify({ items: (JSON.parse(value) as string[]).map((id) => ({ id, success: true })) }));
  const native = { trashBackups: run, restoreBackups: run } as unknown as NativePairingOwner;
  return { run, native, check: vi.fn() };
}
beforeEach(() => { vi.resetAllMocks(); dialog.mockResolvedValue({ response: 1 }); });
it.each(['tr', 'en', 'de'])('requires localized default-Cancel confirmation in %s and returns per-item durable results', async (language) => {
  const { native, check, run } = fixture();
  expect(await confirmBackupMutation(native, parent, [id(1)], language, true, check)).toEqual({ items: [{ id: id(1), success: true }] });
  expect(dialog).toHaveBeenCalledWith(parent, expect.objectContaining({ defaultId: 0, cancelId: 0, detail: expect.stringContaining('30') }));
  expect(run).toHaveBeenCalledExactlyOnceWith(JSON.stringify([id(1)]));
});
it('cancels without mutating and rejects malformed selection before confirmation', async () => {
  const { native, check, run } = fixture();
  for (const selection of [[], [id(1), id(1)], ['../outside'], null]) {
    await expect(confirmBackupMutation(native, parent, selection, 'tr', true, check)).rejects.toThrow('candidate_stale');
  }
  expect(dialog).not.toHaveBeenCalled();
  dialog.mockResolvedValue({ response: 0 });
  await expect(confirmBackupMutation(native, parent, [id(1)], 'tr', true, check)).rejects.toThrow('cancelled');
  expect(run).not.toHaveBeenCalled();
});
it('confirms a cross-page selection once and applies bounded batches without optimistic all-success', async () => {
  const { native, check, run } = fixture();
  const ids = Array.from({ length: 65 }, (_, i) => id(i));
  const result = await confirmBackupMutation(native, parent, ids, 'en', false, check) as { items: unknown[] };
  expect(result.items).toHaveLength(65);
  expect(dialog).toHaveBeenCalledOnce();
  expect(run.mock.calls.map(([input]) => (JSON.parse(input) as unknown[]).length)).toEqual([32, 32, 1]);
});
it('retains item failures and refuses missing, duplicate or substituted native results', async () => {
  const { native, check, run } = fixture();
  run.mockResolvedValueOnce(JSON.stringify({ items: [{ id: id(1), success: false, errorCode: 'conflict' }] }));
  expect(await confirmBackupMutation(native, parent, [id(1)], 'de', false, check)).toMatchObject({ items: [{ success: false, errorCode: 'conflict' }] });
  for (const result of [{ items: [] }, { items: [{ id: id(2), success: true }] }, { items: [{ id: id(1), success: false }] }]) {
    run.mockResolvedValueOnce(JSON.stringify(result));
    await expect(confirmBackupMutation(native, parent, [id(1)], 'en', true, check)).rejects.toThrow('outcome_unknown');
  }
});
it('stops later batches after foreground loss without claiming partial work was all successful', async () => {
  const { native, check, run } = fixture();
  let available = true;
  check.mockImplementation(() => { if (!available) throw Error('candidate_stale'); });
  run.mockImplementationOnce(async (input) => {
    available = false;
    return JSON.stringify({ items: (JSON.parse(input) as string[]).map((id) => ({ id, success: true })) });
  });
  await expect(confirmBackupMutation(native, parent, Array.from({ length: 33 }, (_, i) => id(i)), 'en', true, check)).rejects.toThrow('candidate_stale');
  expect(run).toHaveBeenCalledOnce();
});
