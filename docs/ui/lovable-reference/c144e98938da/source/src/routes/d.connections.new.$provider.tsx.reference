import { createFileRoute, notFound } from "@tanstack/react-router";
import { DesktopProviderForm } from "@/views/desktop/outgoing";
import { getProvider } from "@/entities/connection/model";

export const Route = createFileRoute("/d/connections/new/$provider")({
  loader: ({ params }) => {
    const provider = getProvider(params.provider);
    if (!provider) throw notFound();
    return { code: provider.code, name: provider.name };
  },
  head: ({ loaderData }) => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: `${loaderData?.code ?? ""} ${loaderData?.name ?? "Bağlantı"} — Kloda` },
      { name: "description", content: "Kloda bağlantı formu prototipi." },
      { property: "og:title", content: `${loaderData?.name ?? "Bağlantı"} — Kloda` },
      { property: "og:description", content: "Kloda bağlantı formu prototipi." },
    ],
  }),
  component: function Page() {
    const { provider } = Route.useParams();
    const item = getProvider(provider);
    if (!item) throw notFound();
    return <DesktopProviderForm provider={item} />;
  },
});
