import { createFileRoute, Link } from "@tanstack/react-router";
import { Monitor, Palette, Smartphone } from "lucide-react";
import { useI18n } from "@/shared/i18n";
import { AppIcon } from "@/shared/ui/logo";
import { DemoBadge, Panel, SectionTitle } from "@/shared/ui/kit";
import { LangSwitch } from "@/features/lang-switch/ui";
import { Button } from "@/components/ui/button";
import { providers } from "@/entities/connection/model";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Kloda — Secure Photos & Sync prototipi" },
      { name: "description", content: "Kloda: telefondan bilgisayara ve seçtiğin depolamaya özel yedekleme. Tıklanabilir mobil ve masaüstü prototip." },
      { property: "og:title", content: "Kloda — Secure Photos & Sync prototipi" },
      { property: "og:description", content: "Tıklanabilir mobil ve masaüstü tasarım prototipi." },
    ],
  }),
  component: Hub,
});

const coverage: [string, string, string][] = [
  ["M1", "Karşılama ve kurulum", "/m/welcome"], ["M2", "Kaynak seçimi", "/m/sources"], ["M3", "Program", "/m/schedule"],
  ["M4", "Galeri ve özet", "/m"], ["M5", "Fotoğraf detayı", "/m/photo/img-1"], ["M6", "Bağlantılar", "/m/connections"],
  ["M7", "Bağlantı ekle", "/m/connections/new"], ["M8", "Bilgisayara bağlan", "/m/pair-pc"], ["M9", "QR eşleştirme", "/m/pair-qr"],
  ["M10", "Bağlantı detayı", "/m/connections/macbook"], ["M11", "Aktivite", "/m/activity"], ["M12", "Yedekler / geri yükleme", "/m/backups"],
  ["M13", "Ayarlar", "/m/settings"],
  ["D1", "Karşılama / alıcı kurulumu", "/d/welcome"], ["D2", "Alıcı ana sayfa", "/d"], ["D3", "Telefon eşleştir / QR", "/d/pair"],
  ["D4", "Cihazlar ve izinler", "/d/devices"], ["D5", "Gelen aktarımlar", "/d/incoming"], ["D6", "Yedekler ve sürümler", "/d/backups"],
  ["D7", "30 günlük çöp kutusu", "/d/trash"], ["D8", "Giden bağlantılar", "/d/connections"], ["D9", "Bağlantı ekle / detay", "/d/connections/new"],
  ["D10", "Kaynaklar ve program", "/d/sources"], ["D11", "Giden işler", "/d/jobs"], ["D12", "Ayarlar / arka plan", "/d/settings"],
  ["D13", "Tray / menü çubuğu", "/d/tray"],
  ...providers.map((p) => [p.code, p.name, `/m/connections/new/${p.id}`] as [string, string, string]),
];

function Hub() {
  const { t } = useI18n();
  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <DemoBadge />
        <LangSwitch />
      </header>
      <main className="mx-auto max-w-5xl px-6 pb-16">
        <section className="flex flex-col items-start gap-6 py-10 animate-rise">
          <AppIcon className="size-20" title="Kloda" />
          <h1 className="max-w-2xl text-[40px] font-semibold leading-tight tracking-tight text-ink">{t.hub.title}</h1>
          <p className="max-w-xl text-ink-soft">{t.hub.subtitle}</p>
          <div className="flex flex-wrap gap-2">
            <Button asChild><Link to="/m/welcome"><Smartphone /> {t.hub.openMobile}</Link></Button>
            <Button variant="outline" asChild><Link to="/d/welcome"><Monitor /> {t.hub.openDesktop}</Link></Button>
            <Button variant="ghost" asChild><Link to="/brand"><Palette /> {t.hub.brand}</Link></Button>
            <Button variant="outline" asChild><Link to="/lock-screen"><Smartphone /> {t.lockScreen.title}</Link></Button>
          </div>
        </section>
        <SectionTitle>{t.hub.coverage}</SectionTitle>
        <Panel className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border text-left text-xs text-muted-foreground"><th className="p-3">{t.hub.code}</th><th className="p-3">{t.hub.screen}</th><th className="p-3">{t.hub.route}</th></tr></thead>
            <tbody>
              {coverage.map(([c, n, r]) => (
                <tr key={c} className="border-b border-border last:border-0">
                  <td className="p-3 font-mono text-xs font-semibold">{c}</td>
                  <td className="p-3 text-ink">{n}</td>
                  <td className="p-3"><a href={r} className="font-mono text-xs text-ink-soft underline underline-offset-2 hover:text-ink">{r}</a></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
        <SectionTitle>{t.hub.gaps}</SectionTitle>
        <Panel>
          <ul className="list-disc space-y-2 pl-5 text-sm text-ink-soft">{t.hub.gapsList.map((g) => <li key={g}>{g}</li>)}</ul>
        </Panel>
      </main>
    </div>
  );
}
