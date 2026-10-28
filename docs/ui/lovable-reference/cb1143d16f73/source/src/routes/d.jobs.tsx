import { createFileRoute } from "@tanstack/react-router";
import { DesktopJobs } from "@/views/desktop/outgoing";

export const Route = createFileRoute("/d/jobs")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "D11 Giden işler — Kloda" },
      { name: "description", content: "Kloda prototipi: D11 Giden işler." },
      { property: "og:title", content: "D11 Giden işler — Kloda" },
      { property: "og:description", content: "Kloda prototipi: D11 Giden işler." },
    ],
  }),
  component: DesktopJobs,
});
