import { useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronRight, FlaskConical, Info, type LucideIcon } from "lucide-react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { useI18n } from "@/shared/i18n";
import { Button } from "@/components/ui/button";

/* ---------- Status pill ---------- */
export type Tone = "synced" | "syncing" | "pending" | "danger" | "review" | "neutral";

const pill = cva(
  "inline-flex max-w-full items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-wide",
  {
    variants: {
      tone: {
        synced: "bg-synced-soft text-synced",
        syncing: "bg-syncing-soft text-syncing",
        pending: "bg-pending-soft text-pending",
        danger: "bg-danger-soft text-danger",
        review: "bg-review-soft text-review",
        neutral: "bg-muted text-muted-foreground",
      },
    },
  },
);
const pip: Record<Tone, string> = {
  synced: "bg-synced",
  syncing: "bg-syncing animate-pulse",
  pending: "bg-pending",
  danger: "bg-danger",
  review: "bg-review",
  neutral: "bg-muted-foreground",
};

export function StatusPill({
  tone,
  children,
  className,
}: { children: ReactNode; className?: string } & Required<VariantProps<typeof pill>>) {
  return (
    <span className={cn(pill({ tone }), className)}>
      <span className={cn("size-1.5 shrink-0 rounded-full", pip[tone ?? "neutral"])} />
      <span className="truncate">{children}</span>
    </span>
  );
}

/* ---------- Demo badge ---------- */
export function DemoBadge({ className }: { className?: string }) {
  const { t } = useI18n();
  return (
    <span
      title={t.common.demoNote}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-dashed border-input px-2 py-0.5 text-[11px] font-medium text-muted-foreground",
        className,
      )}
    >
      <FlaskConical className="size-3" aria-hidden />
      {t.common.demo}
    </span>
  );
}

/* ---------- Card ---------- */
export function Panel({
  children,
  className,
  as: As = "section",
}: {
  children: ReactNode;
  className?: string;
  as?: "section" | "div" | "article";
}) {
  return (
    <As className={cn("min-w-0 rounded-2xl border border-border bg-card p-4 shadow-card animate-rise transition-shadow duration-300 hover:shadow-float", className)}>
      {children}
    </As>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-2 mt-6 flex items-center justify-between gap-2 px-1 first:mt-0">
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        {children}
      </h2>
      {action}
    </div>
  );
}

/* ---------- Page header ---------- */
export function PageHeader({
  title,
  body,
  code,
  actions,
}: {
  title: string;
  body?: string;
  code?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-5 flex flex-wrap items-start justify-between gap-3 animate-rise">
      <div className="min-w-0 flex-1 basis-48">
        {code && (
          <span className="mb-1 inline-block rounded-md bg-muted px-1.5 py-0.5 font-mono text-[10px] font-semibold text-muted-foreground">
            {code}
          </span>
        )}
        <h1 className="text-[26px] font-semibold leading-tight tracking-tight text-ink [overflow-wrap:anywhere] md:text-[28px]">
          {title}
        </h1>
        {body && <p className="mt-1 max-w-2xl text-sm text-ink-soft">{body}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

/* ---------- List row (link or static) ---------- */
export function Row({
  icon: Icon,
  title,
  meta,
  trailing,
  to,
  params,
  className,
}: {
  icon?: LucideIcon;
  title: ReactNode;
  meta?: ReactNode;
  trailing?: ReactNode;
  to?: string;
  params?: Record<string, string>;
  className?: string;
}) {
  const inner = (
    <>
      {Icon && (
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-muted text-ink-soft">
          <Icon className="size-5" aria-hidden />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-ink">{title}</span>
        {meta && <span className="block truncate text-xs text-muted-foreground">{meta}</span>}
      </span>
      {trailing}
      {to && <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />}
    </>
  );
  const base = cn(
    "flex min-h-14 items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors",
    to && "hover:bg-accent",
    className,
  );
  if (to)
    return (
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      <Link to={to as any} params={params as any} className={base}>
        {inner}
      </Link>
    );
  return <div className={base}>{inner}</div>;
}

/* ---------- Notice ---------- */
const notice = cva("flex gap-3 rounded-xl p-3 text-sm", {
  variants: {
    tone: {
      info: "bg-muted text-ink-soft",
      warn: "bg-review-soft text-review",
      danger: "bg-danger-soft text-danger",
      ok: "bg-synced-soft text-synced",
    },
  },
  defaultVariants: { tone: "info" },
});
export function Notice({
  children,
  tone,
  icon: Icon = Info,
  className,
}: { children: ReactNode; icon?: LucideIcon; className?: string } & VariantProps<typeof notice>) {
  return (
    <div className={cn(notice({ tone }), className)} role="note">
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="min-w-0 [overflow-wrap:anywhere]">{children}</div>
    </div>
  );
}

/* ---------- Empty / state block ---------- */
export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
}: {
  icon: LucideIcon;
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-input bg-surface px-6 py-10 text-center animate-rise">
      <span className="grid size-12 place-items-center rounded-2xl bg-card text-ink-soft shadow-card">
        <Icon className="size-6" aria-hidden />
      </span>
      <div>
        <p className="font-semibold text-ink">{title}</p>
        {body && <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">{body}</p>}
      </div>
      {action}
    </div>
  );
}

/* ---------- Segmented control ---------- */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { id: T; label: string }[];
  label: string;
}) {
  return (
    <div role="tablist" aria-label={label} className="flex w-full flex-wrap gap-1 rounded-xl bg-muted p-1">
      {options.map((o) => (
        <Button variant="ghost"
          key={o.id}
          role="tab"
          aria-selected={value === o.id}
          onClick={() => onChange(o.id)}
          className={cn(
            "min-h-12 min-w-0 flex-1 rounded-lg px-3 text-sm font-medium transition-all",
            value === o.id ? "bg-ink text-background shadow-card hover:bg-ink hover:text-background" : "text-muted-foreground hover:text-ink",
          )}
        >
          {o.label}
        </Button>
      ))}
    </div>
  );
}

/* ---------- Filter chips (wrapping, never scrolls horizontally) ---------- */
export function FilterChips<T extends string>({
  value,
  onChange,
  options,
  label,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { id: T; label: string; icon?: LucideIcon; dot?: string }[];
  label: string;
  className?: string;
}) {
  return (
    <div role="tablist" aria-label={label} className={cn("flex flex-wrap gap-1.5", className)}>
      {options.map((o) => {
        const Icon = o.icon;
        const active = value === o.id;
        return (
          <Button variant="ghost"
            key={o.id}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.id)}
            className={cn(
              "inline-flex min-h-12 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium transition-colors",
              active
                ? "border-ink bg-ink text-background hover:bg-ink hover:text-background"
                : "border-border bg-card text-muted-foreground hover:text-ink",
            )}
          >
            {Icon && <Icon className="size-3.5" aria-hidden />}
            {o.dot && <span className={cn("size-2 rounded-full", o.dot)} aria-hidden />}
            {o.label}
          </Button>
        );
      })}
    </div>
  );
}

/* ---------- Eyebrow label (small uppercase section marker) ---------- */
export function Eyebrow({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-2 flex items-center justify-between gap-2">
      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">{children}</p>
      {action}
    </div>
  );
}

/* ---------- Hook for simple toggles ---------- */
export function useToggle(init = false) {
  const [v, setV] = useState(init);
  return [v, () => setV((x) => !x), setV] as const;
}
