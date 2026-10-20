import { dialog, type BrowserWindow } from 'electron';
import type { NativePairingOwner } from './native-pairing-owner.js';

const text = {
  tr: { cancel: 'Vazgeç', trash: 'Bu yedek sürümünü sil', restore: 'Seçilen sürümleri geri al',
    trashDetail: 'Yalnız seçilen yedek sürümleri Kloda çöp kutusuna taşınır ve silme tamamlandıktan sonra 30 gün geri alınabilir. Süre sonunda kalıcı temizlik otomatik yapılır; Kloda kapalıysa sonraki çalışmada yapılır. Diğer sürümler ve korunması gereken ortak medya tutulur. Telefonda bulunan orijinaller silinmez. Değişmemiş kaynak otomatik yeniden yüklenmez; yeniden yedekleme açık kullanıcı isteği gerektirir.',
    restoreDetail: 'Seçilen sürümler eski hedeflerine geri alınır. Başka dosyanın üzerine yazılmaz; çakışma veya doğrulama sorunu varsa o sürüm geri alınmış sayılmaz. Telefonda değişiklik yapılmaz.' },
  en: { cancel: 'Cancel', trash: 'Delete this backup version', restore: 'Restore selected versions',
    trashDetail: 'Only selected backup versions move to Kloda trash and remain recoverable for 30 days after deletion completes. Permanent cleanup runs automatically when due, or the next time Kloda runs if it was closed. Other versions and shared media still needed for preservation are retained. Phone originals are untouched. An unchanged source is not uploaded again automatically; rebackup requires an explicit user request.',
    restoreDetail: 'Selected versions return to their former targets. Other files are never overwritten. A conflict or verification failure means that version was not restored. Nothing changes on the phone.' },
  de: { cancel: 'Abbrechen', trash: 'Diese Sicherungsversion löschen', restore: 'Ausgewählte Versionen wiederherstellen',
    trashDetail: 'Nur ausgewählte Sicherungsversionen werden in den Kloda-Papierkorb verschoben und bleiben nach abgeschlossener Löschung 30 Tage wiederherstellbar. Danach erfolgt die endgültige Bereinigung automatisch, bei geschlossener App beim nächsten Start. Andere Versionen und weiterhin benötigte gemeinsame Medien bleiben erhalten. Originale auf dem Telefon bleiben unverändert. Unveränderte Quellen werden nicht automatisch erneut hochgeladen; eine erneute Sicherung erfordert einen ausdrücklichen Benutzerauftrag.',
    restoreDetail: 'Ausgewählte Versionen werden am bisherigen Ziel wiederhergestellt. Andere Dateien werden nie überschrieben. Bei Konflikten oder fehlgeschlagener Prüfung gilt die Version nicht als wiederhergestellt. Auf dem Telefon ändert sich nichts.' },
};
export async function confirmBackupMutation(
  native: NativePairingOwner, parent: BrowserWindow, input: unknown, language: unknown, trash: boolean, check: () => void,
): Promise<unknown> {
  if (language !== 'tr' && language !== 'en' && language !== 'de') throw new Error('candidate_stale');
  if (!Array.isArray(input) || input.length === 0 || input.length > 4096 ||
    input.some((id) => typeof id !== 'string' || !/^[A-Za-z0-9_-]{22}$/.test(id)) || new Set(input).size !== input.length) throw new Error('candidate_stale');
  const ids = input as string[];
  const message = text[language];
  check();
  const choice = await dialog.showMessageBox(parent, { type: 'warning', title: trash ? message.trash : message.restore,
    message: trash ? message.trash : message.restore,
    detail: `${trash ? message.trashDetail : message.restoreDetail}\n\n${ids.length}\n${ids.slice(0, 8).join('\n')}${ids.length > 8 ? '\n…' : ''}`,
    buttons: [message.cancel, trash ? message.trash : message.restore], defaultId: 0, cancelId: 0, noLink: true });
  check();
  if (choice.response !== 1) throw new Error('cancelled');
  const items: unknown[] = [];
  for (let offset = 0; offset < ids.length; offset += 32) {
    check();
    const batch = ids.slice(offset, offset + 32);
    const value: unknown = JSON.parse(await (trash ? native.trashBackups(JSON.stringify(batch)) : native.restoreBackups(JSON.stringify(batch))));
    check();
    if (!value || typeof value !== 'object' || !('items' in value) || !Array.isArray(value.items) || value.items.length !== batch.length) throw new Error('outcome_unknown');
    const seen = new Set<string>();
    for (const row of value.items as unknown[]) {
      if (!row || typeof row !== 'object' || !('id' in row) || typeof row.id !== 'string' || !batch.includes(row.id) || seen.has(row.id) ||
        !('success' in row) || typeof row.success !== 'boolean' || (!row.success && (!('errorCode' in row) || typeof row.errorCode !== 'string'))) throw new Error('outcome_unknown');
      seen.add(row.id);
    }
    items.push(...value.items);
  }
  return { items };
}
