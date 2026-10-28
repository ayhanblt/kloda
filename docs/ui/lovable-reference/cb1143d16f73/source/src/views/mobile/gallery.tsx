import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { AlertCircle, Check, CloudCheck, CloudUpload, Download, FolderInput, FolderPlus, Heart, Laptop, Pause, Play, Plus, RefreshCw, Search, ShieldOff, Video, X } from "lucide-react";
import { useI18n, fmt } from "@/shared/i18n";
import { useDemo } from "@/shared/model/demo-store";
import { DemoBadge, FilterChips, Notice, Panel, Row, SectionTitle, StatusPill } from "@/shared/ui/kit";
import { StateFrame } from "@/shared/ui/state-frame";
import { Button } from "@/components/ui/button";
import { photos, type Photo } from "@/entities/photo/model";
import { connections } from "@/entities/connection/model";
import { cn } from "@/lib/utils";

type GalleryFilter = "all" | "video" | "fav" | "unbacked";

/** M4 */
export function MobileGallery() {
  const { t } = useI18n();
  const { demo, set, loadFull } = useDemo();
  const [filter, setFilter] = useState<GalleryFilter>("all");
  const [selecting, setSelecting] = useState(false);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const gaps = [
    !demo.sourcesSelected && { icon: FolderPlus, title: t.gallery.noSource, cta: t.gallery.noSourceCta, to: "/m/sources" },
    !demo.pcPaired && { icon: Laptop, title: t.gallery.noPair, cta: t.gallery.noPairCta, to: "/m/pair-pc" },
    demo.connections === 0 && !demo.pcPaired && { icon: Plus, title: t.gallery.noConn, cta: t.gallery.noConnCta, to: "/m/connections/new" },
  ].filter(Boolean) as { icon: typeof Plus; title: string; cta: string; to: string }[];
  const canShowPhotos = demo.photoPermission === "granted" || demo.photoPermission === "limited";
  const configured = gaps.length === 0;

  const matchFilter = (p: Photo) =>
    filter === "all" ? true : filter === "video" ? !!p.video : filter === "fav" ? !!p.favorite : p.status !== "synced";
  const filtered = photos.filter(matchFilter);

  const toggleSel = (id: string) =>
    setSel((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const exitSelect = () => {
    setSelecting(false);
    setSel(new Set());
  };
  const act = (msg: string) => toast(msg);

  return (
    <div>
      <div className="mb-3 flex items-end justify-between gap-2 animate-rise">
        <div className="min-w-0">
          <span className="font-mono text-[10px] text-muted-foreground">M4</span>
          <h1 className="text-[28px] font-bold tracking-tight text-ink">{t.gallery.title}</h1>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {!configured && (
            <button onClick={loadFull} className="min-h-10 rounded-lg px-2 text-xs text-muted-foreground underline underline-offset-2">
              {t.common.demo}: {t.states.success}
            </button>
          )}
          {canShowPhotos && (
            <Button variant="secondary" size="sm" className="rounded-full" onClick={selecting ? exitSelect : () => setSelecting(true)}>
              {selecting ? t.common.cancel : t.gallery.select}
            </Button>
          )}
        </div>
      </div>

      {configured && (
        <p className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-ink-soft animate-rise">
          <span className="size-1.5 rounded-full bg-synced" aria-hidden />
          {fmt(t.gallery.syncLine, { n: "14.280" })}
        </p>
      )}

      {/* Summary */}
      <Panel className="mb-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-ink">{t.gallery.summary}</p>
          {configured ? (
            demo.paused ? <StatusPill tone="pending">{t.status.paused}</StatusPill> : <StatusPill tone="syncing">{t.status.syncing}</StatusPill>
          ) : (
            <StatusPill tone="neutral">{t.common.notConfigured}</StatusPill>
          )}
        </div>
        {configured ? (
          <>
            <p className="mt-2 text-sm text-muted-foreground">
              {t.gallery.lastRun}: 14:06 · {fmt(t.gallery.queued, { n: 24 })}
            </p>
            {demo.paused && <Notice className="mt-3">{t.gallery.pausedNote}</Notice>}
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button variant="secondary" className="rounded-full" disabled={demo.paused} onClick={() => toast(t.activity.syncAllToast)}>
                <RefreshCw /> {t.gallery.syncNow}
              </Button>
              <Button variant="secondary" className="rounded-full" onClick={() => set({ paused: !demo.paused })}>
                {demo.paused ? <Play /> : <Pause />} {demo.paused ? t.gallery.resume : t.gallery.pauseAll}
              </Button>
            </div>
            <SectionTitle>{t.gallery.destinations}</SectionTitle>
            <div className="flex flex-wrap gap-1.5">
              {connections.map((c) => (
                <Link key={c.id} to="/m/connections/$id" params={{ id: c.id }}>
                  <StatusPill tone={c.state === "ok" ? "synced" : c.state === "offline" || c.state === "paused" ? "pending" : "review"}>{c.name}</StatusPill>
                </Link>
              ))}
            </div>
          </>
        ) : (
          <div className="mt-2 space-y-1">
            <SectionTitle>{t.gallery.setupGaps}</SectionTitle>
            {gaps.map((g) => (
              <Row key={g.to} icon={g.icon} title={g.title} meta={g.cta} to={g.to} />
            ))}
          </div>
        )}
      </Panel>

      {!canShowPhotos ? (
        <Notice icon={ShieldOff}>
          {t.gallery.noPhotoPermission}{" "}
          <Link to="/m/sources" className="font-medium text-ink underline underline-offset-2">
            {t.gallery.noSourceCta}
          </Link>
        </Notice>
      ) : (
        <StateFrame states={["loading", "offline", "full", "interrupted"]}>
          <SectionTitle>{t.sources.albums}</SectionTitle>
          <div className="-mx-4 mb-2 flex gap-3 overflow-x-auto px-4 pb-2">
            {["Kapadokya 2026", "Aile", "İstanbul", "Sahil", "Sonbahar"].map((a, i) => (
              <div key={a} className="w-32 shrink-0 animate-rise">
                <div className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-muted shadow-card">
                  <span className="absolute inset-x-2 -top-1 h-3 rounded-t-xl bg-border" aria-hidden />
                  <img src={photos[(i + 2) % photos.length]!.src} alt="" loading="lazy" width={816} height={816} className="relative size-full object-cover transition-transform duration-500 hover:scale-105" />
                  <span className="absolute bottom-2 left-2 size-2.5 rounded-full bg-synced ring-2 ring-card" />
                </div>
                <p className="mt-1.5 truncate text-sm font-medium text-ink">{a}</p>
                <p className="text-xs text-muted-foreground">{fmt(t.backups.items, { n: 40 + i * 37 })}</p>
              </div>
            ))}
          </div>

          {/* Filters */}
          <FilterChips
            className="mb-3 mt-1"
            label={t.gallery.title}
            value={filter}
            onChange={setFilter}
            options={[
              { id: "all", label: t.gallery.filterAll, icon: Search },
              { id: "video", label: t.gallery.filterVideos, icon: Video },
              { id: "fav", label: t.gallery.filterFavorites, icon: Heart },
              { id: "unbacked", label: t.gallery.filterNotBackedUp, dot: "bg-attention" },
            ]}
          />

          {filtered.length === 0 && (
            <p className="rounded-2xl border border-dashed border-input bg-surface px-4 py-8 text-center text-sm text-muted-foreground">
              {t.gallery.filterEmpty}
            </p>
          )}

          {(["today", "lastWeek"] as const).map((g) => {
            const items = filtered.filter((p) => p.group === g);
            if (!items.length) return null;
            const allSynced = items.every((p) => p.status === "synced");
            return (
              <div key={g} className="mt-6 first:mt-2">
                <div className="mb-2 flex flex-wrap items-center gap-2 px-1 py-1">
                  <h2 className="text-[15px] font-bold text-ink">

                    {g === "today" ? t.gallery.today : t.gallery.lastWeek}{" "}
                    <span className="text-xs font-normal text-muted-foreground">
                      {g === "today" ? t.gallery.todayDate : t.gallery.lastWeekDate}
                    </span>
                  </h2>
                  {allSynced ? (
                    <span className="ml-auto flex items-center gap-1 text-xs font-semibold text-synced">
                      <CloudCheck className="size-4" aria-hidden />
                      {t.gallery.allBackedUp}
                    </span>
                  ) : (
                    <span className="ml-auto text-xs tabular-nums text-muted-foreground">
                      {fmt(t.gallery.itemsCount, { n: items.length })}
                    </span>
                  )}
                  {g === "today" && !allSynced && <DemoBadge />}
                </div>
                <div className="grid grid-cols-3 gap-1">
                  {items.map((p, i) => {
                    const inner = (
                      <>
                        <img
                          src={p.src}
                          alt=""
                          loading={i < 3 ? "eager" : "lazy"}
                          width={816}
                          height={816}
                          className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                        />
                        {!selecting &&
                          (p.status === "synced" ? (
                            <span className="absolute bottom-1.5 left-1.5 grid size-5 place-items-center rounded-full bg-synced text-card shadow-card">
                              <Check className="size-3" strokeWidth={3} aria-hidden />
                            </span>
                          ) : (
                            <span
                              className={cn(
                                "absolute bottom-1.5 left-1.5 grid size-5 place-items-center rounded-full text-card shadow-card",
                                p.status === "syncing" ? "bg-syncing" : "bg-attention",
                              )}
                            >
                              {p.status === "syncing" ? (
                                <CloudUpload className="size-3" aria-hidden />
                              ) : (
                                <AlertCircle className="size-3" aria-hidden />
                              )}
                            </span>
                          ))}
                        {selecting && (
                          <span
                            className={cn(
                              "absolute right-1.5 top-1.5 grid size-6 place-items-center rounded-full border-2 transition-colors",
                              sel.has(p.id)
                                ? "border-attention bg-attention text-card"
                                : "border-card bg-ink/25 text-transparent backdrop-blur-sm",
                            )}
                          >
                            <Check className="size-3.5" aria-hidden />
                          </span>
                        )}
                      </>
                    );
                    return selecting ? (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => toggleSel(p.id)}
                        aria-pressed={sel.has(p.id)}
                        aria-label={`${p.name} — ${t.gallery.selected.replace("{n}", "")}`.trim()}
                        className="group relative aspect-square overflow-hidden rounded-lg bg-muted"
                      >
                        {inner}
                      </button>
                    ) : (
                      <Link
                        key={p.id}
                        to="/m/photo/$id"
                        params={{ id: p.id }}
                        className="group relative aspect-square overflow-hidden rounded-lg bg-muted"
                        aria-label={`${p.name} — ${t.status[p.status === "failed" ? "failed" : p.status]}`}
                      >
                        {inner}
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Selection action bar */}
          {selecting && sel.size > 0 && (
            <div className="sticky bottom-20 z-20 mt-4 flex flex-wrap items-center gap-1 rounded-2xl bg-ink p-2 shadow-float animate-rise">
              <span className="min-w-0 flex-1 truncate text-sm font-semibold tabular-nums text-background">
                {fmt(t.gallery.selected, { n: sel.size })}
              </span>
              <Button
                size="sm"
                variant="attention"
                className="shrink-0 rounded-full"
                onClick={() => act(fmt(t.gallery.toastQueued, { n: sel.size }))}
              >
                <CloudUpload /> {t.gallery.backup}
              </Button>
              <Button size="icon" variant="ghost" className="shrink-0 rounded-full text-background hover:bg-background/10 hover:text-background" title={t.gallery.download} onClick={() => act(t.gallery.toastDownload)} aria-label={t.gallery.download}>
                <Download />
              </Button>
              <Button size="icon" variant="ghost" className="shrink-0 rounded-full text-background hover:bg-background/10 hover:text-background" title={t.gallery.move} onClick={() => act(t.gallery.toastMove)} aria-label={t.gallery.move}>
                <FolderInput />
              </Button>
              <Button size="icon" variant="ghost" className="shrink-0 rounded-full text-background hover:bg-background/10" onClick={exitSelect} aria-label={t.common.close}>
                <X />
              </Button>
            </div>
          )}
        </StateFrame>
      )}
    </div>
  );
}
