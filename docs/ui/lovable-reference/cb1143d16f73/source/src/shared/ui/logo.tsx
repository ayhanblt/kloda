import { cn } from "@/lib/utils";

/**
 * Kloda mark: open sync ring + signal dot (vector, no raster).
 * Geometry matches private_photo_cloud_logo/code.html (r=26, stroke 10, gap at top-left).
 */
type Tone = "light" | "dark" | "mono" | "mono-inverse";

const ringByTone: Record<Tone, string> = {
  light: "stroke-brand-ring",
  dark: "stroke-brand",
  mono: "stroke-current",
  "mono-inverse": "stroke-current",
};
const dotByTone: Record<Tone, string> = {
  light: "fill-signal",
  dark: "fill-signal",
  mono: "fill-current",
  "mono-inverse": "fill-current",
};

export function LogoSymbol({
  tone = "light",
  className,
  animated = false,
  spinning = false,
  title,
}: {
  tone?: Tone;
  className?: string | undefined;
  animated?: boolean | undefined;
  spinning?: boolean;
  title?: string | undefined;
}) {
  return (
    <svg
      viewBox="0 0 120 120"
      fill="none"
      className={className}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <circle
        cx="60"
        cy="60"
        r="26"
        strokeWidth="10"
        strokeLinecap="round"
        strokeDasharray="122 41"
        transform="rotate(-90 60 60)"
        className={cn(ringByTone[tone], animated && "logo-ring-draw", spinning && "logo-ring-spin")}
      />
      <circle cx="60" cy="60" r="7" className={cn(dotByTone[tone], animated && "logo-dot-pop")} />
    </svg>
  );
}

/** App icon: dark rounded tile with light ring + green center (as in screen.png). */
export function AppIcon({
  className,
  animated,
  title,
}: {
  className?: string | undefined;
  animated?: boolean | undefined;
  title?: string | undefined;
}) {
  return (
    <span
      className={cn(
        "inline-grid shrink-0 place-items-center rounded-[22%] bg-brand shadow-icon",
        className,
      )}
    >
      <LogoSymbol tone="light" animated={animated} className="size-[86%]" title={title} />
    </span>
  );
}

/** Small tray / menu-bar icon: simplified, thicker stroke for 16–22px legibility. */
export function TrayIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <circle
        cx="12"
        cy="12"
        r="7"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray="33 11"
        transform="rotate(-90 12 12)"
      />
      <circle cx="12" cy="12" r="2.5" fill="currentColor" />
    </svg>
  );
}

export function Wordmark({
  className,
  size = "md",
  inverse = false,
}: {
  className?: string | undefined;
  size?: "sm" | "md" | "lg";
  inverse?: boolean;
}) {
  const icon = { sm: "size-8", md: "size-10", lg: "size-16" }[size];
  const text = { sm: "text-base", md: "text-lg", lg: "text-3xl" }[size];
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <AppIcon className={icon} />
      <span
        className={cn(
          "font-semibold tracking-tight",
          text,
          inverse ? "text-brand-foreground" : "text-ink",
        )}
      >
        Kloda
      </span>
    </span>
  );
}
