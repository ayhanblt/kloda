import { createFileRoute } from "@tanstack/react-router";
import { LockScreenView } from "@/views/lock-screen";

export const Route = createFileRoute("/lock-screen")({
  head: () => ({ meta: [
    { title: "Kloda — iOS ve Android kilit ekranı" },
    { name: "description", content: "Kloda canlı yedekleme için iOS Live Activities ve Android Live Updates tasarım önizlemeleri." },
    { property: "og:title", content: "Kloda — Canlı yedekleme kilit ekranları" },
    { property: "og:description", content: "iOS ve Android kilit ekranlarında yedekleme ilerlemesi ve demo kontrolleri." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: LockScreenView,
});