import * as electron from 'electron';

export type ConsentLanguage = 'tr' | 'en' | 'de';
export type ConsentTheme = 'dark' | 'light';

export function normalizeConsentLanguage(value: unknown): ConsentLanguage {
  if (value === 'tr' || value === 'en' || value === 'de') return value;
  let locale = '';
  try {
    const appRef = Reflect.get(electron, 'app') as { getLocale?: () => string } | undefined;
    if (typeof appRef?.getLocale === 'function') locale = appRef.getLocale().toLowerCase();
  } catch {
    locale = '';
  }
  if (locale.startsWith('tr')) return 'tr';
  if (locale.startsWith('de')) return 'de';
  return 'en';
}

export function normalizeConsentTheme(value: unknown): ConsentTheme {
  return value === 'light' ? 'light' : 'dark';
}

export function backupPermissionText(language: ConsentLanguage) {
  if (language === 'tr') {
    return {
      pickTitle: 'Bu cihazın bilgisayar yedekleme klasörünü seçin',
      pickButton: 'Klasör seç',
      title: 'Kloda — Yedekleme izni',
      message: 'Eşleşen bu cihazın seçili dosya ve fotoğrafları yedeklemesine izin verilsin mi?',
      deviceLabel: 'Cihaz',
      fingerprintLabel: 'Cihaz parmak izi',
      folderLabel: 'Klasör',
      body: 'Seçili dosya ve fotoğrafları yalnızca kendi yedeğine yükler; başka cihazlara erişemez ve silme yapamaz.',
      note: 'Onaylamak, telefonun şu an bu bilgisayara bağlı olduğu anlamına gelmez.',
      confirmButton: 'Yedeklemeye izin ver',
      cancelButton: 'Vazgeç',
    };
  }
  if (language === 'de') {
    return {
      pickTitle: 'Sicherungsordner dieses Geräts auf dem Computer wählen',
      pickButton: 'Ordner wählen',
      title: 'Kloda — Sicherungsberechtigung',
      message: 'Diesem gekoppelten Gerät erlauben, ausgewählte Dateien und Fotos zu sichern?',
      deviceLabel: 'Gerät',
      fingerprintLabel: 'Geräte-Fingerabdruck',
      folderLabel: 'Ordner',
      body: 'Lädt ausgewählte Dateien und Fotos nur in die eigene Sicherung dieses Geräts; kein Löschen und kein Zugriff auf andere Geräte.',
      note: 'Diese Erlaubnis bestätigt nicht, dass das Telefon diesen Computer gerade erreichen kann.',
      confirmButton: 'Sicherung erlauben',
      cancelButton: 'Abbrechen',
    };
  }
  return {
    pickTitle: 'Select this device’s PC backup folder',
    pickButton: 'Select folder',
    title: 'Kloda — backup permission',
    message: 'Allow this paired device to back up selected files and photos?',
    deviceLabel: 'Device',
    fingerprintLabel: 'Device fingerprint',
    folderLabel: 'Folder',
    body: 'Upload selected files and photos only to this device’s own backup. No deletion, other-device access or two-way sync.',
    note: 'Permission does not confirm a completed transfer or that the phone can reach this PC.',
    confirmButton: 'Allow backup',
    cancelButton: 'Cancel',
  };
}
