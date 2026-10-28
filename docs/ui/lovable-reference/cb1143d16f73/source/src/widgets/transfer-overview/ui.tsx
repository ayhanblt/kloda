import { HardDrive, Pause, Play, Zap } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/shared/i18n";
import { useDemo } from "@/shared/model/demo-store";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { StatusPill } from "@/shared/ui/kit";
import type { Job } from "@/entities/job/model";

export function TransferOverview({ jobs }: { jobs: Job[] }) {
  const { t } = useI18n();
  const { demo, set } = useDemo();
  const active = jobs.find(j => j.status === "syncing");
  return <section className="mb-5 grid gap-5 border-b border-border pb-5 md:grid-cols-[minmax(0,1fr)_auto]">
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-2"><HardDrive className="size-4 text-muted-foreground" /><p className="text-xs font-medium text-muted-foreground">{t.activity.destination}</p><StatusPill tone={demo.paused ? "pending" : active ? "syncing" : "synced"}>{demo.paused ? t.status.paused : active ? t.status.syncing : t.status.done}</StatusPill></div>
      <p className="mt-2 break-all text-lg font-semibold text-ink">{active?.to ?? t.activity.completed}</p>
      {active && <><div className="mt-2 flex items-center justify-between gap-2 text-xs text-muted-foreground"><span>{active.size} · {active.speed}</span><span className="font-semibold text-attention">{active.progress}%</span></div><Progress value={active.progress} className="mt-2 h-2 bg-muted [&>div]:bg-attention" /></>}
    </div>
    <div className="flex flex-wrap items-end gap-2">
      <Button variant="secondary" onClick={() => { set({ paused: !demo.paused }); toast(demo.paused ? t.gallery.resume : t.gallery.pausedNote); }}>{demo.paused ? <Play /> : <Pause />}{demo.paused ? t.gallery.resume : t.gallery.pauseAll}</Button>
      <Button variant="attention" onClick={() => toast(t.activity.syncAllToast)}><Zap />{t.gallery.syncNow}</Button>
    </div>
  </section>;
}