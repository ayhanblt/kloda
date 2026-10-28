import { createFileRoute } from "@tanstack/react-router";
import { MobileGallery } from "@/views/mobile/gallery";

export const Route = createFileRoute("/m/")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "M4 Galeri — Kloda" },
      { name: "description", content: "Kloda prototipi: M4 Galeri." },
      { property: "og:title", content: "M4 Galeri — Kloda" },
      { property: "og:description", content: "Kloda prototipi: M4 Galeri." },
    ],
  }),
  component: MobileGallery,
});
