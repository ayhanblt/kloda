import { backupDestinations, webDavBackupFromNative } from './backup-destinations';
const mockNative = { configureWebDav: jest.fn(), webDavStatus: jest.fn(), setPcEnabled: jest.fn() };
jest.mock('expo', () => ({ requireOptionalNativeModule: () => mockNative }));
const target = 'A'.repeat(43);
const idle = { configured: true, enabled: true, running: false, targetId: target,
  config: { endpoint: 'https://owned.invalid/dav', targetPath: 'Kloda', username: 'owned' } };
const run = { id: '11111111-1111-4111-8111-111111111111', targetId: target, automatic: false, state: 'finished', attempts: 1, osAttempts: 1,
  counts: { operations: '2', completedOperations: '2', files: '0', completedFiles: '0', photos: '1', completedPhotos: '1' } };
beforeEach(() => jest.clearAllMocks());
it('keeps credentials out of native status and rejects false completion or wrong target', () => {
  expect(webDavBackupFromNative({ ...idle, run }).run?.counts.photos).toBe('1');
  for (const value of [
    { ...idle, config: { ...idle.config, password: 'must-not-cross-status' } },
    { ...idle, run: { ...run, targetId: 'B'.repeat(43) } },
    { ...idle, run: { ...run, counts: { ...run.counts, completedOperations: '1' } } },
    { ...idle, run: { ...run, counts: { ...run.counts, photos: '3' } } },
    { ...idle, run: { ...run, state: 'waiting' } },
    { ...idle, running: true },
    { configured: false, running: false, enabled: true },
  ]) expect(() => webDavBackupFromNative(value)).toThrow('outcome_unknown');
});
it('publishes credentials only through explicit enable and validates PC opt-in separately', async () => {
  mockNative.webDavStatus.mockResolvedValue(idle);
  await backupDestinations.status(); expect(mockNative.configureWebDav).not.toHaveBeenCalled();
  mockNative.configureWebDav.mockResolvedValue(idle);
  await backupDestinations.enable({ ...idle.config, password: 'disposable-fixture' });
  expect(mockNative.configureWebDav).toHaveBeenCalledWith(idle.config.endpoint, 'Kloda', 'owned', 'disposable-fixture');
  mockNative.setPcEnabled.mockResolvedValue({ enabled: true });
  expect(await backupDestinations.setPcEnabled('A'.repeat(22), true)).toBe(true);
  await expect(backupDestinations.setPcEnabled('unverified-record', true)).rejects.toThrow('outcome_unknown');
});
