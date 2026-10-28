import { createFileRoute } from "@tanstack/react-router";
import { DesktopSettings } from "@/views/desktop/outgoing";

export const Route = createFileRoute("/d/settings")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "D12 Ayarlar — Kloda" },
      { name: "description", content: "Kloda prototipi: D12 Ayarlar." },
      { property: "og:title", content: "D12 Ayarlar — Kloda" },
      { property: "og:description", content: "Kloda prototipi: D12 Ayarlar." },
    ],
  }),
  component: DesktopSettings,
});
