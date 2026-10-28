import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Archive, Check, Download, FolderOpen, Laptop, QrCode, RefreshCw, RotateCcw, Smartphone, Trash2, Undo2 } from "lucide-react";
import { useI18n, fmt } from "@/shared/i18n";
import { useDemo } from "@/shared/model/demo-store";
import { WelcomeIllustration } from "@/shared/ui/welcome-illustration";
import { AppIcon } from "@/shared/ui/logo";
import { DemoQr } from "@/shared/ui/demo-qr";
import { DemoBadge, EmptyState, Notice, PageHeader, Panel, Row, SectionTitle, StatusPill } from "@/shared/ui/kit";
import { StateFrame } from "@/shared/ui/state-frame";
import { ConfirmDialog } from "@/shared/ui/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { TransferOverview } from "@/widgets/transfer-overview/ui";
import { JobList, JobSummary } from "@/widgets/job-list/ui";
import { incomingJobs } from "@/entities/job/model";
import { backups, devices, trashItems, type Device } from "@/entities/device/model";

/** D1 */
export function DesktopWelcome() {
  const { t } = useI18n();
  const { demo, set } = useDemo();
  const nav = useNavigate();
  return (
    <div className="mx-auto grid max-w-4xl grid-cols-[minmax(0,1fr)] items-center gap-10 py-6 lg:grid-cols-2">
      <div className="min-w-0 animate-rise">
        <AppIcon className="size-24" animated title="Kloda" />
        <span className="mt-6 block font-mono text-[10px] text-muted-foreground">D1</span>
        <h1 className="mt-1 break-words text-[32px] font-semibold leading-tight text-ink sm:text-[40px]">{t.setup.d1Title}</h1>
        <p className="mt-3 text-ink-soft">{t.setup.d1Body}</p>
        <WelcomeIllustration className="mt-6 w-full max-w-[340px]" />
      </div>
      <Panel className="space-y-4 p-6">
        <p className="text-sm font-semibold text-ink">{t.setup.chooseFolder}</p>
        {demo.desktopFolder ? (
          <Notice tone="ok" icon={Check}>{t.setup.folderChosen}: <span className="break-all font-medium">{demo.desktopFolder}</span></Notice>
        ) : (
          <Button variant="secondary" className="w-full" onClick={() => set({ desktopFolder: "/Users/ayhan/Kloda Yedekleri" })}>
            <FolderOpen /> {t.setup.chooseFolder}
          </Button>
        )}
        <p className="text-xs text-muted-foreground">{t.setup.folderHint}</p>
        <Row title={t.setup.autostart} meta={t.setup.autostartHint} trailing={<Switch aria-label={t.setup.autostart} />} className="px-0" />
        <p className="text-xs text-muted-foreground">{t.setup.d1Next}</p>
        <Button className="w-full" disabled={!demo.desktopFolder} onClick={() => nav({ to: "/d/pair" })}>{t.common.continue}</Button>
        <Button variant="ghost" className="w-full" onClick={() => nav({ to: "/d" })}>{t.common.skip}</Button>
      </Panel>
    </div>
  );
}

/** D2 */
export function DesktopHome() {
  const { t } = useI18n();
  const { demo, loadFull } = useDemo();
  const ready = !!demo.desktopFolder;
  const online = devices.filter((d) => d.online && d.access === "granted").length;
  return (
    <div>
      <PageHeader code="D2" title={t.nav.home} body={t.setup.d1Body} actions={!ready && <Button size="sm" variant="ghost" onClick={loadFull}>{t.common.demo}: {t.states.success}</Button>} />
      {!ready ? (
        <div className="grid gap-3 md:grid-cols-2">
          <Panel><Row icon={FolderOpen} title={t.common.notConfigured} meta={t.setup.chooseFolder} to="/d/welcome" /></Panel>
          <Panel><Row icon={QrCode} title={t.gallery.noPair} meta={t.nav.pair} to="/d/pair" /></Panel>
        </div>
      ) : (
        <StateFrame states={["loading", "denied", "full", "interrupted", "unsupported"]}>
          <div className="grid gap-3 md:grid-cols-3">
            <Panel className="md:col-span-2">
              <div className="flex items-center justify-between"><p className="text-sm font-semibold text-ink">{t.tray.receiving}</p><StatusPill tone={demo.paused ? "pending" : "syncing"}>{demo.paused ? t.status.paused : t.status.syncing}</StatusPill></div>
              <p className="mt-2 break-all text-sm text-muted-foreground">{demo.desktopFolder}</p>
              <p className="mt-4 text-[40px] font-semibold tabular-nums tracking-tight text-ink">{online}/{devices.length}</p>
              <p className="text-sm text-muted-foreground">{t.nav.devices} · {t.status.online} + {t.status.accessGranted}</p>
              <Notice className="mt-4">{t.settings.sleepNote}</Notice>
            </Panel>
            <Panel className="space-y-1 p-2">
              <Row icon={Download} title={t.nav.incoming} meta={fmt(t.activity.files, { n: 24 })} to="/d/incoming" />
              <Row icon={Smartphone} title={t.nav.devices} meta={`${devices.length}`} to="/d/devices" />
              <Row icon={Archive} title={t.nav.backups} to="/d/backups" />
            </Panel>
          </div>
          <SectionTitle>{t.activity.active}</SectionTitle>
          <JobList jobs={incomingJobs.filter((j) => j.status === "syncing")} />
        </StateFrame>
      )}
    </div>
  );
}

/** D3 */
export function DesktopPair() {
  const { t } = useI18n();
  const [req, setReq] = useState<"none" | "incoming" | "approved">("none");
  return (
    <div>
      <PageHeader code="D3" title={t.pair.d3Title} body={t.pair.d3Body} />
      <div className="grid gap-6 md:grid-cols-[minmax(0,320px)_1fr]">
        <Panel className="p-6">
          <DemoQr className="w-full" />
          <div className="mt-4 flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{t.pair.code}</span><span className="font-mono font-semibold text-ink">K7Q-4M2</span>
          </div>
          <div className="mt-1 flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{t.pair.expires}</span><span className="tabular-nums text-ink">1:42</span>
          </div>
          <Button variant="secondary" className="mt-4 w-full"><RefreshCw /> {t.pair.refresh}</Button>
        </Panel>
        <div className="space-y-3">
          <Notice>{t.pair.lanOnly}</Notice>
          <Notice tone="warn">{t.pair.phoneCant}</Notice>
          {req === "none" && <Button variant="secondary" onClick={() => setReq("incoming")}>{t.pair.simulate} <DemoBadge /></Button>}
          {req === "incoming" && (
            <Panel className="animate-rise">
              <p className="text-sm font-semibold text-ink">{t.pair.incomingRequest}</p>
              <p className="mt-1 text-sm text-muted-foreground">Pixel 8 · Android 15</p>
              <p className="mt-2 text-xs text-muted-foreground">{t.pair.approveNote}</p>
              <div className="mt-3 flex gap-2">
                <Button onClick={() => setReq("approved")}>{t.pair.approve}</Button>
                <Button variant="ghost" onClick={() => setReq("none")}>{t.pair.reject}</Button>
              </div>
            </Panel>
          )}
          {req === "approved" && (
            <Panel className="animate-rise">
              <StatusPill tone="synced">{t.status.paired}</StatusPill> <StatusPill tone="pending">{t.status.noAccess}</StatusPill>
              <p className="mt-2 text-sm text-muted-foreground">{t.pair.step3}</p>
              <Button className="mt-3" asChild><Link to="/d/devices">{t.devices.grant}</Link></Button>
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}

function DeviceCard({ d }: { d: Device }) {
  const { t } = useI18n();
  return (
    <Panel>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-muted text-ink-soft"><Smartphone className="size-5" /></span>
          <div className="min-w-0">
            <p className="truncate font-medium text-ink" title={d.name}>{d.name}</p>
            <p className="text-xs text-muted-foreground">{d.platform} · {t.devices.lastSeen}: {d.lastSeen}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <StatusPill tone={d.online ? "synced" : "pending"}>{d.online ? t.status.online : t.status.offline}</StatusPill>
          <StatusPill tone={d.access === "granted" ? "synced" : d.access === "revoked" ? "danger" : "review"}>
            {d.access === "granted" ? t.status.accessGranted : d.access === "revoked" ? t.status.revoked : t.status.noAccess}
          </StatusPill>
        </div>
      </div>
      <p className="mt-3 break-all text-xs text-muted-foreground">{t.devices.folder}: {d.folder}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {d.access === "granted" ? (
          <ConfirmDialog trigger={<Button size="sm" variant="secondary">{t.devices.revoke}</Button>} title={t.dialogs.revokeTitle} body={t.dialogs.revokeBody} confirm={t.dialogs.revokeConfirm} destructive />
        ) : (
          <ConfirmDialog trigger={<Button size="sm">{t.devices.grant}</Button>} title={t.dialogs.accessTitle} body={t.dialogs.accessBody} confirm={t.dialogs.accessConfirm}
            extra={<Button variant="secondary" size="sm"><FolderOpen /> {t.setup.chooseFolder}</Button>} />
        )}
        <ConfirmDialog trigger={<Button size="sm" variant="ghost" className="text-danger">{t.devices.remove}</Button>} title={t.dialogs.removeTitle} body={t.dialogs.removeBody} confirm={t.dialogs.removeConfirm} destructive />
      </div>
    </Panel>
  );
}

/** D4 */
export function DesktopDevices() {
  const { t } = useI18n();
  return (
    <div>
      <PageHeader code="D4" title={t.devices.title} body={t.devices.body} actions={<Button size="sm" asChild><Link to="/d/pair"><QrCode /> {t.nav.pair}</Link></Button>} />
      <Notice className="mb-4">{t.devices.actionsNote}</Notice>
      <StateFrame states={["empty", "loading", "denied"]} emptyAction={<Button asChild><Link to="/d/pair">{t.nav.pair}</Link></Button>}>
        <div className="grid grid-cols-[minmax(0,1fr)] gap-3 lg:grid-cols-2">{devices.map((d) => <DeviceCard key={d.id} d={d} />)}</div>
      </StateFrame>
    </div>
  );
}

/** D5 */
export function DesktopIncoming() {
  const { t } = useI18n();
  return (
    <div>
      <PageHeader code="D5" title={t.activity.d5Title} body={t.activity.d5Body} />
      <StateFrame states={["empty", "loading", "full", "interrupted", "partial"]}>
        <TransferOverview jobs={incomingJobs} />
        <JobSummary jobs={incomingJobs} />
        <JobList jobs={incomingJobs} />
      </StateFrame>
    </div>
  );
}

/** D6 */
export function DesktopBackups() {
  const { t } = useI18n();
  return (
    <div>
      <PageHeader code="D6" title={t.backups.d6Title} body={t.backups.d6Body} />
      <StateFrame states={["empty", "loading", "denied"]}>
        <div className="space-y-6">
          {backups.map((b) => (
            <div key={b.deviceId}>
              <SectionTitle>{b.device} · {b.source}</SectionTitle>
              <div className="space-y-2">
                {b.versions.map((v) => (
                  <Panel key={v.id} className="flex flex-wrap items-center justify-between gap-3 p-3.5">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-ink">{v.label} {v.current && <StatusPill tone="synced" className="ml-1">{t.backups.current}</StatusPill>}</p>
                      <p className="text-xs text-muted-foreground">{fmt(t.backups.items, { n: v.items.toLocaleString() })} · {v.size}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <ConfirmDialog trigger={<Button size="sm" variant="secondary"><RotateCcw /> {t.backups.rebackup}</Button>} title={t.backups.rebackupTitle} body={t.backups.rebackupBody} confirm={t.backups.rebackupConfirm} />
                      <ConfirmDialog trigger={<Button size="sm" variant="ghost" className="text-danger"><Trash2 /> {t.backups.deleteVersion}</Button>} title={t.backups.deleteVersionTitle} body={t.backups.deleteVersionBody} confirm={t.backups.moveToTrash} destructive />
                    </div>
                  </Panel>
                ))}
              </div>
            </div>
          ))}
        </div>
      </StateFrame>
    </div>
  );
}

/** D7 */
export function DesktopTrash() {
  const { t } = useI18n();
  return (
    <div>
      <PageHeader code="D7" title={t.trash.title} body={t.trash.body} />
      <StateFrame states={["empty", "loading"]}>
        {trashItems.length === 0 ? <EmptyState icon={Trash2} title={t.states.emptyTitle} /> : (
          <div className="space-y-2">
            {trashItems.map((i) => (
              <Panel key={i.id} className="flex flex-wrap items-center justify-between gap-3 p-3.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink">{i.label}</p>
                  <p className="text-xs text-muted-foreground">{t.trash.deletedOn}: {i.deleted} · {i.size}</p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusPill tone={i.days < 10 ? "review" : "neutral"}>{fmt(t.trash.daysLeft, { n: i.days })}</StatusPill>
                  <ConfirmDialog trigger={<Button size="sm" variant="secondary"><Undo2 /> {t.trash.undo}</Button>}
                    title={t.backups.restoreConflictTitle} body={t.backups.restoreConflictBody} confirm={t.backups.keepBoth} cancel={t.backups.skipFile}
                    extra={<Notice>{t.backups.restoreTo}: ~/Kloda Yedekleri/iPhone/2026-08</Notice>} />
                </div>
              </Panel>
            ))}
          </div>
        )}
      </StateFrame>
      <Notice className="mt-4" icon={Laptop}>{t.backups.rebackupBody}</Notice>
    </div>
  );
}
