import type { ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Activity, Images, Settings, Waypoints, ArrowLeft } from "lucide-react";
import { useI18n } from "@/shared/i18n";
import { Wordmark } from "@/shared/ui/logo";
import { DemoBadge } from "@/shared/ui/kit";
import { LangSwitch } from "@/features/lang-switch/ui";
import { mobileJobs, jobGroup } from "@/entities/job/model";
import { cn } from "@/lib/utils";
import { useDemo } from "@/shared/model/demo-store";

export function MobileShell({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const { demo } = useDemo();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const onboarding = path.startsWith("/m/welcome");
  const activityCount = mobileJobs.filter((j) => jobGroup(j.status) !== "completed").length;
  const tabs = [
    { to: "/m", label: t.nav.gallery, icon: Images, match: (p: string) => p === "/m" || p === "/m/" || p.startsWith("/m/photo") },
    { to: "/m/activity", label: t.nav.activity, icon: Activity, match: (p: string) => p.startsWith("/m/activity") },
    { to: "/m/connections", label: t.nav.connections, icon: Waypoints, match: (p: string) => p.startsWith("/m/connections") || p.startsWith("/m/pair") },
    { to: "/m/settings", label: t.nav.settings, icon: Settings, match: (p: string) => p.startsWith("/m/settings") || p.startsWith("/m/sources") || p.startsWith("/m/schedule") || p.startsWith("/m/backups") },
  ] as const;

  return (
    <div className="min-h-screen bg-surface md:py-6">
      <div className="relative mx-auto flex min-h-screen w-full max-w-[440px] flex-col bg-background md:min-h-[860px] md:rounded-[2.5rem] md:border md:border-border md:shadow-float">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-2 px-4 glass border-b border-border/60">
          <Link to="/" aria-label="Kloda" className="flex min-h-12 min-w-0 items-center">
            <Wordmark size="sm" />
          </Link>
          <div className="flex shrink-0 items-center gap-1">
            {!onboarding && (
              <Link
                to="/m/connections"
                title={demo.pcAccessGranted || demo.connections > 0 ? t.header.connected : t.common.notConfigured}
                className="flex h-8 items-center gap-1.5 rounded-full border border-border bg-card px-2.5 text-[11px] font-medium text-ink-soft transition-colors hover:text-foreground"
              >
                <span className={cn("size-1.5 rounded-full", demo.pcAccessGranted || demo.connections > 0 ? "bg-synced" : "bg-attention")} aria-hidden />
                {demo.pcAccessGranted || demo.connections > 0 ? t.header.connected : t.common.notConfigured}
              </Link>
            )}
            <LangSwitch />
          </div>
        </header>
        <main className={cn("min-w-0 flex-1 px-4 pt-5", onboarding ? "pb-8" : "pb-24")}>{children}</main>
        {!onboarding && (
          <nav
            aria-label="Kloda"
            className="fixed inset-x-0 bottom-0 z-30 mx-auto grid w-full max-w-[440px] grid-cols-4 gap-1 border-t border-border glass safe-bottom px-2 pt-1.5 md:rounded-b-[2.5rem]"
          >
            {tabs.map(({ to, label, icon: Icon, match }) => {
              const active = match(path);
              const badge = to === "/m/activity" ? activityCount : 0;
              return (
                <Link
                  key={to}
                  to={to}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-2xl text-[11px] font-medium transition-colors",
                    active ? "bg-ink text-background shadow-card" : "text-muted-foreground hover:text-ink",
                  )}
                >
                  <span className="relative">
                    <Icon className="size-5" aria-hidden />
                    {badge > 0 && (
                      <span className="absolute -right-2.5 -top-1.5 grid min-w-4 place-items-center rounded-full bg-attention px-1 text-[9px] font-bold leading-4 text-card">
                        {badge}
                      </span>
                    )}
                  </span>
                  <span className="max-w-full truncate px-1">{label}</span>
                </Link>
              );
            })}
          </nav>
        )}
      </div>
    </div>
  );
}
