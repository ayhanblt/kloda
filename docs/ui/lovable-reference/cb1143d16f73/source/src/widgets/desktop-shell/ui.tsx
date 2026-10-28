import type { ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  Archive,
  ArrowUpFromLine,
  Download,
  FolderSync,
  Home,
  MonitorSmartphone,
  PanelTop,
  QrCode,
  Settings,
  Trash2,
  Waypoints,
} from "lucide-react";
import { useI18n } from "@/shared/i18n";
import { Wordmark } from "@/shared/ui/logo";
import { DemoBadge, StatusPill } from "@/shared/ui/kit";
import { LangSwitch } from "@/features/lang-switch/ui";
import { useDemo } from "@/shared/model/demo-store";
import { cn } from "@/lib/utils";

export function DesktopShell({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const { demo } = useDemo();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const onboarding = path.startsWith("/d/welcome");

  const groups = [
    {
      label: t.nav.receiver,
      items: [
        { to: "/d", label: t.nav.home, icon: Home, exact: true },
        { to: "/d/pair", label: t.nav.pair, icon: QrCode },
        { to: "/d/devices", label: t.nav.devices, icon: MonitorSmartphone },
        { to: "/d/incoming", label: t.nav.incoming, icon: Download },
        { to: "/d/backups", label: t.nav.backups, icon: Archive },
        { to: "/d/trash", label: t.nav.trash, icon: Trash2 },
      ],
    },
    {
      label: t.nav.outgoing,
      items: [
        { to: "/d/connections", label: t.nav.connections, icon: Waypoints },
        { to: "/d/sources", label: t.nav.sources, icon: FolderSync },
        { to: "/d/jobs", label: t.nav.jobs, icon: ArrowUpFromLine },
      ],
    },
    {
      label: "Kloda",
      items: [
        { to: "/d/settings", label: t.nav.settings, icon: Settings },
        { to: "/d/tray", label: t.nav.tray, icon: PanelTop },
      ],
    },
  ];
  const isActive = (to: string, exact?: boolean) =>
    exact ? path === to || path === to + "/" : path.startsWith(to);

  return (
    <div className="flex min-h-screen bg-surface">
      {!onboarding && (
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar p-4 lg:flex">
          <Link to="/" className="mb-6 flex min-h-12 items-center px-2" aria-label="Kloda">
            <Wordmark size="sm" />
          </Link>
          <nav className="flex-1 space-y-5 overflow-y-auto" aria-label="Kloda">
            {groups.map((g) => (
              <div key={g.label}>
                <p className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  {g.label}
                </p>
                {g.items.map(({ to, label, icon: Icon, exact }) => (
                  <Link
                    key={to}
                    to={to}
                    aria-current={isActive(to, exact) ? "page" : undefined}
                    className={cn(
                      "flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors",
                      isActive(to, exact)
                        ? "bg-ink text-background shadow-card"
                        : "text-ink-soft hover:bg-sidebar-accent/60 hover:text-ink",
                    )}
                  >
                    <Icon className="size-4 shrink-0" aria-hidden />
                    <span className="truncate">{label}</span>
                  </Link>
                ))}
              </div>
            ))}
          </nav>
          <div className="rounded-xl border border-border bg-card p-3 text-xs text-muted-foreground">
            <StatusPill tone={demo.desktopFolder ? "synced" : "pending"}>
              {demo.desktopFolder ? t.tray.receiving : t.common.notConfigured}
            </StatusPill>
            <p className="mt-2 truncate" title={demo.desktopFolder ?? ""}>
              {demo.desktopFolder ?? "—"}
            </p>
          </div>
        </aside>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-border px-4 glass md:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <Link to="/" className={cn("min-h-12 items-center", onboarding ? "flex" : "flex lg:hidden")} aria-label="Kloda">
              <Wordmark size="sm" />
            </Link>
            <DemoBadge />
          </div>
          <LangSwitch />
        </header>
        {!onboarding && (
          <nav className="grid grid-cols-2 gap-1 border-b border-border bg-background px-3 py-2 sm:grid-cols-3 lg:hidden" aria-label="Kloda">
            {groups.flatMap((g) => g.items).map(({ to, label, exact, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                className={cn(
                  "flex min-h-12 min-w-0 items-center gap-2 rounded-lg px-3 text-xs",
                  isActive(to, exact) ? "bg-ink font-medium text-background" : "text-ink-soft",
                )}
              >
                <Icon className="size-4 shrink-0" aria-hidden /><span className="min-w-0">{label}</span>
              </Link>
            ))}
          </nav>
        )}
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 md:px-8">{children}</main>
      </div>
    </div>
  );
}
