import { createFileRoute } from "@tanstack/react-router";
import { DesktopBackups } from "@/views/desktop/receiver";

export const Route = createFileRoute("/d/backups")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "D6 Yedekler — Kloda" },
      { name: "description", content: "Kloda prototipi: D6 Yedekler." },
      { property: "og:title", content: "D6 Yedekler — Kloda" },
      { property: "og:description", content: "Kloda prototipi: D6 Yedekler." },
    ],
  }),
  component: DesktopBackups,
});
