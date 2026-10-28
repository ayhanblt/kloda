import { createFileRoute } from "@tanstack/react-router";
import { MobileAddConnection } from "@/views/mobile/connections";

export const Route = createFileRoute("/m/connections/new/")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "M7 Bağlantı ekle — Kloda" },
      { name: "description", content: "Kloda prototipi: M7 Bağlantı ekle." },
      { property: "og:title", content: "M7 Bağlantı ekle — Kloda" },
      { property: "og:description", content: "Kloda prototipi: M7 Bağlantı ekle." },
    ],
  }),
  component: MobileAddConnection,
});
