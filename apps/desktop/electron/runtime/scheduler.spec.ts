// @vitest-environment node
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ElectronScheduleAdapter } from './scheduler.js';
import { DesktopSyncJournal } from './journal.js';

describe('ElectronScheduleAdapter', () => {
  let root: string;
  let journal: DesktopSyncJournal;
  let scheduler: ElectronScheduleAdapter;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'kloda-scheduler-'));
    journal = new DesktopSyncJournal(join(root, 'schedule.sqlite'));
  });

  afterEach(() => {
    scheduler?.cancel();
    journal.database.close();
    rmSync(root, { recursive: true, force: true });
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('runs at the configured local occurrence', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 1, 11, 59));
    const run = vi.fn().mockResolvedValue(undefined);
    scheduler = new ElectronScheduleAdapter(run, journal);

    scheduler.schedule({ intervalHours: 12, localTime: '12:00' });
    await vi.advanceTimersByTimeAsync(60_000);

    expect(run).toHaveBeenCalledTimes(1);
  });

  it('does not run before the wall-clock deadline after a backward jump', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 1, 11, 59));
    const run = vi.fn().mockResolvedValue(undefined);
    scheduler = new ElectronScheduleAdapter(run, journal);
    scheduler.schedule({ intervalHours: 24, localTime: '12:00' });
    const due = journal.getScheduleDue();
    vi.setSystemTime(new Date(2026, 0, 1, 11));
    await vi.advanceTimersByTimeAsync(60_000);
    expect(run).not.toHaveBeenCalled();
    expect(journal.getScheduleDue()).toBe(due);
    vi.setSystemTime(new Date(2026, 0, 1, 11, 59));
    await vi.advanceTimersByTimeAsync(60_000);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('observes a forward wall-clock jump without requiring a resume event', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 1, 11));
    const run = vi.fn().mockResolvedValue(undefined);
    scheduler = new ElectronScheduleAdapter(run, journal);
    scheduler.schedule({ intervalHours: 24, localTime: '12:00' });
    vi.setSystemTime(new Date(2026, 0, 1, 12, 5));
    await vi.advanceTimersByTimeAsync(60_000);
    expect(run).toHaveBeenCalledTimes(1);
    expect(journal.getScheduleDue()).toBe(new Date(2026, 0, 2, 12).getTime());
  });

  it('rechecks a failed-run opportunity without turning clock checks into retries', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 1, 11, 59));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const run = vi.fn().mockRejectedValueOnce(new Error('fixture failure')).mockResolvedValue(undefined);
    scheduler = new ElectronScheduleAdapter(run, journal);
    scheduler.schedule({ intervalHours: 24, localTime: '12:00' });
    const due = journal.getScheduleDue();
    await vi.advanceTimersByTimeAsync(4 * 60_000);
    expect(run).toHaveBeenCalledTimes(1);
    expect(journal.getScheduleDue()).toBe(due);
    vi.setSystemTime(new Date(2026, 0, 2, 12, 5));
    await vi.advanceTimersByTimeAsync(60_000);
    expect(run).toHaveBeenCalledTimes(2);
    expect(journal.getScheduleDue()).toBe(new Date(2026, 0, 3, 12).getTime());
  });

  it('runs a missed occurrence once when the system resumes', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 1, 11, 59));
    const run = vi.fn().mockResolvedValue(undefined);
    scheduler = new ElectronScheduleAdapter(run, journal);

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
    scheduler = new ElectronScheduleAdapter(run, journal);

    scheduler.schedule({ intervalHours: 12, localTime: '12:00' });
    vi.setSystemTime(new Date(2026, 0, 1, 12, 5));
    scheduler.resume();
    scheduler.resume();

    expect(run).toHaveBeenCalledTimes(1);
  });

  it('retains an overdue occurrence across reopen and coalesces the backlog into one run', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 1, 11, 59));
    const run = vi.fn().mockResolvedValue(undefined);
    scheduler = new ElectronScheduleAdapter(run, journal);
    scheduler.schedule({ intervalHours: 24, localTime: '12:00' });
    scheduler.cancel();
    journal.database.close();
    journal = new DesktopSyncJournal(join(root, 'schedule.sqlite'));
    vi.setSystemTime(new Date(2026, 0, 4, 12, 5));
    scheduler = new ElectronScheduleAdapter(run, journal);
    scheduler.schedule({ intervalHours: 24, localTime: '12:00' });
    scheduler.resume();
    await vi.advanceTimersByTimeAsync(0);
    expect(run).toHaveBeenCalledTimes(1);
    expect(journal.getScheduleDue()).toBe(new Date(2026, 0, 5, 12).getTime());
  });

  it('preserves a failed occurrence without a retry loop and advances only after success', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 1, 11, 59));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const run = vi.fn().mockRejectedValueOnce(new Error('fixture failure')).mockResolvedValue(undefined);
    scheduler = new ElectronScheduleAdapter(run, journal);
    scheduler.schedule({ intervalHours: 24, localTime: '12:00' });
    const due = journal.getScheduleDue();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(run).toHaveBeenCalledTimes(1);
    expect(journal.getScheduleDue()).toBe(due);
    await vi.advanceTimersByTimeAsync(24 * 60 * 60_000);
    expect(run).toHaveBeenCalledTimes(2);
    expect(journal.getScheduleDue()).toBe(new Date(2026, 0, 3, 12).getTime());
  });

  it('does not let an old run consume a changed schedule or lose its due occurrence', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 1, 11, 59));
    let finish!: () => void;
    const run = vi.fn().mockImplementationOnce(() => new Promise<void>(resolve => { finish = resolve; }))
      .mockResolvedValue(undefined);
    scheduler = new ElectronScheduleAdapter(run, journal);
    scheduler.schedule({ intervalHours: 24, localTime: '12:00' });
    await vi.advanceTimersByTimeAsync(60_000);
    journal.saveSchedule(24, '12:01');
    scheduler.schedule({ intervalHours: 24, localTime: '12:01' });
    await vi.advanceTimersByTimeAsync(60_000);
    expect(run).toHaveBeenCalledTimes(1);
    finish();
    await vi.advanceTimersByTimeAsync(0);
    expect(run).toHaveBeenCalledTimes(2);
    expect(journal.getScheduleDue()).toBe(new Date(2026, 0, 2, 12, 1).getTime());
  });

  it('does not rearm or advance a cancelled in-flight occurrence', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 1, 11, 59));
    let finish!: () => void;
    const run = vi.fn(() => new Promise<void>(resolve => { finish = resolve; }));
    scheduler = new ElectronScheduleAdapter(run, journal);
    scheduler.schedule({ intervalHours: 24, localTime: '12:00' });
    const due = journal.getScheduleDue();
    await vi.advanceTimersByTimeAsync(60_000);
    scheduler.cancel();
    finish();
    await vi.advanceTimersByTimeAsync(2 * 24 * 60 * 60_000);
    expect(run).toHaveBeenCalledTimes(1);
    expect(journal.getScheduleDue()).toBe(due);
  });

  it('does not start a duplicate run when the active schedule is saved unchanged', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 1, 11, 59));
    let finish!: () => void;
    const promise = new Promise<void>(resolve => { finish = resolve; });
    const run = vi.fn().mockReturnValue(promise);
    scheduler = new ElectronScheduleAdapter(run, journal);
    journal.saveSchedule(24, '12:00');
    scheduler.schedule({ intervalHours: 24, localTime: '12:00' });
    await vi.advanceTimersByTimeAsync(60_000);
    journal.saveSchedule(24, '12:00');
    scheduler.schedule({ intervalHours: 24, localTime: '12:00' });
    finish();
    await vi.advanceTimersByTimeAsync(0);
    expect(run).toHaveBeenCalledTimes(1);
    expect(journal.getScheduleDue()).toBe(new Date(2026, 0, 2, 12).getTime());
  });

  it('reconciles a changed timezone without resume and runs at the new local time', async () => {
    const originalZone = process.env.TZ;
    try {
      process.env.TZ = 'UTC';
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-01-01T07:00:00Z'));
      const run = vi.fn().mockResolvedValue(undefined);
      scheduler = new ElectronScheduleAdapter(run, journal);
      scheduler.schedule({ intervalHours: 24, localTime: '09:00' });
      process.env.TZ = 'Europe/Berlin';
      await vi.advanceTimersByTimeAsync(60_000);
      expect(journal.getScheduleDue()).toBe(new Date('2026-01-01T08:00:00Z').getTime());
      expect(run).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(59 * 60_000);
      expect(run).toHaveBeenCalledTimes(1);
      expect(journal.getScheduleDue()).toBe(new Date('2026-01-02T08:00:00Z').getTime());
    } finally {
      if (originalZone === undefined) delete process.env.TZ;
      else process.env.TZ = originalZone;
    }
  });

  it('reconciles equal current offsets when the zones have different future DST rules', async () => {
    const originalZone = process.env.TZ;
    try {
      process.env.TZ = 'Europe/Berlin';
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-03-28T08:00:00Z'));
      const run = vi.fn().mockResolvedValue(undefined);
      scheduler = new ElectronScheduleAdapter(run, journal);
      scheduler.schedule({ intervalHours: 24, localTime: '03:00' });
      expect(journal.getScheduleDue()).toBe(new Date('2026-03-29T01:00:00Z').getTime());
      process.env.TZ = 'Africa/Algiers';
      await vi.advanceTimersByTimeAsync(60_000);
      expect(journal.getScheduleDue()).toBe(new Date('2026-03-29T02:00:00Z').getTime());
      expect(run).not.toHaveBeenCalled();
    } finally {
      if (originalZone === undefined) delete process.env.TZ;
      else process.env.TZ = originalZone;
    }
  });

  it('recomputes a future local-time occurrence after a timezone change on resume', () => {
    const originalZone = process.env.TZ;
    try {
      process.env.TZ = 'UTC';
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-01-01T07:00:00Z'));
      const run = vi.fn().mockResolvedValue(undefined);
      scheduler = new ElectronScheduleAdapter(run, journal);
      scheduler.schedule({ intervalHours: 24, localTime: '09:00' });
      expect(journal.getScheduleDue()).toBe(new Date('2026-01-01T09:00:00Z').getTime());
      process.env.TZ = 'Europe/Berlin';
      scheduler.resume();
      expect(journal.getScheduleDue()).toBe(new Date('2026-01-01T08:00:00Z').getTime());
      expect(run).not.toHaveBeenCalled();
    } finally {
      if (originalZone === undefined) delete process.env.TZ;
      else process.env.TZ = originalZone;
    }
  });
});
