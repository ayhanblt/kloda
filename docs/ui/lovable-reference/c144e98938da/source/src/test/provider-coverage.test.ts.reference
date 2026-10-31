import { describe, expect, it } from "vitest";
import { providers } from "@/entities/connection/model";

describe("Original multi-destination brief", () => {
  it("keeps all five file protocols", () => {
    expect(providers.filter(p => p.kind === "protocol").map(p => p.id)).toEqual(["webdav", "smb", "ftp", "sftp", "s3-compatible"]);
  });
  it("keeps all eleven cloud services", () => {
    expect(providers.filter(p => p.kind === "cloud").map(p => p.id)).toEqual(["amazon-s3", "box", "cloudme", "dropbox", "google-drive", "google-cloud-storage", "kolab-now", "mega", "onedrive", "nextcloud", "yandex-disk"]);
  });
  it("keeps Amazon S3 distinct from generic S3", () => {
    expect(providers.find(p => p.id === "amazon-s3")?.code).toBe("C1");
    expect(providers.find(p => p.id === "s3-compatible")?.code).toBe("P5");
  });
  it("does not invent cloud sign-in for undecided services", () => {
    expect(providers.filter(p => p.kind === "cloud" && p.id !== "amazon-s3").every(p => p.auth === "tbd")).toBe(true);
  });
});