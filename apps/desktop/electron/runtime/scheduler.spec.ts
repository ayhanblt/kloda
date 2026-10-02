import { afterEach, describe, expect, it, vi } from 'vitest';

import { ElectronScheduleAdapter } from './scheduler.js';

describe('ElectronScheduleAdapter', () => {
  afterEach(() => vi.useRealTimers());

  it('runs at the configured local occurrence', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 1, 11, 59));
    const run = vi.fn().mockResolvedValue(undefined);
    const scheduler = new ElectronScheduleAdapter(run);

    scheduler.schedule({ intervalHours: 12, localTime: '12:00' });
    await vi.advanceTimersByTimeAsync(60_000);

    expect(run).toHaveBeenCalledTimes(1);
  });

  it('runs a missed occurrence once when the system resumes', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 1, 11, 59));
    const run = vi.fn().mockResolvedValue(undefined);
    const scheduler = new ElectronScheduleAdapter(run);

    scheduler.schedule({ intervalHours: 12, localTime: '12:00' });
    vi.setSystemTime(new Date(2026, 0, 1, 12, 5));
    scheduler.resume();
    await Promise.resolve();

    expect(run).toHaveBeenCalledTimes(1);
  });

  it('does not start a second missed run while the first is active', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 1, 11, 59));
    const run = vi.fn(() => new Promise<void>(() => undefined));
    const scheduler = new ElectronScheduleAdapter(run);

    scheduler.schedule({ intervalHours: 12, localTime: '12:00' });
    vi.setSystemTime(new Date(2026, 0, 1, 12, 5));
    scheduler.resume();
    scheduler.resume();

    expect(run).toHaveBeenCalledTimes(1);
  });
});
