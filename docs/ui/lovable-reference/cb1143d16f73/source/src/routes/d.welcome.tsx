import { createFileRoute } from "@tanstack/react-router";
import { DesktopWelcome } from "@/views/desktop/receiver";

export const Route = createFileRoute("/d/welcome")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "D1 Karşılama — Kloda" },
      { name: "description", content: "Kloda prototipi: D1 Karşılama." },
      { property: "og:title", content: "D1 Karşılama — Kloda" },
      { property: "og:description", content: "Kloda prototipi: D1 Karşılama." },
    ],
  }),
  component: DesktopWelcome,
});
