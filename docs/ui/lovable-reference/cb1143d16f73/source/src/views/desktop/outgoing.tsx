import { toast } from "sonner";
import { ScheduleControls } from "@/features/schedule/ui";
import { TransferOverview } from "@/widgets/transfer-overview/ui";
import { useDemo } from "@/shared/model/demo-store";
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, ArrowLeft, Cloud, Folder, FolderPlus, LogOut, Pause, Plus, Server } from "lucide-react";
import { useI18n } from "@/shared/i18n";
import { FilterChips, Notice, PageHeader, Panel, Row, SectionTitle, Segmented, StatusPill, DemoBadge } from "@/shared/ui/kit";
import { StateFrame } from "@/shared/ui/state-frame";
import { ConfirmDialog } from "@/shared/ui/confirm-dialog";
import { TrayIcon, AppIcon } from "@/shared/ui/logo";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { JobList, JobSummary } from "@/widgets/job-list/ui";
import { ProviderForm, ProviderPicker } from "@/features/connection-form/ui";
import { outgoingJobs } from "@/entities/job/model";
import { connMatch, getProvider, type ConnFilter, type Provider } from "@/entities/connection/model";
import { cn } from "@/lib/utils";

const outConns = [
  { id: "s3", name: "Amazon S3 · kloda-backups", provider: "amazon-s3", state: "ok" as const, usage: 34, target: "s3://kloda-backups/docs", size: "340 GB / 1 TB" },
  { id: "smb", name: "Ev NAS (SMB)", provider: "smb", state: "offline" as const, usage: 81, target: "smb://192.168.1.20/photos/Kloda", size: "1,62 / 2 TB" },
  { id: "nc", name: "Nextcloud", provider: "nextcloud", state: "reauth" as const, usage: 12, target: "https://cloud.example.com/Kloda", size: "24 / 200 GB" },
];

/** D8 */
export function DesktopConnections() {
  const { t } = useI18n();
  const [filter, setFilter] = useState<ConnFilter>("all");
  const list = outConns.filter((c) => connMatch(filter, c.state));
  return (
    <div>
      <PageHeader code="D8" title={t.conn.d8Title} body={t.conn.d8Body} actions={<Button size="sm" asChild><Link to="/d/connections/new"><Plus /> {t.conn.add}</Link></Button>} />
      <StateFrame states={["empty", "loading", "offline", "reauth", "full"]} emptyAction={<Button asChild><Link to="/d/connections/new">{t.conn.add}</Link></Button>}>
        <div className="mb-5 grid grid-cols-2 gap-3 border-b border-border pb-5 lg:grid-cols-4">
          {([{ label: t.gallery.destinations, value: outConns.length, tone: "bg-muted" }, { label: t.conn.filterOnline, value: outConns.filter(c => c.state === "ok").length, tone: "bg-synced-soft" }, { label: t.conn.filterOffline, value: outConns.filter(c => c.state === "offline").length, tone: "bg-muted" }, { label: t.conn.filterAttention, value: outConns.filter(c => c.state === "reauth").length, tone: "bg-attention-soft" }]).map(x => <div key={x.label} className={cn("rounded-xl p-4", x.tone)}><p className="text-2xl font-semibold tabular-nums text-ink">{x.value}</p><p className="mt-1 text-xs text-ink-soft">{x.label}</p></div>)}
        </div>
        <FilterChips
          label={t.conn.d8Title}
          value={filter}
          onChange={setFilter}
          className="mb-3"
          options={[
            { id: "all", label: t.conn.filterAll },
            { id: "online", label: t.conn.filterOnline, dot: "bg-synced" },
            { id: "offline", label: t.conn.filterOffline, dot: "bg-pending" },
            { id: "attention", label: t.conn.filterAttention, icon: AlertTriangle },
          ]}
        />
        {list.length === 0 && (
          <p className="rounded-2xl border border-dashed border-input bg-surface px-4 py-8 text-center text-sm text-muted-foreground">
            {t.conn.filterEmpty}
          </p>
        )}
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {list.map((c) => {
            const p = getProvider(c.provider);
            if (!p) return null;
            return (
              <Link key={c.id} to="/d/connections/$id" params={{ id: c.id }} className="rounded-2xl border border-border bg-card p-4 shadow-card transition-colors hover:bg-accent">
                <div className="flex items-center justify-between gap-2">
                  <span className="grid size-10 place-items-center rounded-xl bg-muted text-ink-soft">{p.kind === "cloud" ? <Cloud className="size-5" /> : <Server className="size-5" />}</span>
                  <StatusPill tone={c.state === "ok" ? "synced" : c.state === "offline" ? "pending" : "review"}>
                    {c.state === "ok" ? t.status.online : c.state === "offline" ? t.status.offline : t.states.reauth}
                  </StatusPill>
                </div>
                <p className="mt-3 truncate font-medium text-ink">{c.name}</p>
                <p className="text-xs text-muted-foreground">{p.name} · {p.code}</p>
                <p className="mt-3 truncate rounded-lg bg-muted px-2 py-1.5 font-mono text-[11px] text-ink-soft" title={c.target}>{c.target}</p>
                <div className="mt-3 flex justify-between gap-2 text-xs text-muted-foreground"><span>{c.size}</span><span>{c.usage}%</span></div>
                <Progress value={c.usage} className={cn("mt-2 h-1.5 bg-muted", c.state === "ok" ? "[&>div]:bg-ink" : "[&>div]:bg-attention")} aria-label={t.conn.usage} />
              </Link>
            );
          })}
        </div>
      </StateFrame>
    </div>
  );
}

/** D9 — add */
export function DesktopAddConnection() {
  const { t } = useI18n();
  return (
    <div>
      <Link to="/d/connections" className="mb-2 inline-flex min-h-12 items-center gap-2 text-sm text-ink-soft"><ArrowLeft className="size-4" />{t.nav.connections}</Link>
      <PageHeader code="D9" title={t.conn.add} body={t.conn.chooseProvider} />
      <ProviderPicker base="/d" />
    </div>
  );
}

export function DesktopProviderForm({ provider }: { provider: Provider }) {
  const { t } = useI18n();
  return (
    <div className="max-w-2xl">
      <Link to="/d/connections/new" className="mb-2 inline-flex min-h-12 items-center gap-2 text-sm text-ink-soft"><ArrowLeft className="size-4" />{t.conn.chooseProvider}</Link>
      <PageHeader code={`D9 · ${provider.code}`} title={provider.name} />
      <ProviderForm provider={provider} base="/d" />
    </div>
  );
}

/** D9 — detail */
export function DesktopConnectionDetail({ id }: { id: string }) {
  const { t } = useI18n();
  const c = outConns.find((x) => x.id === id);
  const p = c ? getProvider(c.provider) : undefined;
  if (!c || !p) return <Notice>{t.conn.filterEmpty}</Notice>;
  return (
    <div className="max-w-3xl">
      <Link to="/d/connections" className="mb-2 inline-flex min-h-12 items-center gap-2 text-sm text-ink-soft"><ArrowLeft className="size-4" />{t.nav.connections}</Link>
      <PageHeader code="D9" title={c.name} body={`${p.name} · ${p.code}`} />
      <StateFrame states={["offline", "reauth", "full", "denied"]}>
        <Panel className="space-y-3">
          <div><p className="text-xs text-muted-foreground">{t.conn.pathLabel}</p><p className="mt-1 break-all font-mono text-sm text-ink">{c.target}</p></div>
          <div className="flex justify-between text-sm"><span className="text-muted-foreground">{t.conn.lastSync}</span><span className="text-ink">Dün 02:00</span></div>
          <div><div className="mb-1 flex justify-between text-xs text-muted-foreground"><span>{t.conn.usage}</span><span>{c.usage}%</span></div><Progress value={c.usage} className="h-1.5 bg-muted" /></div>
          {p.security === "unknown" && <StatusPill tone="review">{t.status.unknownSecurity}</StatusPill>}
          {p.auth === "tbd" && <Notice tone="warn">{t.conn.authTbd}</Notice>}
        </Panel>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="secondary" asChild><Link to="/d/jobs">{t.nav.jobs}</Link></Button>
          <Button variant="secondary" onClick={() => toast(c.state === "ok" ? t.conn.testOk : t.conn.testFail)}>{t.conn.test}</Button>
          <Button variant="secondary" onClick={() => toast(t.conn.toggleToast)}><Pause /> {t.conn.disable}</Button>
          <ConfirmDialog trigger={<Button variant="ghost" className="text-danger">{t.conn.remove}</Button>} title={`${t.conn.remove}?`} body={t.conn.removeNote} confirm={t.conn.remove} destructive />
        </div>
      </StateFrame>
    </div>
  );
}

/** D10 */
export function DesktopSources() {
  const { t } = useI18n();

  const [folders, setFolders] = useState(["~/Belgeler", "~/Projeler", "~/Fotoğraflar/2025", "~/Kloda Yedekleri"]);
  return (
    <div>
      <PageHeader code="D10" title={t.sources.d10Title} body={t.sources.d10Body} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel className="p-2">
          {folders.map((f) => <Row key={f} icon={Folder} title={f} meta="→ Amazon S3" trailing={<Switch defaultChecked aria-label={f} />} />)}
          <div className="p-2"><Button variant="secondary" className="w-full" onClick={() => { setFolders(v => [...v, `~/Documents/Kloda-${v.length + 1}`]); toast(t.gallery.demoAction); }}><FolderPlus /> {t.sources.addFolder}</Button></div>
        </Panel>
        <div><SectionTitle>{t.schedule.title}</SectionTitle><ScheduleControls /></div>
      </div>
    </div>
  );
}

/** D11 */
export function DesktopJobs() {
  const { t } = useI18n();
  return (
    <div>
      <PageHeader code="D11" title={t.activity.d11Title} body={t.activity.d11Body} />
      <StateFrame states={["empty", "loading", "offline", "reauth", "interrupted", "partial", "full"]}>
        <TransferOverview jobs={outgoingJobs} />
        <JobSummary jobs={outgoingJobs} />
        <JobList jobs={outgoingJobs} />
      </StateFrame>
    </div>
  );
}

/** D12 */
export function DesktopSettings() {
  const { t } = useI18n();
  const [close, setClose] = useState<"tray" | "quit">("tray");
  return (
    <div className="max-w-3xl">
      <PageHeader code="D12" title={t.settings.title} />
      <SectionTitle>{t.settings.background}</SectionTitle>
      <Panel className="space-y-3">
        <p className="text-sm font-medium text-ink">{t.settings.closeBehavior}</p>
        <Segmented label={t.settings.closeBehavior} value={close} onChange={setClose} options={[{ id: "tray", label: t.settings.closeToTray }, { id: "quit", label: t.settings.closeQuits }]} />
        <Row title={t.setup.autostart} meta={t.setup.autostartHint} trailing={<Switch aria-label={t.setup.autostart} />} className="px-0" />
        <Notice tone="warn">{t.settings.autostartBlocked}</Notice>
        <Notice>{t.settings.linuxNoTray}</Notice>
        <Notice>{t.settings.sleepNote}</Notice>
      </Panel>
      <SectionTitle>{t.settings.general}</SectionTitle>
      <Panel className="p-1">
        <Row title={t.settings.rerunSetup} to="/d/welcome" />
        <Row title={t.settings.version} trailing={<span className="text-sm text-muted-foreground">0.9.0 (prototype)</span>} />
      </Panel>
      <div className="mt-6"><QuitButton /></div>
    </div>
  );
}

function QuitButton({ compact }: { compact?: boolean }) {
  const { t } = useI18n();
  return (
    <ConfirmDialog
      trigger={<Button variant={compact ? "ghost" : "secondary"} className={cn(compact && "w-full justify-start")}><LogOut /> {t.settings.quit}</Button>}
      title={t.settings.quitTitle} body={t.settings.quitBody} confirm={t.settings.quitConfirm} cancel={t.settings.keepRunning} destructive
    />
  );
}

/** D13 */
export function DesktopTray() {
  const { t } = useI18n();
  return (
    <div>
      <PageHeader code="D13" title={t.tray.title} body={t.tray.platforms} />
      <div className="flex flex-wrap items-start gap-8">
        <div className="w-72 rounded-2xl border border-border bg-popover p-2 shadow-float animate-rise">
          <div className="flex items-center gap-3 p-2">
            <AppIcon className="size-9" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-ink">Kloda</p>
              <StatusPill tone="syncing">{t.tray.receiving}</StatusPill>
            </div>
          </div>
          <p className="px-2 pb-2 text-xs text-muted-foreground">{t.tray.incoming}</p>
          <div className="border-t border-border py-1">
            <Button variant="ghost" className="w-full justify-start" asChild><Link to="/d">{t.tray.openWindow}</Link></Button>
            <Button variant="ghost" className="w-full justify-start" onClick={() => toast(t.gallery.pausedNote)}>{t.tray.pauseIncoming}</Button>
            <Button variant="ghost" className="w-full justify-start" onClick={() => toast(t.gallery.pausedNote)}>{t.tray.pauseOutgoing}</Button>
          </div>
          <div className="border-t border-border pt-1"><QuitButton compact /></div>
        </div>
        <Panel className="space-y-3">
          <p className="text-sm font-semibold text-ink">{t.brand.tray}</p>
          <div className="flex items-center gap-4">
            <span className="grid h-7 place-items-center rounded-md bg-ink px-2 text-brand-foreground"><TrayIcon className="size-4" /></span>
            <span className="grid h-7 place-items-center rounded-md bg-muted px-2 text-ink"><TrayIcon className="size-4" /></span>
            <span className="grid size-7 place-items-center rounded-md bg-muted text-ink"><TrayIcon className="size-5" /></span>
          </div>
          <DemoBadge />
        </Panel>
      </div>
    </div>
  );
}
