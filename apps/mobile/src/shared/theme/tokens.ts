// Exact Lovable warm sand & terracotta theme colors; all native palette values live here.
export type Appearance = 'dark' | 'light';
const light = {
  "bg": "#F7F5F2",
  "surface-1": "#FFFFFF",
  "surface-2": "#EFEBE6",
  "border-subtle": "#E5DFD8",
  "border-strong": "#CFC7BE",
  "text-primary": "#1A1612",
  "text-secondary": "#5C544C",
  "text-tertiary": "#6B635A",
  "action": "#1A1612",
  "on-action": "#FFFFFF",
  "brand-base": "#9A6640",
  "brand-text": "#7E5230",
  "on-brand": "#FFFFFF",
  "attention-base": "#B7791F",
  "attention-text": "#8F5E0F",
  "danger-base": "#D2453A",
  "danger-text": "#B8372D",
  "tile": "#1C1A18",
  "tile-ring": "#F1ECE6",
  "tile-foreground": "#F1ECE6",
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
  "bg": "#121110",
  "surface-1": "#1B1A18",
  "surface-2": "#252321",
  "border-subtle": "#2E2B28",
  "border-strong": "#3E3A36",
  "text-primary": "#F2EDE7",
  "text-secondary": "#ADA59C",
  "text-tertiary": "#8E867D",
  "action": "#F2EDE7",
  "on-action": "#121110",
  "brand-base": "#E8C3A1",
  "brand-text": "#E8C3A1",
  "on-brand": "#2A1A0E",
  "attention-base": "#E0A93B",
  "attention-text": "#E0A93B",
  "danger-base": "#F06A5F",
  "danger-text": "#F06A5F",
  "tile": "#252321",
  "tile-ring": "#F1ECE6",
  "tile-foreground": "#F1ECE6",
  "illus-body": "#252321",
  "illus-screen": "#302D2A",
  "illus-line": "#5A554F",
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
    'button-brand': base['brand-base'],
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
