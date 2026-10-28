import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { AlertTriangle, ArrowLeft, Camera, Check, ChevronRight, Cloud, FolderOpen, HardDrive, Laptop, Plus, QrCode, Server, ShieldAlert, ShieldCheck, Wifi } from "lucide-react";
import { useI18n, fmt } from "@/shared/i18n";
import { useDemo } from "@/shared/model/demo-store";
import { EmptyState, FilterChips, Notice, PageHeader, Panel, SectionTitle, StatusPill, DemoBadge } from "@/shared/ui/kit";
import { StateFrame } from "@/shared/ui/state-frame";
import { ConfirmDialog } from "@/shared/ui/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { ProviderForm, ProviderPicker } from "@/features/connection-form/ui";
import { connections, connMatch, getProvider, type ConnFilter, type Connection, type Provider } from "@/entities/connection/model";
import { cn } from "@/lib/utils";

export const connTone = (c: Connection) =>
  c.state === "ok" ? "synced" : c.state === "offline" || c.state === "paused" ? "pending" : c.state === "full" ? "danger" : "review";
export const useConnLabel = () => {
  const { t } = useI18n();
  return (c: Connection) =>
    ({ ok: t.status.online, offline: t.status.offline, reauth: t.states.reauth, full: t.states.full, paused: t.status.paused, noAccess: t.status.noAccess })[c.state];
};

/** M6 */
export function MobileConnections() {
  const { t } = useI18n();
  const { demo } = useDemo();
  const [filter, setFilter] = useState<ConnFilter>("all");
  const has = demo.pcPaired || demo.connections > 0;
  const list = connections.filter((c) => connMatch(filter, c.state));
  return (
    <div>
      <PageHeader code="M6" title={t.conn.title} body={t.conn.subtitle} actions={
        <Button size="sm" asChild><Link to="/m/connections/new"><Plus /> {t.conn.add}</Link></Button>
      } />
      {!has ? (
        <EmptyState
          icon={Cloud}
          title={t.gallery.noConn}
          body={t.conn.pairPcBody}
          action={
            <div className="flex flex-col gap-2">
              <Button asChild><Link to="/m/pair-pc"><Laptop /> {t.gallery.noPairCta}</Link></Button>
              <Button variant="secondary" asChild><Link to="/m/connections/new">{t.conn.add}</Link></Button>
            </div>
          }
        />
      ) : (
        <StateFrame states={["loading", "offline", "reauth"]}>
          {/* Capacity summary */}
          <Panel className="mb-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">{t.conn.capacity}</p>
              <HardDrive className="size-4 text-muted-foreground" aria-hidden />
            </div>
            <p className="mt-1.5 text-[34px] font-bold leading-none tracking-tight text-ink">
              14,2 <span className="text-lg font-semibold">TB</span>
            </p>
            <div className="mt-3 flex h-2 gap-0.5 overflow-hidden rounded-full bg-muted">
              <span className="h-full w-[34%] rounded-full bg-ink" />
              <span className="h-full w-[9%] rounded-full bg-attention" />
            </div>
            <div className="mt-1.5 flex items-center justify-between gap-2 text-xs text-muted-foreground">
              <span>4,8 TB {t.conn.photosVideos}</span>
              <span>9,4 TB {t.conn.free}</span>
            </div>
            <div className="mt-3 rounded-xl bg-synced-soft p-3">
              <p className="flex items-center gap-1.5 text-sm font-semibold text-synced">
                <span className="size-1.5 rounded-full bg-synced" aria-hidden />
                {t.conn.redundant}
              </p>
              <p className="mt-0.5 text-xs text-ink-soft">{fmt(t.conn.mirrored, { n: 2 })}</p>
            </div>
          </Panel>

          <div className="mb-2 flex items-center justify-between gap-2 px-1">
            <h2 className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
              {fmt(t.conn.nodesMirrors, { n: connections.length })}
            </h2>
            <span className="text-[11px] font-medium text-muted-foreground">{t.conn.zeroCloud}</span>
          </div>

          <FilterChips
            className="mb-3"
            label={t.conn.title}
            value={filter}
            onChange={setFilter}
            options={[
              { id: "all", label: t.conn.filterAll },
              { id: "online", label: t.conn.filterOnline, dot: "bg-synced" },
              { id: "offline", label: t.conn.filterOffline, dot: "bg-attention" },
              { id: "attention", label: t.conn.filterAttention, icon: AlertTriangle },
            ]}
          />

          {list.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-input bg-surface px-4 py-8 text-center text-sm text-muted-foreground">
              {t.conn.filterEmpty}
            </p>
          ) : (
            <div className="space-y-3">
              {list.map((c) => (
                <NodeCard key={c.id} c={c} />
              ))}
              <Link
                to="/m/connections/new"
                className="flex items-center gap-3 rounded-2xl bg-ink p-4 text-background shadow-card transition-transform hover:scale-[1.01]"
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-background/10">
                  <Plus className="size-5" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">{t.conn.addDestination}</span>
                  <span className="block truncate text-xs text-background/60">{t.conn.addDestinationBody}</span>
                </span>
                <ChevronRight className="size-4 shrink-0 text-background/60" aria-hidden />
              </Link>
            </div>
          )}

          <SectionTitle>{t.conn.rules}</SectionTitle>
          <Panel>
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-muted text-ink-soft">
                  <FolderOpen className="size-5" aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink">{t.conn.autoFree}</p>
                  <p className="mt-0.5 text-xs text-ink-soft">{t.conn.autoFreeBody}</p>
                </div>
              </div>
              <Switch aria-label={t.conn.autoFree} onCheckedChange={() => toast(t.conn.toggleToast)} />
            </div>
            <p className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-synced">
              <span className="size-1.5 rounded-full bg-synced" aria-hidden />
              {t.conn.protection}
            </p>
          </Panel>
          <div className="mt-3 flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5 text-xs text-muted-foreground shadow-card">
            <ShieldCheck className="size-4 shrink-0 text-synced" aria-hidden />
            <span className="min-w-0 flex-1">{t.conn.checksum}</span>
            <Link to="/m/settings" className="shrink-0 font-medium text-ink underline underline-offset-2">{t.nav.settings}</Link>
          </div>
        </StateFrame>
      )}
    </div>
  );
}

function NodeCard({ c }: { c: Connection }) {
  const { t } = useI18n();
  const label = useConnLabel();
  const Icon = c.providerId === "computer" ? Laptop : c.providerId === "webdav" ? Server : Cloud;
  const provider = c.providerId === "computer" ? null : getProvider(c.providerId);
  const tone = connTone(c);
  const ok = c.state === "ok";
  const roleLabel = c.role === "primary" ? t.conn.primary : c.role === "mirror" ? t.conn.mirror : t.conn.standby;
  return (
    <Panel className="p-4">
      <Link to="/m/connections/$id" params={{ id: c.id }} className="block">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-muted text-ink-soft">
              <Icon className="size-5" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="truncate text-[15px] font-semibold text-ink">{c.name}</p>
              <p className="truncate text-xs text-muted-foreground">{provider ? provider.name : t.conn.computers}</p>
            </div>
          </div>
          <StatusPill tone={tone}>{label(c)}</StatusPill>
        </div>
        <p className="mt-3 flex items-center gap-1.5 text-xs font-medium text-ink-soft">
          <span className={cn("size-1.5 rounded-full", ok ? "bg-synced" : tone === "pending" ? "bg-pending" : "bg-attention")} aria-hidden />
          {label(c)}
          {c.speed ? ` • ${c.speed}` : ""}
        </p>
        <span className="mt-2 inline-block max-w-full truncate rounded-md bg-muted px-2 py-1 font-mono text-[11px] text-ink-soft">
          {c.target}
        </span>
        {c.usage && (
          <div className="mt-3">
            <Progress
              value={c.usage.used}
              className={cn("h-1.5 bg-muted", ok ? "[&>div]:bg-ink" : "[&>div]:bg-attention")}
              aria-label={t.conn.usage}
            />
            <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
              <span>{c.usage.label}</span>
              <span className="tabular-nums">{c.usage.used}%</span>
            </div>
          </div>
        )}
      </Link>
      <div className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-3">
        <span className="truncate text-[11px] text-muted-foreground">
          {t.conn.lastSync}: {c.lastSync}
        </span>
        {c.role !== "standby" ? (
          <span className="flex shrink-0 items-center gap-2">
            <span className="text-[11px] font-medium text-muted-foreground">{roleLabel}</span>
            <Switch
              defaultChecked={c.state === "ok"}
              aria-label={roleLabel}
              onCheckedChange={() => toast(t.conn.toggleToast)}
            />
          </span>
        ) : (
          <Button size="sm" variant="secondary" className="shrink-0 rounded-full" onClick={() => toast(t.activity.syncAllToast)}>
            {t.conn.syncNow}
          </Button>
        )}
      </div>
    </Panel>
  );
}

/** M7 */
export function MobileAddConnection() {
  const { t } = useI18n();
  return (
    <div>
      <Link to="/m/connections" className="mb-2 inline-flex min-h-12 items-center gap-2 text-sm text-ink-soft"><ArrowLeft className="size-4" />{t.conn.title}</Link>
      <PageHeader code="M7" title={t.conn.add} body={t.conn.chooseProvider} />
      <ProviderPicker base="/m" />
    </div>
  );
}

/** P1–P5 / C1–C11 (mobile) */
export function MobileProviderForm({ provider }: { provider: Provider }) {
  const { t } = useI18n();
  return (
    <div>
      <Link to="/m/connections/new" className="mb-2 inline-flex min-h-12 items-center gap-2 text-sm text-ink-soft"><ArrowLeft className="size-4" />{t.conn.chooseProvider}</Link>
      <PageHeader code={`M7 · ${provider.code}`} title={provider.name} />
      <ProviderForm provider={provider} />
    </div>
  );
}

/** M8 */
export function MobilePairPc() {
  const { t } = useI18n();
  const steps = [
    { icon: Laptop, text: t.pair.step1 },
    { icon: QrCode, text: t.pair.step2 },
    { icon: ShieldAlert, text: t.pair.step3, onPc: true },
  ];
  return (
    <div>
      <PageHeader code="M8" title={t.pair.m8Title} body={t.pair.m8Body} />
      <ol className="space-y-2">
        {steps.map((s, i) => (
          <li key={i}>
            <Panel className="flex items-start gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-muted text-ink-soft"><s.icon className="size-5" aria-hidden /></span>
              <div>
                <p className="text-xs font-semibold text-muted-foreground">{i + 1}</p>
                <p className="text-sm text-ink">{s.text}</p>
                {s.onPc && <StatusPill tone="neutral" className="mt-2">{t.common.desktop}</StatusPill>}
              </div>
            </Panel>
          </li>
        ))}
      </ol>
      <Notice tone="warn" className="mt-4">{t.pair.phoneCant}</Notice>
      <Notice icon={Wifi} className="mt-2">{t.pair.lanOnly}</Notice>
      <div className="mt-6 space-y-2">
        <Button className="w-full" asChild><Link to="/m/pair-qr"><Camera /> {t.pair.scan}</Link></Button>
        <Button variant="ghost" className="w-full" asChild><Link to="/m">{t.common.skip}</Link></Button>
      </div>
    </div>
  );
}

/** M9 */
export function MobilePairQr() {
  const { t } = useI18n();
  const { set, demo } = useDemo();
  const nav = useNavigate();
  const [done, setDone] = useState(demo.pcPaired);
  return (
    <div>
      <PageHeader code="M9" title={t.pair.m9Title} body={t.pair.m9Body} />
      {!done ? (
        <>
          <div className="relative mx-auto grid aspect-square w-full max-w-xs place-items-center overflow-hidden rounded-3xl bg-ink">
            <div className="size-3/5 rounded-3xl border-4 border-brand-ring/80" />
            <span className="absolute bottom-3 left-0 right-0 text-center text-xs text-brand-foreground/70">{t.pair.cameraDemo}</span>
          </div>
          <Button className="mt-6 w-full" onClick={() => { setDone(true); set({ pcPaired: true }); }}>
            {t.pair.simulate}
          </Button>
        </>
      ) : (
        <div className="space-y-4 animate-rise">
          <Panel className="text-center">
            <span className="mx-auto grid size-14 place-items-center rounded-full bg-synced-soft text-synced"><Check className="size-7" /></span>
            <p className="mt-3 font-semibold text-ink">{t.pair.pairedTitle}</p>
            <p className="mt-1 text-sm text-muted-foreground">{t.pair.pairedBody}</p>
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              <StatusPill tone="synced">{t.status.paired}</StatusPill>
              <StatusPill tone="pending">{demo.pcAccessGranted ? t.status.accessGranted : t.pair.waitingAccess}</StatusPill>
            </div>
          </Panel>
          <DemoBadge />
          <Button className="w-full" onClick={() => nav({ to: "/m/connections/$id", params: { id: "macbook" } })}>{t.common.continue}</Button>
        </div>
      )}
    </div>
  );
}

/** M10 */
export function MobileConnectionDetail({ conn }: { conn: Connection }) {
  const { t } = useI18n();
  const label = useConnLabel();
  const provider = conn.providerId === "computer" ? null : getProvider(conn.providerId);
  return (
    <div>
      <Link to="/m/connections" className="mb-2 inline-flex min-h-12 items-center gap-2 text-sm text-ink-soft"><ArrowLeft className="size-4" />{t.conn.title}</Link>
      <PageHeader code="M10" title={conn.name} body={provider ? `${provider.name} · ${provider.code}` : t.conn.computers} />
      <StateFrame states={["offline", "denied", "reauth", "full"]}>
        <Panel className="space-y-3">
          <div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">{t.conn.statusLabel}</span><StatusPill tone={connTone(conn)}>{label(conn)}</StatusPill></div>
          <div><p className="text-xs text-muted-foreground">{t.conn.pathLabel}</p><p className="break-all text-sm text-ink">{conn.target}</p></div>
          <div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">{t.conn.lastSync}</span><span className="text-sm text-ink">{conn.lastSync}</span></div>
          {conn.usage && (
            <div>
              <div className="mb-1 flex justify-between text-xs text-muted-foreground"><span>{t.conn.usage}</span><span>{conn.usage.label}</span></div>
              <Progress value={conn.usage.used} className="h-1.5 bg-muted" aria-label={t.conn.usage} />
            </div>
          )}
          {provider?.security === "unknown" && <StatusPill tone="review">{t.status.unknownSecurity}</StatusPill>}
        </Panel>
        {conn.providerId === "computer" && (
          <Notice className="mt-3">{t.pair.phoneCant}</Notice>
        )}
        {conn.state === "reauth" && <Notice tone="warn" className="mt-3">{t.states.reauthBody}</Notice>}
        <SectionTitle>{t.common.manage}</SectionTitle>
        <div className="space-y-2">
          <Button variant="secondary" className="w-full" asChild><Link to="/m/activity">{t.nav.activity}</Link></Button>
          <Button variant="secondary" className="w-full" asChild><Link to="/m/backups">{t.nav.backups}</Link></Button>
          <Button variant="secondary" className="w-full" onClick={() => toast(t.conn.toggleToast)}>{t.conn.disable}</Button>
          <ConfirmDialog
            trigger={<Button variant="ghost" className="w-full text-danger">{t.conn.remove}</Button>}
            title={`${t.conn.remove}?`}
            body={t.conn.removeNote}
            confirm={t.conn.remove}
            destructive
          />
        </div>
      </StateFrame>
    </div>
  );
}
