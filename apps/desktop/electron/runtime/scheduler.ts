import { getNextScheduleOccurrence, type SyncSchedule } from '@kloda/sync-core';

import type { DesktopSyncJournal } from './journal.js';

export class ElectronScheduleAdapter {
  private nextOccurrence: Date | undefined;
  private running = false;
  private scheduleConfig: SyncSchedule | undefined;
  private timeout: NodeJS.Timeout | undefined;
  private timeZone: string | undefined;

  constructor(
    private readonly run: () => Promise<void>,
    private readonly journal: DesktopSyncJournal,
  ) {}

  schedule(schedule: SyncSchedule): void {
    if (this.scheduleConfig?.intervalHours === schedule.intervalHours &&
      this.scheduleConfig.localTime === schedule.localTime) {
      this.resume();
      return;
    }
    this.cancel();
    this.scheduleConfig = schedule;
    const persisted = this.journal.getScheduleDue();
    this.nextOccurrence = persisted === undefined ? undefined : new Date(persisted);
    this.resume();
  }

  resume(): void {
    if (!this.scheduleConfig) return;
    this.timeZone = new Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (this.nextOccurrence && this.nextOccurrence.getTime() <= Date.now()) {
      void this.execute();
      return;
    }
    this.nextOccurrence = getNextScheduleOccurrence(this.scheduleConfig, new Date());
    this.journal.saveScheduleDue(this.nextOccurrence.getTime());
    this.arm();
  }

  cancel(): void {
    clearTimeout(this.timeout);
    this.nextOccurrence = undefined;
    this.scheduleConfig = undefined;
    this.timeout = undefined;
  }

  private arm(deadline = this.nextOccurrence?.getTime()): void {
    if (deadline === undefined || !this.scheduleConfig) return;
    clearTimeout(this.timeout);
    // Elapsed timers must recheck wall time before starting a backup.
    this.timeout = setTimeout(() => {
      if (new Intl.DateTimeFormat().resolvedOptions().timeZone !== this.timeZone) this.resume();
      else if (Date.now() < deadline) this.arm(deadline);
      else void this.execute();
    }, Math.min(60_000, Math.max(0, deadline - Date.now())));
  }

  private async execute(): Promise<void> {
    if (this.running || !this.scheduleConfig) return;
    const schedule = this.scheduleConfig;
    this.running = true;
    clearTimeout(this.timeout);
    this.timeout = undefined;
    let failed = false;
    try {
      await this.run();
      if (this.scheduleConfig === schedule) {
        const next = getNextScheduleOccurrence(schedule, new Date());
        this.journal.saveScheduleDue(next.getTime());
        this.nextOccurrence = next;
      }
    } catch {
      failed = true;
      console.error('Kloda scheduled backup failed; occurrence remains pending.');
    } finally {
      this.running = false;
      if (this.scheduleConfig) {
        if (failed && this.scheduleConfig === schedule) {
          const next = getNextScheduleOccurrence(schedule, new Date());
          this.arm(next.getTime());
        } else {
          this.arm();
        }
      }
    }
  }
}
