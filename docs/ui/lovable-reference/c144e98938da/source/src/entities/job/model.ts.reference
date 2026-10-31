export type JobStatus =
  | "syncing"
  | "pending"
  | "paused"
  | "retry"
  | "failed"
  | "review"
  | "conflict"
  | "uncertain"
  | "blocked"
  | "skipped"
  | "done";

export type Job = {
  id: string;
  title: string;
  from: string;
  to: string;
  files: number;
  progress?: number; // real progress only, from transfer engine
  status: JobStatus;
  time: string;
  /** Human-readable transfer size, e.g. "285 / 420 MB". */
  size?: string;
  /** Current transfer speed, shown next to the progress bar. */
  speed?: string;
  /** Why the job is waiting (pending/blocked), shown instead of from → to. */
  reason?: string;
  /** Index into the demo photo set for the thumbnail. */
  photoIndex?: number;
};

export const jobGroup = (s: JobStatus): "active" | "waiting" | "attention" | "completed" =>
  s === "syncing"
    ? "active"
    : s === "pending" || s === "paused" || s === "retry"
      ? "waiting"
      : s === "done"
        ? "completed"
        : "attention";

export const statusTone = {
  syncing: "syncing",
  pending: "pending",
  paused: "pending",
  retry: "syncing",
  failed: "danger",
  review: "review",
  conflict: "review",
  uncertain: "review",
  blocked: "review",
  skipped: "neutral",
  done: "synced",
} as const;

export const mobileJobs: Job[] = [
  { id: "j1", title: "Kamera rulosu", from: "iPhone 15 Pro", to: "Home Synology DS920+", files: 24, progress: 68, status: "syncing", time: "14:06", size: "285 / 420 MB", speed: "14 MB/s", photoIndex: 0 },
  { id: "j2", title: "Albüm: Kapadokya", from: "iPhone 15 Pro", to: "Home Synology DS920+", files: 112, status: "retry", time: "14:01", size: "2,1 GB", reason: "Wi‑Fi bekleniyor", photoIndex: 3 },
  { id: "j3", title: "Belgeler/Faturalar", from: "iPhone 15 Pro", to: "Google Drive", files: 8, status: "blocked", time: "13:40", size: "540 MB", photoIndex: 5 },
  { id: "j4", title: "IMG_2046.HEIC", from: "iPhone 15 Pro", to: "Home Synology DS920+", files: 1, status: "conflict", time: "13:22", size: "3,1 MB", photoIndex: 2 },
  { id: "j5", title: "Screen recordings", from: "iPhone 15 Pro", to: "Home Synology DS920+", files: 3, status: "uncertain", time: "12:58", size: "185 MB", photoIndex: 7 },
  { id: "j6", title: "WhatsApp Images", from: "iPhone 15 Pro", to: "Home Synology DS920+", files: 41, status: "pending", time: "12:30", size: "3,8 MB", reason: "Sırada", photoIndex: 1 },
  { id: "j7", title: "IMG_2031.MOV", from: "iPhone 15 Pro", to: "Home Synology DS920+", files: 1, status: "skipped", time: "11:12", size: "92 MB", photoIndex: 4 },
  { id: "j8", title: "Kamera rulosu", from: "iPhone 15 Pro", to: "Home Synology DS920+", files: 186, status: "done", time: "Dün 22:14", size: "1,9 GB", photoIndex: 6 },
  { id: "j9", title: "Albüm: Aile", from: "iPhone 15 Pro", to: "Google Drive", files: 12, status: "failed", time: "Dün 19:03", size: "540 MB", photoIndex: 8 },
];

export const incomingJobs: Job[] = [
  { id: "i1", title: "Kamera rulosu", from: "iPhone 15 Pro", to: "~/Kloda Yedekleri/iPhone", files: 24, progress: 68, status: "syncing", time: "14:06", size: "285 / 420 MB", speed: "14 MB/s", photoIndex: 0 },
  { id: "i2", title: "DCIM/Camera", from: "Pixel 8", to: "~/Kloda Yedekleri/Pixel", files: 9, status: "paused", time: "13:55", size: "640 MB", photoIndex: 2 },
  { id: "i3", title: "Download/Faturalar", from: "Pixel 8", to: "~/Kloda Yedekleri/Pixel", files: 4, status: "review", time: "13:10", size: "12 MB", photoIndex: 5 },
  { id: "i4", title: "IMG_2046.HEIC", from: "iPhone 15 Pro", to: "~/Kloda Yedekleri/iPhone", files: 1, status: "conflict", time: "13:22", size: "3,1 MB", photoIndex: 2 },
  { id: "i5", title: "Kamera rulosu", from: "iPhone 15 Pro", to: "~/Kloda Yedekleri/iPhone", files: 186, status: "done", time: "Dün 22:14", size: "1,9 GB", photoIndex: 6 },
];

export const outgoingJobs: Job[] = [
  { id: "o1", title: "~/Belgeler", from: "MacBook-Ayhan", to: "Amazon S3 · kloda-backups/docs", files: 320, progress: 31, status: "syncing", time: "14:05", size: "1,2 / 3,8 GB", speed: "8 MB/s", photoIndex: 4 },
  { id: "o2", title: "~/Kloda Yedekleri", from: "MacBook-Ayhan", to: "Ev NAS (SMB)", files: 1840, status: "retry", time: "13:50", size: "12,4 GB", photoIndex: 1 },
  { id: "o3", title: "~/Projeler", from: "MacBook-Ayhan", to: "Nextcloud", files: 56, status: "review", time: "12:00", size: "860 MB", photoIndex: 3 },
  { id: "o4", title: "~/Fotoğraflar/2025", from: "MacBook-Ayhan", to: "FTP · backup.example.com", files: 900, status: "blocked", time: "11:00", size: "6,2 GB", photoIndex: 7 },
  { id: "o5", title: "~/Belgeler", from: "MacBook-Ayhan", to: "Amazon S3", files: 312, status: "done", time: "Dün 02:00", size: "2,4 GB", photoIndex: 5 },
];
