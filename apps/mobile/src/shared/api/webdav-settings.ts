import * as SecureStore from 'expo-secure-store';
import { backupDestinations, type WebDavBackupStatus } from './backup-destinations';
import { testWebDavWriteAccess, validateWebDavForm, type MobileStorageForm } from './webdav';

const key = 'kloda.webdav.profile.v1';
const options = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };
interface Profile { version: 1; storage: MobileStorageForm; testedAt: string | null; probeWarning?: boolean }
export interface WebDavSettings { config: Omit<MobileStorageForm, 'password'>; testedAt: string | null; probeWarning?: boolean }
let busy = false;

async function read(): Promise<Profile | null> {
  try {
    const raw = await SecureStore.getItemAsync(key, options);
    if (raw === null) return null;
    const value = JSON.parse(raw) as Profile;
    if (!value || value.version !== 1 || !value.storage || !['storage,testedAt,version', 'probeWarning,storage,testedAt,version'].includes(Object.keys(value).sort().join())
      || (value.probeWarning !== undefined && typeof value.probeWarning !== 'boolean')
      || Object.keys(value.storage).sort().join() !== 'endpoint,password,targetPath,username'
      || (value.testedAt !== null && (typeof value.testedAt !== 'string' || new Date(value.testedAt).toISOString() !== value.testedAt))) throw new Error();
    validateWebDavForm(value.storage);
    return value;
  } catch { throw new Error('webdav_storage'); }
}
function metadata(value: Profile): WebDavSettings {
  const { endpoint, targetPath, username } = value.storage;
  return { config: { endpoint, targetPath, username }, testedAt: value.testedAt, ...(value.probeWarning !== undefined ? { probeWarning: value.probeWarning } : {}) };
}
async function write(value: Profile): Promise<void> {
  const raw = JSON.stringify(value);
  try {
    await SecureStore.setItemAsync(key, raw, options);
    if (await SecureStore.getItemAsync(key, options) !== raw) throw new Error();
  } catch { throw new Error('webdav_storage'); }
}
export async function loadWebDavSettings(): Promise<WebDavSettings | null> {
  const value = await read(); return value ? metadata(value) : null;
}
export async function testAndSaveWebDavSettings(storage: MobileStorageForm, current: () => boolean, signal?: AbortSignal): Promise<WebDavSettings> {
  if (busy) throw new Error('webdav_busy');
  const snapshot = { ...storage }; validateWebDavForm(snapshot);
  const check = () => { if (!current() || signal?.aborted) throw new Error('webdav_cancelled'); };
  busy = true;
  try {
    check(); const previous = await read(); check();
    // Invalidate past success before retesting, without mixing in the new draft or its password.
    if (previous?.testedAt) { await write({ ...previous, testedAt: null }); check(); }
    await testWebDavWriteAccess(snapshot, signal, async () => {
      check();
      // A crash after this point must retain uncertainty; no remote cleanup is inferred.
      await write({ ...(previous ?? { version: 1, storage: snapshot }), testedAt: null, probeWarning: true });
      check();
    }); check();
    const profile: Profile = { version: 1, storage: snapshot, testedAt: new Date().toISOString(), probeWarning: previous?.probeWarning === true };
    // A saved replacement cannot silently keep the previous native destination active.
    await backupDestinations.disable(); check();
    await write(profile); check();
    return metadata(profile);
  } finally { busy = false; }
}

export async function enableSavedWebDavBackup(current: () => boolean): Promise<WebDavBackupStatus> {
  if (busy) throw new Error('webdav_busy');
  busy = true;
  try {
    if (!current()) throw new Error('webdav_cancelled');
    const profile = await read();
    if (!current()) throw new Error('webdav_cancelled');
    if (!profile?.testedAt) throw new Error('webdav_test_required');
    return await backupDestinations.enable(profile.storage);
  } finally { busy = false; }
}
