import type { Dict } from "@/shared/i18n/tr";

export type FieldKey = keyof Dict["conn"]["fields"];
export type Field = {
  key: FieldKey;
  type?: "text" | "secret" | "number" | "select" | "fingerprint";
  placeholder?: string;
  options?: FieldKey[];
};

export type Provider = {
  id: string;
  code: string; // P1..P5, C1..C11
  name: string;
  kind: "protocol" | "cloud";
  target: "folder" | "bucket" | "server";
  /** "form" = protocol-defined credentials; "tbd" = sign-in method not decided (integration point). */
  auth: "form" | "tbd";
  fields: Field[];
  security?: "unknown" | "tls";
};

const folder: Field = { key: "folder", placeholder: "/Kloda" };

export const providers: Provider[] = [
  {
    id: "webdav", code: "P1", name: "WebDAV", kind: "protocol", target: "server", auth: "form", security: "unknown",
    fields: [
      { key: "url", placeholder: "https://nas.local/remote.php/dav" },
      { key: "path", placeholder: "/Yedekler/Telefon" },
      { key: "username", placeholder: "ayhan" },
      { key: "password", type: "secret" },
    ],
  },
  {
    id: "smb", code: "P2", name: "SMB", kind: "protocol", target: "server", auth: "form", security: "unknown",
    fields: [
      { key: "server", placeholder: "192.168.1.20" },
      { key: "share", placeholder: "photos" },
      folder,
      { key: "username", placeholder: "ayhan" },
      { key: "domain", placeholder: "WORKGROUP" },
      { key: "password", type: "secret" },
    ],
  },
  {
    id: "ftp", code: "P3", name: "FTP", kind: "protocol", target: "server", auth: "form", security: "unknown",
    fields: [
      { key: "server", placeholder: "ftp.example.com" },
      { key: "port", type: "number", placeholder: "21" },
      { key: "username", placeholder: "ayhan" },
      { key: "password", type: "secret" },
      folder,
    ],
  },
  {
    id: "sftp", code: "P4", name: "SFTP", kind: "protocol", target: "server", auth: "form", security: "unknown",
    fields: [
      { key: "server", placeholder: "nas.local" },
      { key: "port", type: "number", placeholder: "22" },
      { key: "authMethod", type: "select", options: ["authPassword", "authKey"] },
      { key: "username", placeholder: "ayhan" },
      { key: "hostKey", type: "fingerprint", placeholder: "SHA256:…" },
      folder,
    ],
  },
  {
    id: "s3-compatible", code: "P5", name: "S3 uyumlu / S3 compatible", kind: "protocol", target: "bucket", auth: "form", security: "unknown",
    fields: [
      { key: "endpoint", placeholder: "https://s3.example.com" },
      { key: "accessKey", type: "secret" },
      { key: "secretKey", type: "secret" },
      { key: "region", placeholder: "eu-central-1" },
      { key: "bucket", placeholder: "kloda-backups" },
      { key: "prefix", placeholder: "phone/" },
    ],
  },
  {
    id: "amazon-s3", code: "C1", name: "Amazon S3", kind: "cloud", target: "bucket", auth: "form",
    fields: [
      { key: "accessKey", type: "secret" },
      { key: "secretKey", type: "secret" },
      { key: "region", placeholder: "eu-central-1" },
      { key: "bucket", placeholder: "kloda-backups" },
      { key: "prefix", placeholder: "phone/" },
    ],
  },
  { id: "box", code: "C2", name: "Box", kind: "cloud", target: "folder", auth: "tbd", fields: [folder] },
  { id: "cloudme", code: "C3", name: "CloudMe", kind: "cloud", target: "folder", auth: "tbd", fields: [folder] },
  { id: "dropbox", code: "C4", name: "Dropbox", kind: "cloud", target: "folder", auth: "tbd", fields: [folder] },
  { id: "google-drive", code: "C5", name: "Google Drive", kind: "cloud", target: "folder", auth: "tbd", fields: [folder] },
  {
    id: "google-cloud-storage", code: "C6", name: "Google Cloud Storage", kind: "cloud", target: "bucket", auth: "tbd",
    fields: [{ key: "bucket", placeholder: "kloda-backups" }, { key: "prefix", placeholder: "phone/" }],
  },
  { id: "kolab-now", code: "C7", name: "Kolab Now", kind: "cloud", target: "folder", auth: "tbd", fields: [folder] },
  { id: "mega", code: "C8", name: "MEGA", kind: "cloud", target: "folder", auth: "tbd", fields: [folder] },
  { id: "onedrive", code: "C9", name: "OneDrive", kind: "cloud", target: "folder", auth: "tbd", fields: [folder] },
  {
    id: "nextcloud", code: "C10", name: "Nextcloud", kind: "cloud", target: "server", auth: "tbd",
    fields: [{ key: "serverAddress", placeholder: "https://cloud.example.com" }, folder],
  },
  { id: "yandex-disk", code: "C11", name: "Yandex Disk", kind: "cloud", target: "folder", auth: "tbd", fields: [folder] },
];

export const getProvider = (id: string) => providers.find((p) => p.id === id);

export type Connection = {
  id: string;
  name: string;
  providerId: string | "computer";
  target: string;
  state: "ok" | "offline" | "reauth" | "full" | "paused" | "noAccess";
  lastSync: string;
  usage?: { used: number; total: number; label: string };
  /** Redundancy role: primary target, mirror copy, or standby schedule. */
  role?: "primary" | "mirror" | "standby";
  /** Transfer path note, e.g. "Doğrudan LAN (85 MB/s)". */
  speed?: string;
};

export type ConnFilter = "all" | "online" | "offline" | "attention";
export const connMatch = (f: ConnFilter, s: Connection["state"]) =>
  f === "all" ? true : f === "online" ? s === "ok" : f === "offline" ? s === "offline" || s === "paused" : s === "reauth" || s === "full" || s === "noAccess";

export const connections: Connection[] = [
  { id: "macbook", name: "MacBook-Ayhan", providerId: "computer", target: "/Users/ayhan/Kloda Yedekleri", state: "ok", lastSync: "Az önce", usage: { used: 42, total: 100, label: "3,4 / 8,0 TB" }, role: "primary", speed: "Doğrudan LAN (85 MB/s)" },
  { id: "nas-webdav", name: "Ev NAS", providerId: "webdav", target: "https://nas.local/dav/Yedekler", state: "ok", lastSync: "1 dk önce", usage: { used: 60, total: 100, label: "1,2 / 2,0 TB" }, role: "mirror", speed: "Güvenli mod (LAN)" },
  { id: "drive", name: "Google Drive", providerId: "google-drive", target: "/Kloda", state: "paused", lastSync: "03:00 (gece planı)", role: "standby" },
];
export const getConnection = (id: string) => connections.find((c) => c.id === id);
