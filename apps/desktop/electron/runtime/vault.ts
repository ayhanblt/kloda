import { safeStorage } from 'electron';

import type { DesktopSyncJournal } from './journal.js';

const credentialKey = 'webdavPassword';

export class ElectronCredentialVault {
  constructor(private readonly journal: DesktopSyncJournal) {}

  save(secret: string): void {
    if (!safeStorage.isEncryptionAvailable() || this.usesInsecureLinuxStorage()) {
      throw new Error('System credential storage is unavailable.');
    }
    const encrypted = safeStorage.encryptString(secret).toString('base64');
    this.journal.database.prepare('INSERT OR REPLACE INTO setting (key, value) VALUES (?, ?)').run(credentialKey, encrypted);
  }

  load(): string | null {
    const row = this.journal.database.prepare('SELECT value FROM setting WHERE key = ?').get(credentialKey) as { value: string } | undefined;
    return row ? safeStorage.decryptString(Buffer.from(row.value, 'base64')) : null;
  }

  private usesInsecureLinuxStorage(): boolean {
    return process.platform === 'linux' && safeStorage.getSelectedStorageBackend() === 'basic_text';
  }
}
