import { createFileRoute } from "@tanstack/react-router";
import { MobileWelcome } from "@/views/mobile/onboarding";

export const Route = createFileRoute("/m/welcome")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "M1 Karşılama — Kloda" },
      { name: "description", content: "Kloda prototipi: M1 Karşılama." },
      { property: "og:title", content: "M1 Karşılama — Kloda" },
      { property: "og:description", content: "Kloda prototipi: M1 Karşılama." },
    ],
  }),
  component: MobileWelcome,
});
