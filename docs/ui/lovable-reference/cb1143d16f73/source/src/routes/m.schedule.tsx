import { createFileRoute } from "@tanstack/react-router";
import { MobileSchedule } from "@/views/mobile/onboarding";

export const Route = createFileRoute("/m/schedule")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "M3 Yedekleme programı — Kloda" },
      { name: "description", content: "Kloda prototipi: M3 Yedekleme programı." },
      { property: "og:title", content: "M3 Yedekleme programı — Kloda" },
      { property: "og:description", content: "Kloda prototipi: M3 Yedekleme programı." },
    ],
  }),
  component: MobileSchedule,
});
