import { useState, type ReactNode } from "react";
import {
  AlertTriangle,
  Ban,
  CircleSlash,
  CloudOff,
  FlaskConical,
  HardDrive,
  Inbox,
  KeyRound,
  Loader2,
  ShieldX,
  SplitSquareHorizontal,
  type LucideIcon,
} from "lucide-react";
import { useI18n } from "@/shared/i18n";
import { EmptyState } from "./kit";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export type ViewState =
  | "success"
  | "empty"
  | "loading"
  | "offline"
  | "denied"
  | "reauth"
  | "full"
  | "interrupted"
  | "partial"
  | "unsupported";

const icons: Record<Exclude<ViewState, "success" | "loading">, LucideIcon> = {
  empty: Inbox,
  offline: CloudOff,
  denied: ShieldX,
  reauth: KeyRound,
  full: HardDrive,
  interrupted: AlertTriangle,
  partial: SplitSquareHorizontal,
  unsupported: Ban,
};

/**
 * Wraps a page body and lets reviewers preview the required states (brief §7).
 * Success renders children; other states render the shared state block.
 */
export function StateFrame({
  states,
  children,
  emptyAction,
}: {
  states: ViewState[];
  children: ReactNode;
  emptyAction?: ReactNode;
}) {
  const { t } = useI18n();
  const [state, setState] = useState<ViewState>("success");
  const all: ViewState[] = ["success", ...states.filter((s) => s !== "success")];
  return (
    <div>
      <div
        className="mb-4 flex flex-wrap items-center gap-1.5 rounded-xl border border-dashed border-input bg-surface p-2.5"
        aria-label={t.common.states}
      >
        <span className="flex items-center gap-1 px-1 text-[11px] font-medium text-muted-foreground">
          <FlaskConical className="size-3" aria-hidden />
          {t.common.states}:
        </span>
        {all.map((s) => (
          <button
            key={s}
            onClick={() => setState(s)}
            aria-pressed={state === s}
            className={cn(
              "min-h-8 shrink-0 rounded-full border px-2.5 text-[11px] font-medium transition-colors",
              state === s
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground hover:text-ink",
            )}
          >
            {t.states[s]}
          </button>
        ))}
      </div>
      {state === "success" && children}
      {state === "loading" && (
        <div className="space-y-3" aria-busy="true" aria-label={t.states.loadingTitle}>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> {t.states.loadingTitle}
          </div>
          <Skeleton className="h-20 rounded-2xl" />
          <Skeleton className="h-14 rounded-2xl" />
          <Skeleton className="h-14 rounded-2xl" />
        </div>
      )}
      {state !== "success" && state !== "loading" && (
        <EmptyState
          icon={icons[state] ?? CircleSlash}
          title={t.states[`${state}Title` as keyof typeof t.states] as string}
          body={t.states[`${state}Body` as keyof typeof t.states] as string}
          action={state === "empty" ? emptyAction : undefined}
        />
      )}
    </div>
  );
}
