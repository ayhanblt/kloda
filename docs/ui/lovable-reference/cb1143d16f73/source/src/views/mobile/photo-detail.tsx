import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { ArrowLeft, Heart, Laptop, RefreshCw, Server, Share2, ShieldCheck, Trash2 } from "lucide-react";
import { useI18n } from "@/shared/i18n";
import { DemoBadge, Notice, Panel, Row, SectionTitle, StatusPill } from "@/shared/ui/kit";
import { ConfirmDialog } from "@/shared/ui/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { Photo } from "@/entities/photo/model";
import { getConnection } from "@/entities/connection/model";

const tone = { synced: "synced", syncing: "syncing", pending: "pending", failed: "danger", uncertain: "review" } as const;

/** M5 */
export function MobilePhotoDetail({ photo }: { photo: Photo }) {
  const { t } = useI18n();
  const [favorite, setFavorite] = useState(Boolean(photo.favorite));
  return (
    <div>
      <Link to="/m" className="mb-3 inline-flex min-h-12 items-center gap-2 text-sm text-ink-soft">
        <ArrowLeft className="size-4" /> {t.nav.gallery}
      </Link>
      <span className="ml-2 font-mono text-[10px] text-muted-foreground">M5</span>
      <div className="relative overflow-hidden rounded-2xl bg-ink shadow-float animate-rise">
        <img src={photo.src} alt={photo.name} width={816} height={816} className="aspect-[4/5] max-h-[560px] w-full object-cover" />
        <div className="absolute right-3 top-3 flex gap-2">
          <Button size="icon" variant="secondary" className="rounded-full" title={t.photo.favorite} aria-label={t.photo.favorite} aria-pressed={favorite} onClick={() => { setFavorite(v => !v); toast(t.photo.favoriteToast); }}><Heart className={favorite ? "fill-attention text-attention" : ""} /></Button>
          <Button size="icon" variant="secondary" className="rounded-full" title={t.photo.share} aria-label={t.photo.share} onClick={() => toast(t.photo.shareToast)}><Share2 /></Button>
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between gap-2">
        <h1 className="truncate text-lg font-semibold text-ink">{photo.name}</h1>
        <DemoBadge />
      </div>
      <SectionTitle>{t.photo.destStatus}</SectionTitle>
      <Panel className="space-y-1 p-1">
        {photo.destinations.map((d) => {
          const c = getConnection(d.connId);
          if (!c) return null;
          return (
            <div key={d.connId}>
              <Row
                icon={c.providerId === "computer" ? Laptop : Server}
                title={c.name}
                meta={c.target}
                to="/m/connections/$id"
                params={{ id: c.id }}
                trailing={<StatusPill tone={tone[d.status]}>{t.status[d.status]}</StatusPill>}
              />
              <div className="px-3 pb-3"><Progress value={d.status === "synced" ? 100 : d.status === "syncing" ? 68 : 0} className={d.status === "synced" ? "h-1.5 bg-muted [&>div]:bg-synced" : "h-1.5 bg-muted [&>div]:bg-attention"} aria-label={t.status[d.status]} /></div>
              {d.status === "uncertain" && (
                <div className="px-3 pb-3">
                  <Notice tone="warn">{t.activity.bytesSentNote}</Notice>
                </div>
              )}
              {(d.status === "failed" || d.status === "uncertain") && (
                <div className="px-3 pb-3">
                  <ConfirmDialog
                    trigger={<Button size="sm" variant="secondary">{t.photo.rebackup}</Button>}
                    title={t.backups.rebackupTitle}
                    body={t.backups.rebackupBody}
                    confirm={t.backups.rebackupConfirm}
                  />
                </div>
              )}
            </div>
          );
        })}
      </Panel>
      <SectionTitle>{t.common.manage}</SectionTitle>
      <Panel className="space-y-2 p-2">
        <Button variant="attention" className="w-full" onClick={() => toast(t.activity.syncAllToast)}><RefreshCw />{t.gallery.syncNow}</Button>
        <Button variant="secondary" className="w-full rounded-full" onClick={() => toast.success(t.photo.verifyToast)}>
          <ShieldCheck /> {t.photo.verifyChecksum}
        </Button>
        <ConfirmDialog
          trigger={<Button variant="ghost" className="w-full text-danger"><Trash2 /> {t.photo.deleteLocal}</Button>}
          title={t.photo.deleteLocalTitle}
          body={t.photo.deleteLocalBody}
          confirm={t.photo.deleteLocal}
          destructive
          onConfirm={() => toast.success(t.photo.deleteToast)}
        />
      </Panel>
      <SectionTitle>{t.photo.info}</SectionTitle>
      <Panel className="grid grid-cols-2 gap-3 text-sm">
        <div><p className="text-xs text-muted-foreground">{t.photo.taken}</p><p className="text-ink">{photo.taken}</p></div>
        <div><p className="text-xs text-muted-foreground">{t.photo.size}</p><p className="text-ink">{photo.size}</p></div>
        <div className="col-span-2"><p className="text-xs text-muted-foreground">{t.photo.camera}</p><p className="text-ink">{photo.camera}</p></div>
      </Panel>
      <Notice className="mt-4">{t.photo.original}</Notice>
    </div>
  );
}
