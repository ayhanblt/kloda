import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Archive, Bell, CalendarClock, Clock, FolderOpen, HardDrive, Image as ImageIcon, Info, Languages, Moon, Pause, Play, Radio, RotateCcw, Signal, Zap } from "lucide-react";
import { toast } from "sonner";
import { useI18n, fmt, LANGS } from "@/shared/i18n";
import { useDemo } from "@/shared/model/demo-store";
import { Notice, PageHeader, Panel, Row, SectionTitle, Segmented, StatusPill } from "@/shared/ui/kit";
import { StateFrame } from "@/shared/ui/state-frame";
import { ConfirmDialog } from "@/shared/ui/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { JobList, JobSummary } from "@/widgets/job-list/ui";
import { mobileJobs, jobGroup } from "@/entities/job/model";
import { backups } from "@/entities/device/model";

/** M11 */
export function MobileActivity() {
  const { t } = useI18n();
  const { demo, set } = useDemo();
  const [tab, setTab] = useState<"queue" | "history">("queue");
  const queue = mobileJobs.filter((j) => jobGroup(j.status) !== "completed" && j.status !== "failed");
  const history = mobileJobs.filter((j) => jobGroup(j.status) === "completed" || j.status === "failed" || j.status === "skipped");
  const jobs = tab === "queue" ? queue : history;
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2 animate-rise">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">{t.activity.eyebrow}</p>
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-medium text-ink-soft">
          <span className="size-1.5 rounded-full bg-synced" aria-hidden />
          {t.activity.peer}
        </span>
      </div>
      <PageHeader code="M11" title={t.activity.title} body={t.activity.subtitle} />
      <Button variant="outline" size="sm" className="mb-4 rounded-full" asChild><Link to="/lock-screen"><Bell />{t.lockScreen.title}</Link></Button>

      {/* Destination progress */}
      <Panel className="mb-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-muted text-ink-soft">
              <HardDrive className="size-5" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">{t.activity.destination}</p>
              <p className="truncate text-sm font-semibold text-ink">Home Synology DS920+</p>
            </div>
          </div>
          <span className="shrink-0 rounded-full bg-attention-soft px-2.5 py-1 text-[11px] font-bold text-attention">{t.status.syncing}</span>
        </div>
        <div className="mt-4 flex items-end justify-between gap-2">
          <p className="text-lg font-bold leading-tight text-ink">{fmt(t.activity.uploading, { done: 14, total: 42 })}</p>
          <p className="shrink-0 text-lg font-bold tabular-nums text-attention">68%</p>
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">{t.activity.speedLine}</p>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
          <div className="h-full w-[68%] rounded-full bg-attention" />
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {([
            [t.activity.statUploaded, "1,84 GB"],
            [t.activity.statRemaining, "860 MB"],
            [t.activity.statSpeed, "102 MB/s"],
          ] as const).map(([l, v]) => (
            <div key={l} className="rounded-xl bg-warn-soft p-2.5">
              <p className="truncate text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{l}</p>
              <p className="mt-0.5 text-sm font-bold tabular-nums text-ink">{v}</p>
            </div>
          ))}
        </div>
      </Panel>

      <Segmented label={t.activity.title} value={tab} onChange={setTab} options={[
        { id: "queue", label: fmt(t.activity.queueCount, { n: queue.length }) },
        { id: "history", label: fmt(t.activity.historyCount, { n: history.length }) },
      ]} />
      <div className="mt-4">
        <StateFrame states={["empty", "loading", "offline", "interrupted", "partial", "full"]} emptyAction={<Button asChild><Link to="/m/sources">{t.gallery.noSourceCta}</Link></Button>}>
          <JobSummary jobs={jobs} />
          <JobList jobs={jobs} />
          {tab === "queue" && (
            <Panel className="mt-4 bg-warn-soft">
              <div className="flex items-start gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-attention-soft text-attention">
                  <Moon className="size-5" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-semibold text-ink">{t.activity.wakeTitle}</p>
                    <span className="shrink-0 rounded-full bg-attention-soft px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-attention">
                      {t.activity.standby}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-ink-soft">{t.activity.wakeBody}</p>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Clock className="size-3.5" aria-hidden />
                      {t.activity.lastPing}
                    </span>
                    <Button size="sm" className="rounded-full" onClick={() => toast(t.activity.wakeToast)}>
                      <Radio className="size-4" aria-hidden /> {t.activity.wakeOnLan}
                    </Button>
                  </div>
                </div>
              </div>
            </Panel>
          )}
        </StateFrame>
      </div>

      {/* Bottom actions */}
      <div className="sticky bottom-20 z-20 mt-4 grid grid-cols-2 gap-2 rounded-2xl border border-border bg-card p-2 shadow-float">
        <Button
          variant="secondary"
          className="rounded-full"
          onClick={() => {
            set({ paused: !demo.paused });
            toast(demo.paused ? t.gallery.resume : t.gallery.pausedNote);
          }}
        >
          {demo.paused ? <Play /> : <Pause />} {demo.paused ? t.gallery.resume : t.gallery.pauseAll}
        </Button>
        <Button variant="attention" className="rounded-full" onClick={() => toast(t.activity.syncAllToast)} title={t.activity.syncAllNow}>
          <Zap /> {t.gallery.syncNow}
        </Button>
      </div>
    </div>
  );
}

/** M12 */
export function MobileBackups() {
  const { t } = useI18n();
  const b = backups[0]!;
  return (
    <div>
      <PageHeader code="M12" title={t.backups.title} body={t.backups.m12Body} />
      <StateFrame states={["empty", "offline", "denied", "partial"]}>
        <SectionTitle>{b.device} · {b.source}</SectionTitle>
        <div className="space-y-2">
          {b.versions.map((v) => (
            <Panel key={v.id} className="p-3.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink">{v.label}</p>
                  <p className="text-xs text-muted-foreground">{fmt(t.backups.items, { n: v.items.toLocaleString() })} · {v.size} · MacBook-Ayhan</p>
                </div>
                {v.current && <StatusPill tone="synced">{t.backups.current}</StatusPill>}
              </div>
              <div className="mt-3">
                <ConfirmDialog
                  trigger={<Button size="sm" variant="secondary"><RotateCcw /> {t.backups.restore}</Button>}
                  title={t.backups.restoreConflictTitle}
                  body={t.backups.restoreConflictBody}
                  confirm={t.backups.keepBoth}
                  cancel={t.backups.skipFile}
                  extra={<Notice>{t.backups.restoreTo}: iPhone 15 Pro › Photos › IMG_2046.HEIC</Notice>}
                />
              </div>
            </Panel>
          ))}
        </div>
        <Notice className="mt-4">{t.photo.original}</Notice>
      </StateFrame>
    </div>
  );
}

/** M13 */
export function MobileSettings() {
  const { t, lang, setLang } = useI18n();
  const { demo, reset } = useDemo();
  return (
    <div>
      <PageHeader code="M13" title={t.settings.title} />
      <SectionTitle>{t.settings.backup}</SectionTitle>
      <Panel className="p-1">
        <Row icon={FolderOpen} title={t.nav.sources} meta="M2" to="/m/sources" />
        <Row icon={CalendarClock} title={t.schedule.title} meta="M3" to="/m/schedule" />
        <Row icon={Archive} title={t.nav.backups} meta="M12" to="/m/backups" />
        <Row icon={Signal} title={t.settings.cellular} trailing={<Switch aria-label={t.settings.cellular} />} />
      </Panel>
      <SectionTitle>{t.settings.privacy}</SectionTitle>
      <Panel className="p-1">
        <Row icon={ImageIcon} title={t.settings.photoAccess} trailing={
          <StatusPill tone={demo.photoPermission === "granted" ? "synced" : demo.photoPermission === "limited" ? "review" : "neutral"}>
            {demo.photoPermission === "granted" ? t.status.accessGranted : demo.photoPermission === "limited" ? t.sources.limited : t.common.notConfigured}
          </StatusPill>
        } />
        <Row icon={Bell} title={t.settings.notifications} trailing={<Switch defaultChecked aria-label={t.settings.notifications} />} />
      </Panel>
      <SectionTitle>{t.settings.general}</SectionTitle>
      <Panel className="p-3">
        <p className="mb-2 flex items-center gap-2 text-sm font-medium text-ink"><Languages className="size-4" /> {t.common.language}</p>
        <Segmented label={t.common.language} value={lang} onChange={setLang} options={LANGS.map((l) => ({ id: l.id, label: l.label }))} />
      </Panel>
      <div className="mt-4 space-y-2">
        <ConfirmDialog
          trigger={<Button variant="secondary" className="w-full"><RotateCcw /> {t.settings.rerunSetup}</Button>}
          title={t.settings.rerunSetup}
          body={t.common.demoNote}
          confirm={t.common.continue}
          onConfirm={() => { reset(); window.location.assign("/m/welcome"); }}
        />
      </div>
      <SectionTitle>{t.settings.about}</SectionTitle>
      <Panel className="p-1"><Row icon={Info} title={t.settings.version} trailing={<span className="text-sm text-muted-foreground">0.9.0 (prototype)</span>} /></Panel>
    </div>
  );
}
