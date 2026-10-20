import { dialog, type BrowserWindow } from 'electron';

interface RemovalOwner {
  pairedDevice(record: string): Promise<string>;
  removeDevice(record: string): Promise<string>;
}
const messages = {
  tr: { title: 'Cihazı kaldır', cancel: 'Vazgeç', confirm: 'Cihazı kaldır',
    message: 'Bu cihazın bu bilgisayardaki güvenini ve dosya erişimini kaldırmak istiyor musunuz?',
    detail: 'Telefonun çevrimiçi olması gerekmez. Devam eden aktarım durdurulur. Tamamlanmış yedekler korunur; telefondaki kayıt veya dosyalar silinmez. Yeniden bağlanmak için yeni QR eşleştirmesi ve ayrı dosya erişim onayı gerekir.' },
  en: { title: 'Remove device', cancel: 'Cancel', confirm: 'Remove device',
    message: 'Remove this device’s trust and file access on this computer?',
    detail: 'The phone does not need to be online. Its active transfer will stop. Completed backups are retained; no records or files are removed from the phone. Reconnecting requires fresh QR pairing and separate file access approval.' },
  de: { title: 'Gerät entfernen', cancel: 'Abbrechen', confirm: 'Gerät entfernen',
    message: 'Vertrauen und Dateizugriff dieses Geräts auf diesem Computer entfernen?',
    detail: 'Das Telefon muss nicht online sein. Seine laufende Übertragung wird gestoppt. Fertige Sicherungen bleiben erhalten; auf dem Telefon werden keine Einträge oder Dateien gelöscht. Erneutes Verbinden erfordert eine neue QR-Kopplung und eine separate Dateizugriffsgenehmigung.' },
};
async function read(native: RemovalOwner, record: string) {
  const row = JSON.parse(await native.pairedDevice(record)) as { recordId?: unknown; peerFingerprint?: unknown; trust?: unknown; backupScope?: { state?: unknown } };
  if (row.recordId !== record || typeof row.peerFingerprint !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(row.peerFingerprint) ||
    !['complete', 'consumed_pending_ack', 'revoked'].includes(String(row.trust))) throw new Error('candidate_stale');
  return row;
}
export async function confirmDeviceRemoval(native: RemovalOwner, parent: BrowserWindow, record: string, language: unknown, check: () => void) {
  if (language !== 'tr' && language !== 'en' && language !== 'de') throw new Error('candidate_stale');
  const observed = await read(native, record);
  check();
  const text = messages[language];
  const result = await dialog.showMessageBox(parent, { type: 'warning', title: text.title, message: text.message,
    detail: `${observed.peerFingerprint}\n\n${text.detail}`, buttons: [text.cancel, text.confirm], defaultId: 0, cancelId: 0, noLink: true });
  check();
  if (result.response !== 1) throw new Error('cancelled');
  const current = await read(native, record);
  check();
  if (current.peerFingerprint !== observed.peerFingerprint) throw new Error('candidate_stale');
  await native.removeDevice(record);
  const removed = await read(native, record);
  check();
  if (removed.trust !== 'revoked' || removed.peerFingerprint !== observed.peerFingerprint ||
    !['revoked', 'not_approved'].includes(String(removed.backupScope?.state))) throw new Error('outcome_unknown');
  return removed;
}
