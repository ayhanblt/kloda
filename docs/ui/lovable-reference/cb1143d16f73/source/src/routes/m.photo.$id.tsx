import { createFileRoute, notFound } from "@tanstack/react-router";
import { MobilePhotoDetail } from "@/views/mobile/photo-detail";
import { photos } from "@/entities/photo/model";

export const Route = createFileRoute("/m/photo/$id")({
  loader: ({ params }) => {
    const item = photos.find((x) => x.id === params.id);
    if (!item) throw notFound();
    return { item };
  },
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "M5 Fotoğraf detayı — Kloda" },
      { name: "description", content: "Kloda prototipi: M5 Fotoğraf detayı." },
      { property: "og:title", content: "M5 Fotoğraf detayı — Kloda" },
      { property: "og:description", content: "Kloda prototipi: M5 Fotoğraf detayı." },
    ],
  }),
  component: function Page() {
    const { item } = Route.useLoaderData();
    return <MobilePhotoDetail photo={item} />;
  },
});
