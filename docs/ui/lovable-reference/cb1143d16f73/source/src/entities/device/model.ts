export type Device = {
  id: string;
  name: string;
  platform: "iOS" | "Android";
  online: boolean;
  access: "granted" | "none" | "revoked";
  folder: string;
  lastSeen: string;
};

export const devices: Device[] = [
  { id: "iphone", name: "iPhone 15 Pro (Ayhan)", platform: "iOS", online: true, access: "granted", folder: "~/Kloda Yedekleri/iPhone", lastSeen: "Şimdi" },
  { id: "pixel", name: "Pixel 8", platform: "Android", online: false, access: "none", folder: "—", lastSeen: "2 saat önce" },
  { id: "ipad", name: "iPad Air — çok uzun cihaz adı örneği: Ayşe'nin-iPad-Air-5.Nesil-A2588", platform: "iOS", online: false, access: "revoked", folder: "~/Kloda Yedekleri/iPad", lastSeen: "12 gün önce" },
];

export type BackupVersion = { id: string; label: string; items: number; size: string; current?: boolean };
export type DeviceBackup = { deviceId: string; device: string; source: string; versions: BackupVersion[] };

export const backups: DeviceBackup[] = [
  {
    deviceId: "iphone", device: "iPhone 15 Pro (Ayhan)", source: "Photos",
    versions: [
      { id: "v3", label: "28.10.2026 14:06", items: 18240, size: "142 GB", current: true },
      { id: "v2", label: "21.10.2026 22:14", items: 18054, size: "140 GB" },
      { id: "v1", label: "01.09.2026 08:00", items: 16900, size: "128 GB" },
    ],
  },
  {
    deviceId: "pixel", device: "Pixel 8", source: "Photos",
    versions: [{ id: "p1", label: "27.10.2026 19:20", items: 4210, size: "31 GB", current: true }],
  },
];

export const trashItems = [
  { id: "t1", label: "iPhone 15 Pro · Photos · 14.08.2026", deleted: "20.10.2026", days: 22, size: "119 GB" },
  { id: "t2", label: "iPad Air · Files/Belgeler · 02.06.2026", deleted: "05.10.2026", days: 7, size: "2.4 GB" },
];
