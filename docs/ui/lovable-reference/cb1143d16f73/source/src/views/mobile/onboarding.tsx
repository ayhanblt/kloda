import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Check, Folder, FolderPlus, Image as ImageIcon, Images, Lock, ShieldCheck } from "lucide-react";
import { useI18n, fmt } from "@/shared/i18n";
import { useDemo } from "@/shared/model/demo-store";
import { AppIcon } from "@/shared/ui/logo";
import { WelcomeIllustration } from "@/shared/ui/welcome-illustration";
import { Notice, PageHeader, Panel, Row, SectionTitle, Segmented } from "@/shared/ui/kit";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScheduleControls } from "@/features/schedule/ui";
import { photos } from "@/entities/photo/model";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

function Steps({ n }: { n: number }) {
  const { t } = useI18n();
  return (
    <div className="mb-4 flex items-center gap-3">
      <div className="flex gap-1.5" aria-hidden>
        {[1, 2, 3].map((i) => (
          <span key={i} className={cn("h-1.5 w-8 rounded-full", i <= n ? "bg-primary" : "bg-muted")} />
        ))}
      </div>
      <span className="text-xs text-muted-foreground">{fmt(t.setup.stepOf, { n, total: 3 })}</span>
    </div>
  );
}

/** M1 */
export function MobileWelcome() {
  const { t } = useI18n();
  const nav = useNavigate();
  return (
    <div className="-mx-4 -mt-5 flex min-h-[78vh] flex-col bg-hero-glow px-4 pt-6">
      <div className="flex flex-1 flex-col items-center text-center animate-rise">
        <span className="font-mono text-[10px] text-muted-foreground">M1</span>
        <WelcomeIllustration className="mt-2 w-full max-w-[340px]" />
        <div className="mt-2 flex items-center gap-2.5">
          <AppIcon className="size-11" title="Kloda" />
          <span className="text-2xl font-semibold tracking-tight text-ink">Kloda</span>
        </div>
        <h1 className="mt-5 text-[30px] font-semibold leading-[1.15] tracking-tight text-ink">{t.setup.m1Title}</h1>
        <p className="mt-3 max-w-sm text-ink-soft">{t.setup.m1Body}</p>
        <ul className="mt-6 w-full space-y-2 text-left">
          {t.setup.m1Points.map((p, i) => (
            <li key={p} className="flex items-center gap-3 rounded-2xl border border-border bg-card/80 p-3 text-sm text-ink shadow-card">
              <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-synced-soft text-xs font-semibold text-synced">
                {i + 1}
              </span>
              {p}
              <Check className="ml-auto size-4 shrink-0 text-synced" aria-hidden />
            </li>
          ))}
        </ul>
      </div>
      <div className="mt-8 space-y-2">
        <Button className="w-full" onClick={() => nav({ to: "/m/sources" })}>
          {t.setup.start}
        </Button>
        <Button variant="ghost" className="w-full" onClick={() => nav({ to: "/m" })}>
          {t.common.skip}
        </Button>
      </div>
    </div>
  );
}

/** M2 */
export function MobileSources() {
  const { t } = useI18n();
  const { demo, set } = useDemo();
  const nav = useNavigate();
  const [tab, setTab] = useState<"photos" | "files">("photos");
  const [picked, setPicked] = useState<string[]>([]);
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const granted = demo.photoPermission === "granted" || demo.photoPermission === "limited";
  const albums = ["Kapadokya 2026", "Aile", "Screenshots", "WhatsApp Images"];
  const [folders, setFolders] = useState(["Download/Faturalar", "Documents/Sözleşmeler", "DCIM/Camera"]);

  return (
    <div>
      <Steps n={1} />
      <PageHeader code="M2" title={t.sources.title} body={t.sources.subtitle} />
      <Segmented
        label={t.sources.title}
        value={tab}
        onChange={setTab}
        options={[
          { id: "photos", label: t.sources.photos },
          { id: "files", label: t.sources.files },
        ]}
      />
      {tab === "photos" ? (
        <div className="mt-4 space-y-3">
          {!granted ? (
            <Panel>
              <div className="flex items-start gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-muted text-ink-soft">
                  <Lock className="size-5" aria-hidden />
                </span>
                <div>
                  <p className="text-sm font-semibold text-ink">{t.sources.permissionTitle}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{t.sources.permissionBody}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => set({ photoPermission: "granted" })}>
                      {t.sources.askPermission}
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => set({ photoPermission: "limited" })}>
                      {t.sources.limited}
                    </Button>
                  </div>
                </div>
              </div>
            </Panel>
          ) : (
            <>
              <Notice tone="ok" icon={ShieldCheck}>
                {demo.photoPermission === "limited" ? t.sources.limited : t.sources.permissionGranted}
              </Notice>
              <div className="space-y-2">
                <div className="mb-4 flex items-center justify-between gap-2 rounded-2xl bg-attention-soft p-4"><div><p className="font-semibold text-ink">{t.sources.starter}</p><p className="text-xs text-ink-soft">{t.sources.starterBody}</p></div><Switch aria-label={t.sources.starter} checked={albums.every(a => picked.includes(a))} onCheckedChange={v => setPicked(v ? albums : [])} /></div>
                <SectionTitle action={<Button size="sm" variant="ghost" onClick={() => setPicked(picked.includes("all") ? [] : ["all"])}>{t.sources.selectAll}</Button>}>{t.sources.albums}</SectionTitle>
                {[{ id: "all", label: t.sources.allPhotos, icon: Images }, ...albums.map((a) => ({ id: a, label: a, icon: ImageIcon }))].map(
                  ({ id, label, icon: Icon }, i) => (
                    <Label key={id} htmlFor={`src-${id}`} className="flex min-h-20 cursor-pointer items-center gap-3 rounded-2xl border border-border bg-card p-3 shadow-card hover:bg-accent">
                      <img src={photos[i % photos.length]?.src} alt="" className="size-12 shrink-0 rounded-xl object-cover" />
                      <span className="min-w-0 flex-1"><span className="block text-sm font-medium">{label}</span><span className="mt-1 block text-xs text-muted-foreground">{fmt(t.sources.ready, { n: 120 + i * 84 })}</span></span>
                      <Switch id={`src-${id}`} checked={picked.includes(id) || picked.includes("all")} onCheckedChange={() => { if (id === "all") setPicked(picked.includes("all") ? [] : ["all"]); else setPicked(v => v.includes("all") ? albums.filter(a => a !== id) : v.includes(id) ? v.filter(a => a !== id) : [...v, id]); }} />
                    </Label>
                  ),
                )}
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          <Panel className="p-1">
            {folders.map((f) => (
              <Label key={f} htmlFor={`f-${f}`} className="flex min-h-20 cursor-pointer items-center gap-3 rounded-2xl border border-border bg-card p-3 shadow-card hover:bg-accent">
                <Folder className="size-5 text-ink-soft" aria-hidden />
                <span className="flex-1 truncate text-sm font-medium">{f}</span>
                <Checkbox id={`f-${f}`} checked={picked.includes(f)} onCheckedChange={() => toggle(f)} className="size-5" />
              </Label>
            ))}
          </Panel>
          <Button variant="secondary" className="w-full" onClick={() => { const folder = `Documents/Kloda-${folders.length + 1}`; setFolders(v => [...v, folder]); setPicked(v => [...v, folder]); toast(t.gallery.demoAction); }}>
            <FolderPlus /> {t.sources.addFolder}
          </Button>
        </div>
      )}
      <Notice className="mt-4" icon={ShieldCheck}>{t.sources.privacy}</Notice>
      <p className="mt-4 text-sm font-medium text-ink">{fmt(t.sources.selected, { n: picked.length })}</p>
      <div className="mt-6 space-y-2">
        <Button className="w-full" disabled={picked.length === 0 || (tab === "photos" && !granted)} onClick={() => { set({ sourcesSelected: picked.length > 0 }); nav({ to: "/m/schedule" }); }}>
          {t.common.continue}
        </Button>
        <Button variant="ghost" className="w-full" asChild>
          <Link to="/m">{t.common.skip}</Link>
        </Button>
      </div>
    </div>
  );
}

/** M3 */
export function MobileSchedule() {
  const { t } = useI18n();
  const { set } = useDemo();
  const nav = useNavigate();
  return (
    <div>
      <Steps n={2} />
      <PageHeader code="M3" title={t.schedule.title} />
      <ScheduleControls />
      <div className="mt-6 space-y-2">
        <Button className="w-full" onClick={() => { set({ mobileSetupDone: true }); nav({ to: "/m/connections/new" }); }}>
          {t.common.continue}
        </Button>
        <Button variant="ghost" className="w-full" asChild>
          <Link to="/m">{t.common.skip}</Link>
        </Button>
      </div>
    </div>
  );
}
