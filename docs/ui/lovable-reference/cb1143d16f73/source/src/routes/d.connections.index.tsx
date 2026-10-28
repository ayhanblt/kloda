import { createFileRoute } from "@tanstack/react-router";
import { DesktopConnections } from "@/views/desktop/outgoing";

export const Route = createFileRoute("/d/connections/")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "D8 Bağlantılar — Kloda" },
      { name: "description", content: "Kloda prototipi: D8 Bağlantılar." },
      { property: "og:title", content: "D8 Bağlantılar — Kloda" },
      { property: "og:description", content: "Kloda prototipi: D8 Bağlantılar." },
    ],
  }),
  component: DesktopConnections,
});
