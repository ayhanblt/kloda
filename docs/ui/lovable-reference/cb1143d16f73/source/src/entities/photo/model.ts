import p1 from "@/assets/demo-1.jpg";
import p2 from "@/assets/demo-2.jpg";
import p3 from "@/assets/demo-3.jpg";
import p4 from "@/assets/demo-4.jpg";
import p5 from "@/assets/demo-5.jpg";
import p6 from "@/assets/demo-6.jpg";

export type PhotoStatus = "synced" | "syncing" | "pending" | "failed";
export type Photo = {
  id: string;
  src: string;
  name: string;
  size: string;
  taken: string;
  camera: string;
  status: PhotoStatus;
  group: "today" | "lastWeek";
  video?: boolean;
  favorite?: boolean;
  destinations: { connId: string; status: "synced" | "syncing" | "pending" | "failed" | "uncertain" }[];
};

const srcs: string[] = [p1, p2, p3, p4, p5, p6];
const statuses: PhotoStatus[] = ["synced", "synced", "syncing", "pending", "synced", "failed"];

export const photos: Photo[] = Array.from({ length: 12 }, (_, i) => ({
  id: `img-${i + 1}`,
  src: srcs[i % 6]!,
  name: `IMG_20${41 + i}.HEIC`,
  size: `${(2.1 + (i % 5) * 0.7).toFixed(1)} MB`,
  taken: i < 6 ? "28.10.2026 14:0" + (i % 10) : "21.10.2026 09:1" + (i % 10),
  camera: "iPhone 15 Pro · 24 mm · f/1.8",
  status: statuses[i % 6]!,
  group: i < 6 ? "today" : "lastWeek",
  video: i % 5 === 1,
  favorite: i % 4 === 1,
  destinations: [
    { connId: "macbook", status: statuses[i % 6] === "failed" ? "failed" : statuses[i % 6]! },
    { connId: "nas-webdav", status: i % 4 === 3 ? "uncertain" : "synced" },
  ],
}));
