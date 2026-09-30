import { getNextScheduleOccurrence, type SyncSchedule } from '@kloda/sync-core';

export class ElectronScheduleAdapter {
  private timeout: NodeJS.Timeout | undefined;

  constructor(private readonly run: () => Promise<void>) {}

  schedule(schedule: SyncSchedule): void {
    if (this.timeout) clearTimeout(this.timeout);
    const next = getNextScheduleOccurrence(schedule, new Date());
    this.timeout = setTimeout(() => {
      void this.run().finally(() => this.schedule(schedule));
    }, Math.max(0, next.getTime() - Date.now()));
  }

  cancel(): void {
    if (this.timeout) clearTimeout(this.timeout);
    this.timeout = undefined;
  }
}
