import { createFileRoute } from "@tanstack/react-router";
import { MobilePairQr } from "@/views/mobile/connections";

export const Route = createFileRoute("/m/pair-qr")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "M9 QR eşleştirme — Kloda" },
      { name: "description", content: "Kloda prototipi: M9 QR eşleştirme." },
      { property: "og:title", content: "M9 QR eşleştirme — Kloda" },
      { property: "og:description", content: "Kloda prototipi: M9 QR eşleştirme." },
    ],
  }),
  component: MobilePairQr,
});
