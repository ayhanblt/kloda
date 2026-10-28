import { createFileRoute } from "@tanstack/react-router";
import { DesktopHome } from "@/views/desktop/receiver";

export const Route = createFileRoute("/d/")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "D2 Alıcı — Kloda" },
      { name: "description", content: "Kloda prototipi: D2 Alıcı." },
      { property: "og:title", content: "D2 Alıcı — Kloda" },
      { property: "og:description", content: "Kloda prototipi: D2 Alıcı." },
    ],
  }),
  component: DesktopHome,
});
