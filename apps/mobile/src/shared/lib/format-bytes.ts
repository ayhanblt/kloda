const UNITS = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'] as const;

/** Format a non-negative integer byte count into human-readable B / KB / MB / GB / TB / PB. */
export function formatBytes(raw: string | number | bigint, locale?: string): string {
  let bytes: bigint;
  try {
    bytes = typeof raw === 'bigint' ? raw : BigInt(String(raw).trim());
  } catch {
    return String(raw);
  }
  if (bytes < 0n) return String(raw);
  if (bytes < 1024n) return `${bytes.toString()} B`;

  let unitIndex = 0;
  let divisor = 1n;
  while (unitIndex < UNITS.length - 1 && bytes >= divisor * 1024n) {
    divisor *= 1024n;
    unitIndex += 1;
  }

  const tenthsTotal = (bytes * 10n + divisor / 2n) / divisor;
  const whole = tenthsTotal / 10n;
  const tenths = tenthsTotal % 10n;
  if (tenths === 0n) {
    return `${whole.toString()} ${UNITS[unitIndex]}`;
  }
  const sep = locale?.startsWith('tr') || locale?.startsWith('de') ? ',' : '.';
  return `${whole.toString()}${sep}${tenths.toString()} ${UNITS[unitIndex]}`;
}
