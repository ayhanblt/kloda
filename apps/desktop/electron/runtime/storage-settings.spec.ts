// @vitest-environment node
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import { DesktopSyncJournal } from './journal.js';
import { DesktopSyncRuntime } from './runtime.js';
import { ElectronCredentialVault } from './vault.js';

const fixture = vi.hoisted(() => ({ available: true, encrypt: vi.fn(), verify: vi.fn() }));
vi.mock('electron', () => ({ dialog: {}, safeStorage: {
  isEncryptionAvailable: () => fixture.available,
  encryptString: (value: string) => fixture.encrypt(value),
  decryptString: (value: Buffer) => value.toString().replace('fixture-cipher:', ''),
} }));
vi.mock('./webdav.js', () => ({ NodeWebDavClient: class { verifyWriteAccess = fixture.verify; } }));

const oldStorage = { endpoint: 'https://old.fixture.invalid', targetPath: 'old', username: 'old-user', password: 'old-fixture-secret' };
const newStorage = { endpoint: 'https://new.fixture.invalid', targetPath: 'new', username: 'new-user', password: 'new-fixture-secret' };
let directory: string;
let journal: DesktopSyncJournal;
let runtime: DesktopSyncRuntime;
function reopen() {
  journal.database.close();
  journal = new DesktopSyncJournal(join(directory, 'sync.sqlite'));
  runtime = new DesktopSyncRuntime(journal, () => null);
}
function settings() { return journal.database.prepare('SELECT key,value FROM setting ORDER BY key').all(); }
beforeEach(() => {
  vi.resetAllMocks(); fixture.available = true;
  fixture.encrypt.mockImplementation((value: string) => Buffer.from(`fixture-cipher:${value}`));
  directory = mkdtempSync(join(tmpdir(), 'kloda-storage-settings-'));
  journal = new DesktopSyncJournal(join(directory, 'sync.sqlite'));
  runtime = new DesktopSyncRuntime(journal, () => null);
  runtime.saveStorage(oldStorage);
  journal.setStorageTested();
});
afterEach(() => { journal.database.close(); rmSync(directory, { recursive: true, force: true }); });

it('commits the matching target and encrypted secret with invalidated test state across reopen', async () => {
  await runtime.saveStorage(newStorage);
  reopen();
  expect(journal.getDraft()).toMatchObject({ storage: {
    endpoint: newStorage.endpoint, targetPath: newStorage.targetPath, username: newStorage.username,
  }, storageTested: false });
  expect(new ElectronCredentialVault(journal).load()).toBe(newStorage.password);
  expect(settings()).not.toEqual(expect.arrayContaining([expect.objectContaining({ value: newStorage.password })]));
  await runtime.testStorage();
  reopen();
  expect(journal.getDraft().storageTested).toBe(true);
});

it.each(['webdavPassword', 'storage', 'storageTested'])('rolls back all settings when writing %s fails', (key) => {
  const before = settings();
  journal.database.exec(`CREATE TRIGGER reject_setting BEFORE INSERT ON setting WHEN NEW.key='${key}'
    BEGIN SELECT RAISE(ABORT,'fixture-write-failure'); END`);
  expect(() => runtime.saveStorage(newStorage)).toThrow();
  expect(settings()).toEqual(before);
  reopen();
  expect(settings()).toEqual(before);
  expect(new ElectronCredentialVault(journal).load()).toBe(oldStorage.password);
});

it('rolls back all writes when the transaction commit fails', () => {
  const before = settings();
  journal.database.exec(`CREATE TABLE fixture_parent(id INTEGER PRIMARY KEY);
    CREATE TABLE fixture_child(id INTEGER REFERENCES fixture_parent(id) DEFERRABLE INITIALLY DEFERRED);
    CREATE TRIGGER reject_commit AFTER INSERT ON setting WHEN NEW.key='storageTested'
    BEGIN INSERT INTO fixture_child VALUES(1); END`);
  expect(() => runtime.saveStorage(newStorage)).toThrow();
  reopen();
  expect(settings()).toEqual(before);
});

it.each(['unavailable', 'encryption-error'])('preserves the previous state on credential %s', (reason) => {
  const before = settings();
  if (reason === 'unavailable') fixture.available = false;
  else fixture.encrypt.mockImplementation(() => { throw new Error('fixture-encryption-failure'); });
  expect(() => runtime.saveStorage(newStorage)).toThrow();
  reopen();
  expect(settings()).toEqual(before);
});

it('refuses to apply an old connection test to the newly committed settings', async () => {
  let finish!: () => void;
  fixture.verify.mockReturnValueOnce(new Promise<void>((resolve) => { finish = resolve; }));
  const testing = runtime.testStorage();
  await runtime.saveStorage(newStorage);
  finish();
  await expect(testing).rejects.toThrow('Storage settings changed');
  reopen();
  expect(journal.getDraft().storageTested).toBe(false);
  expect(new ElectronCredentialVault(journal).load()).toBe(newStorage.password);
});
