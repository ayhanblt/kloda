import { createFileRoute } from "@tanstack/react-router";
import { MobileActivity } from "@/views/mobile/activity-backups-settings";

export const Route = createFileRoute("/m/activity")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "M11 Aktivite — Kloda" },
      { name: "description", content: "Kloda prototipi: M11 Aktivite." },
      { property: "og:title", content: "M11 Aktivite — Kloda" },
      { property: "og:description", content: "Kloda prototipi: M11 Aktivite." },
    ],
  }),
  component: MobileActivity,
});
