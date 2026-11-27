import type { ReactNode } from 'react';
import { AlertTriangle, Check, Info, XCircle, type LucideIcon } from 'lucide-react';

export type StatusTone = 'synced' | 'syncing' | 'pending' | 'danger' | 'review' | 'neutral';

const dotColor: Record<StatusTone, string> = {
  synced: 'bg-brand',
  syncing: 'bg-brand status-pulse',
  pending: 'bg-tertiary-text',
  danger: 'bg-[var(--danger-base)]',
  review: 'bg-[var(--attention-base)]',
  neutral: 'bg-tertiary-text',
};

export function StatusDot({ tone, className = '' }: { tone: StatusTone; className?: string }) {
  return <span className={`size-[7px] shrink-0 rounded-full ${dotColor[tone]} ${className}`} aria-hidden="true" />;
}

export function StatusPill({
  tone,
  children,
  className = '',
  role,
  'aria-live': ariaLive,
}: {
  tone: StatusTone;
  children: ReactNode;
  className?: string;
  role?: 'status' | 'alert';
  'aria-live'?: 'polite' | 'assertive' | 'off';
}) {
  return (
    <span
      aria-live={ariaLive}
      className={`kloda-status-pill inline-flex max-w-full items-center gap-1.5 rounded-full bg-surface-2 px-2.5 py-1 text-xs font-medium text-secondary-text ${className}`}
      role={role}
    >
      <StatusDot tone={tone} />
      <span className="truncate">{children}</span>
    </span>
  );
}

export function Notice({
  children,
  tone = 'info',
  icon,
  role = 'note',
  className = '',
}: {
  children: ReactNode;
  tone?: 'info' | 'warn' | 'danger' | 'ok';
  icon?: LucideIcon;
  role?: 'note' | 'status' | 'alert';
  className?: string;
}) {
  const DefaultIcon = tone === 'danger' ? XCircle : tone === 'warn' ? AlertTriangle : tone === 'ok' ? Check : Info;
  const Icon = icon ?? DefaultIcon;
  const iconTone =
    tone === 'danger'
      ? 'text-danger-text'
      : tone === 'warn'
        ? 'text-attention-text'
        : tone === 'ok'
          ? 'text-brand-text'
          : 'text-tertiary-text';
  const boxTone =
    tone === 'danger'
      ? 'border-[color-mix(in_srgb,var(--danger-base)_35%,var(--border-subtle))] bg-[color-mix(in_srgb,var(--danger-base)_7%,var(--surface-1))] text-danger-text'
      : tone === 'warn'
        ? 'border-[color-mix(in_srgb,var(--attention-base)_35%,var(--border-subtle))] bg-[color-mix(in_srgb,var(--attention-base)_7%,var(--surface-1))] text-attention-text'
        : 'border-border-subtle bg-surface-2/60 text-secondary-text';
  return (
    <div className={`kloda-notice flex items-start gap-3 rounded-xl border p-3 text-sm leading-relaxed [overflow-wrap:anywhere] ${boxTone} ${className}`} role={role}>
      <Icon aria-hidden="true" className={`mt-0.5 size-4 shrink-0 ${iconTone}`} strokeWidth={1.75} />
      {typeof children === 'string' || typeof children === 'number' ? children : <div className="min-w-0 flex-1 [overflow-wrap:anywhere]">{children}</div>}
    </div>
  );
}

export function PageHeader({
  title,
  body,
  actions,
  eyebrow,
  className = '',
}: {
  title: string;
  body?: string;
  actions?: ReactNode;
  eyebrow?: ReactNode;
  className?: string;
}) {
  return (
    <header className={`mb-6 flex flex-wrap items-start justify-between gap-4 ${className}`}>
      <div className="min-w-0 flex-1 basis-60">
        {eyebrow && <div className="mb-1.5">{eyebrow}</div>}
        <h1 className="text-[28px] font-semibold leading-tight tracking-tight text-primary-text [overflow-wrap:anywhere]">{title}</h1>
        {body && <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-secondary-text">{body}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function SectionTitle({ children, action, className = '' }: { children: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={`mb-2.5 mt-6 flex items-center justify-between gap-2 px-1 first:mt-0 ${className}`}>
      <h2 className="text-sm font-semibold text-secondary-text">{children}</h2>
      {action}
    </div>
  );
}

export function KlodaAppIcon({
  sizeClass = 'size-9',
  showDot = true,
  animated = false,
}: {
  sizeClass?: string;
  showDot?: boolean;
  animated?: boolean;
}) {
  return (
    <span className={`kloda-app-icon ${sizeClass}`} aria-hidden="true">
      <svg viewBox="0 0 120 120" fill="none">
        <circle
          cx="60"
          cy="60"
          r="26"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray="122 41"
          transform="rotate(-90 60 60)"
          className={`kloda-ring ${animated ? 'logo-ring-draw' : ''}`}
        />
        {showDot && <circle cx="60" cy="60" r="7" className="kloda-dot" />}
      </svg>
    </span>
  );
}

/** Monochrome 24x24 tray/menu-bar icon matching Lovable D13 TrayIcon geometry. */
export function TrayIconSvg({ className = 'size-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
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

export function DeviceGlyph({
  kind,
  className = 'size-7 shrink-0',
}: {
  kind: 'phone' | 'laptop' | 'nas' | 'cloud' | 'folder';
  className?: string;
}) {
  return (
    <svg viewBox="0 0 64 64" fill="none" className={className} aria-hidden="true">
      {kind === 'phone' && (
        <g>
          <rect x="18" y="8" width="28" height="48" rx="7" fill="var(--surface-1)" stroke="var(--border-strong)" strokeWidth="2.5" />
          <rect x="22" y="14" width="20" height="33" rx="3" fill="var(--surface-2)" />
          <line x1="28" y1="51" x2="36" y2="51" stroke="var(--border-strong)" strokeWidth="2.5" strokeLinecap="round" />
        </g>
      )}
      {kind === 'laptop' && (
        <g>
          <rect x="12" y="14" width="40" height="27" rx="4" fill="var(--surface-1)" stroke="var(--border-strong)" strokeWidth="2.5" />
          <rect x="16" y="18" width="32" height="19" rx="2" fill="var(--surface-2)" />
          <path d="M6 46h52l-3 5H9l-3-5z" fill="var(--surface-1)" stroke="var(--border-strong)" strokeWidth="2" strokeLinejoin="round" />
        </g>
      )}
      {kind === 'nas' && (
        <g>
          <rect x="13" y="12" width="38" height="40" rx="6" fill="var(--surface-1)" stroke="var(--border-strong)" strokeWidth="2.5" />
          <rect x="19" y="19" width="26" height="8" rx="2" fill="var(--surface-2)" />
          <rect x="19" y="32" width="26" height="8" rx="2" fill="var(--surface-2)" />
          <circle cx="24" cy="46" r="2" fill="var(--brand-base)" />
        </g>
      )}
      {kind === 'cloud' && (
        <path
          d="M20 47h24a10 10 0 0 0 1.4-19.9A15 15 0 0 0 16.8 24.5 11.5 11.5 0 0 0 20 47z"
          fill="var(--surface-1)"
          stroke="var(--border-strong)"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
      )}
      {kind === 'folder' && (
        <path
          d="M10 18a4 4 0 0 1 4-4h12l5 5h19a4 4 0 0 1 4 4v23a4 4 0 0 1-4 4H14a4 4 0 0 1-4-4V18z"
          fill="var(--surface-1)"
          stroke="var(--border-strong)"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
}
