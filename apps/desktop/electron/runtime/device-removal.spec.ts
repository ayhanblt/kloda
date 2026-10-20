// @vitest-environment node
import type { BrowserWindow } from 'electron';
import { beforeEach, expect, it, vi } from 'vitest';
import { confirmDeviceRemoval } from './device-removal.js';
const message = vi.hoisted(() => vi.fn());
vi.mock('electron', () => ({ dialog: { showMessageBox: message } }));
const parent = {} as BrowserWindow;
const record = Buffer.alloc(16, 1).toString('base64url');
const fingerprint = Buffer.alloc(32, 3).toString('base64url');
function fixture() {
  let row = { recordId: record, peerFingerprint: fingerprint, trust: 'complete', backupScope: { state: 'approved' } };
  const pairedDevice = vi.fn(async () => JSON.stringify(row));
  const removeDevice = vi.fn(async () => { row = { ...row, trust: 'revoked', backupScope: { state: 'revoked' } }; return '{}'; });
  return { native: { pairedDevice, removeDevice }, check: vi.fn() };
}
beforeEach(() => { vi.resetAllMocks(); message.mockResolvedValue({ response: 1 }); });
it.each(['tr', 'en', 'de'])('confirms in %s with default Cancel and verifies exact durable revoked result', async (language) => {
  const { native, check } = fixture();
  expect(await confirmDeviceRemoval(native, parent, record, language, check)).toMatchObject({ recordId: record, trust: 'revoked' });
  expect(message).toHaveBeenCalledWith(parent, expect.objectContaining({ defaultId: 0, cancelId: 0, detail: expect.stringContaining(fingerprint) }));
  expect(native.removeDevice).toHaveBeenCalledExactlyOnceWith(record);
  expect(native.pairedDevice).toHaveBeenCalledTimes(3);
});
it('does not remove on cancel or unknown locale', async () => {
  const { native, check } = fixture();
  message.mockResolvedValue({ response: 0 });
  await expect(confirmDeviceRemoval(native, parent, record, 'tr', check)).rejects.toThrow('cancelled');
  await expect(confirmDeviceRemoval(native, parent, record, 'unknown', check)).rejects.toThrow('candidate_stale');
  expect(native.removeDevice).not.toHaveBeenCalled();
});
it('does not claim success from the action reply without a revoked trust and ACL read', async () => {
  const { native, check } = fixture();
  native.removeDevice.mockResolvedValue('{}');
  await expect(confirmDeviceRemoval(native, parent, record, 'en', check)).rejects.toThrow('outcome_unknown');
});
it('rejects a substituted device or foreground invalidation before mutation', async () => {
  const { native, check } = fixture();
  native.pairedDevice.mockResolvedValue(JSON.stringify({ recordId: 'wrong', peerFingerprint: fingerprint, trust: 'complete' }));
  await expect(confirmDeviceRemoval(native, parent, record, 'en', check)).rejects.toThrow('candidate_stale');
  const next = fixture(); next.check.mockImplementation(() => { throw Error('candidate_stale'); });
  await expect(confirmDeviceRemoval(next.native, parent, record, 'de', next.check)).rejects.toThrow('candidate_stale');
  expect(next.native.removeDevice).not.toHaveBeenCalled();
});
