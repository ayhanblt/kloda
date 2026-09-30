import type { SyncSchedule } from './contracts.js';

export function getNextScheduleOccurrence(schedule: SyncSchedule, now: Date): Date {
  const [hours, minutes] = parseLocalTime(schedule.localTime);
  const first = new Date(now);
  first.setHours(hours, minutes, 0, 0);

  if (first.getTime() > now.getTime()) {
    return first;
  }

  const intervalMs = schedule.intervalHours * 60 * 60 * 1000;
  const elapsedIntervals = Math.floor((now.getTime() - first.getTime()) / intervalMs) + 1;
  return new Date(first.getTime() + elapsedIntervals * intervalMs);
}

export function parseLocalTime(localTime: SyncSchedule['localTime']): readonly [number, number] {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(localTime)) {
    throw new Error('Schedule time must use HH:mm.');
  }

  return [Number(localTime.slice(0, 2)), Number(localTime.slice(3, 5))];
}
