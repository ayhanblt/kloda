import { createFileRoute, notFound } from "@tanstack/react-router";
import { MobileConnectionDetail } from "@/views/mobile/connections";
import { connections } from "@/entities/connection/model";

export const Route = createFileRoute("/m/connections/$id")({
  loader: ({ params }) => {
    const item = connections.find((x) => x.id === params.id);
    if (!item) throw notFound();
    return { item };
  },
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "M10 Bağlantı detayı — Kloda" },
      { name: "description", content: "Kloda prototipi: M10 Bağlantı detayı." },
      { property: "og:title", content: "M10 Bağlantı detayı — Kloda" },
      { property: "og:description", content: "Kloda prototipi: M10 Bağlantı detayı." },
    ],
  }),
  component: function Page() {
    const { item } = Route.useLoaderData();
    return <MobileConnectionDetail conn={item} />;
  },
});
