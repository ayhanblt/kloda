import { getNextScheduleOccurrence, type SyncSchedule } from '@kloda/sync-core';

export class ElectronScheduleAdapter {
  private nextOccurrence: Date | undefined;
  private running: Promise<void> | undefined;
  private scheduleConfig: SyncSchedule | undefined;
  private timeout: NodeJS.Timeout | undefined;

  constructor(private readonly run: () => Promise<void>) {}

  schedule(schedule: SyncSchedule): void {
    this.cancel();
    this.scheduleConfig = schedule;
    this.nextOccurrence = getNextScheduleOccurrence(schedule, new Date());
    this.arm();
  }

  resume(): void {
    if (!this.scheduleConfig || !this.nextOccurrence) return;
    if (this.nextOccurrence.getTime() <= Date.now()) {
      this.execute();
      return;
    }
    this.arm();
  }

  cancel(): void {
    if (this.timeout) clearTimeout(this.timeout);
    this.nextOccurrence = undefined;
    this.scheduleConfig = undefined;
    this.timeout = undefined;
  }

  private arm(): void {
    if (!this.nextOccurrence) return;
    if (this.timeout) clearTimeout(this.timeout);
    this.timeout = setTimeout(() => this.execute(), Math.max(0, this.nextOccurrence.getTime() - Date.now()));
  }

  private execute(): void {
    if (this.running) return;
    if (this.timeout) clearTimeout(this.timeout);
    this.timeout = undefined;
    this.running = this.run().finally(() => {
      this.running = undefined;
      if (!this.scheduleConfig) return;
      this.nextOccurrence = getNextScheduleOccurrence(this.scheduleConfig, new Date());
      this.arm();
    });
  }
}
