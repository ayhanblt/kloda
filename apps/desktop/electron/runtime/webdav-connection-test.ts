import { nextAccessRetry } from '@kloda/sync-core';
import type { DesktopSyncJournal } from './journal.js';
import { failureCode, WebDavFailure } from './webdav-errors.js';

// Connection tests have their own persisted attempt, not a mobile OS retry budget.
export async function testConnection(journal: DesktopSyncJournal, contextId: string, verify: () => Promise<void>,
  check: () => void, wait: (deadline: number) => Promise<void>): Promise<void> {
  const key = 'webdavTestRetry';
  const raw = journal.database.prepare('SELECT value FROM setting WHERE key=?').get(key) as { value: string } | undefined;
  let state: { contextId: string; attempts: number; retryAt?: number; finished?: boolean } = raw ? JSON.parse(raw.value) : { contextId, attempts: 0 };
  if (!state || typeof state !== 'object' || typeof state.contextId !== 'string' ||
    (state.finished !== undefined && typeof state.finished !== 'boolean') || !Number.isInteger(state.attempts) || state.attempts < 0 || state.attempts > 5 ||
    (state.retryAt !== undefined && (!Number.isSafeInteger(state.retryAt) || state.retryAt < 0))) throw new Error('Invalid connection retry state.');
  if (state.contextId !== contextId || state.finished === true) state = { contextId, attempts: 0 };
  const save = () => journal.database.prepare('INSERT OR REPLACE INTO setting(key,value) VALUES(?,?)').run(key, JSON.stringify(state));
  for (;;) {
    check();
    if (state.retryAt) await wait(state.retryAt);
    check();
    if (state.attempts >= 5) { state.finished = true; save(); throw new WebDavFailure('retry_exhausted'); }
    state.attempts += 1; delete state.retryAt; save();
    try {
      await verify(); check();
      journal.database.transaction(() => {
        check(); journal.setStorageTested(); journal.database.prepare('DELETE FROM setting WHERE key=?').run(key);
      })();
      return;
    } catch (error) {
      check();
      const next = nextAccessRetry(new Date(), state.attempts);
      if (failureCode(error) !== 'connection_unavailable' || next.exhausted) {
        state.finished = true; save(); throw error;
      }
      state.retryAt = next.retryAt!.getTime(); save();
    }
  }
}
