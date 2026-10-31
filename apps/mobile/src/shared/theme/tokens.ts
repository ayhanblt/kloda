// Exact c144e989 theme colors; all native palette values live here.
export type Appearance = 'dark' | 'light';
const light = {
  "bg": "#F7F8F9",
  "surface-1": "#FFFFFF",
  "surface-2": "#F0F2F4",
  "border-subtle": "#E2E5E9",
  "border-strong": "#CDD2D8",
  "text-primary": "#121417",
  "text-secondary": "#545B63",
  "text-tertiary": "#62686F",
  "action": "#121417",
  "on-action": "#FFFFFF",
  "brand-base": "#1F9C8C",
  "brand-text": "#0F7266",
  "on-brand": "#FFFFFF",
  "attention-base": "#B7791F",
  "attention-text": "#8F5E0F",
  "danger-base": "#D2453A",
  "danger-text": "#B8372D",
  "tile": "#1B1C1E",
  "tile-ring": "#ECEEF0",
  "tile-foreground": "#ECEEF0",
  "illus-body": "#FFFFFF",
  "illus-screen": "#E9ECEF",
  "illus-line": "#B9C0C8",
  "illus-photo-1": "#C9A27A",
  "illus-photo-2": "#7F9BAE",
  "illus-photo-3": "#8FA88A",
  "illus-photo-4": "#B98580",
  "illus-photo-5": "#9C8FB0",
  "illus-photo-6": "#A9A27E"
} as const;
const dark = {
  "bg": "#111213",
  "surface-1": "#191A1C",
  "surface-2": "#222326",
  "border-subtle": "#2C2D30",
  "border-strong": "#3B3D41",
  "text-primary": "#ECEEF0",
  "text-secondary": "#A6A8AC",
  "text-tertiary": "#888A8E",
  "action": "#ECEEF0",
  "on-action": "#111213",
  "brand-base": "#3DBFAE",
  "brand-text": "#3DBFAE",
  "on-brand": "#06231F",
  "attention-base": "#E0A93B",
  "attention-text": "#E0A93B",
  "danger-base": "#F06A5F",
  "danger-text": "#F06A5F",
  "tile": "#222326",
  "tile-ring": "#ECEEF0",
  "tile-foreground": "#ECEEF0",
  "illus-body": "#222326",
  "illus-screen": "#2E3034",
  "illus-line": "#55585E",
  "illus-photo-1": "#8A6E52",
  "illus-photo-2": "#4F6676",
  "illus-photo-3": "#56694F",
  "illus-photo-4": "#7A5552",
  "illus-photo-5": "#5F5670",
  "illus-photo-6": "#6E6A4F"
} as const;
function channels(color: string): number[] {
  return [1, 3, 5].map((offset) => Number.parseInt(color.slice(offset, offset + 2), 16));
}
function mix(color: string, background: string, weight: number): string {
  const a = channels(color), b = channels(background);
  return '#' + a.map((part, i) => Math.round(part * weight + b[i] * (1 - weight)).toString(16).padStart(2, '0')).join('');
}
export function themeColors(mode: Appearance) {
  const base = mode === 'dark' ? dark : light;
  return { ...base,
    // User-approved light primary contrast adaptation, 2026-10-30.
    'button-brand': mode === 'light' ? base['brand-text'] : base['brand-base'],
    'brand-subtle': mix(base['brand-base'], base.bg, 0.14),
    'brand-line': mix(base['brand-base'], base.bg, 0.5),
    'brand-halo-1': mix(base['brand-base'], base.bg, 0.24),
    'brand-halo-2': mix(base['brand-base'], base.bg, 0.1),
    'focus-ring': mode === 'light' ? base['brand-base'] : mix(base['brand-base'], base.bg, 0.6),
  };
}
export function themeVariables(mode: Appearance) {
  return Object.fromEntries(Object.entries(themeColors(mode)).map(([key, value]) => [`--${key}`, channels(value).join(' ')]));
}
