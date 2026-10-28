import { createFileRoute } from "@tanstack/react-router";
import { DesktopSources } from "@/views/desktop/outgoing";

export const Route = createFileRoute("/d/sources")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "D10 Kaynaklar — Kloda" },
      { name: "description", content: "Kloda prototipi: D10 Kaynaklar." },
      { property: "og:title", content: "D10 Kaynaklar — Kloda" },
      { property: "og:description", content: "Kloda prototipi: D10 Kaynaklar." },
    ],
  }),
  component: DesktopSources,
});
