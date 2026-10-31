import { createFileRoute } from "@tanstack/react-router";
import { DesktopConnectionDetail } from "@/views/desktop/outgoing";

export const Route = createFileRoute("/d/connections/$id")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "D9 Bağlantı detayı — Kloda" },
      { name: "description", content: "Kloda prototipi: D9 Bağlantı detayı." },
      { property: "og:title", content: "D9 Bağlantı detayı — Kloda" },
      { property: "og:description", content: "Kloda prototipi: D9 Bağlantı detayı." },
    ],
  }),
  component: function Page() {
    const { id } = Route.useParams();
    return <DesktopConnectionDetail id={id} />;
  },
});
