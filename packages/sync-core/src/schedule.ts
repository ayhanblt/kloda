import type { SyncSchedule } from './contracts.js';

export function getNextScheduleOccurrence(schedule: SyncSchedule, now: Date): Date {
  const [hours, minutes] = parseLocalTime(schedule.localTime);
  const firstHour = hours % schedule.intervalHours;

  for (let hour = firstHour; hour < 24; hour += schedule.intervalHours) {
    const occurrence = localOccurrence(now, 0, hour, minutes);
    if (occurrence.getTime() > now.getTime()) return occurrence;
  }

  return localOccurrence(now, 1, firstHour, minutes);
}

function localOccurrence(now: Date, dayOffset: number, hours: number, minutes: number): Date {
  const occurrence = new Date(now.getFullYear(), now.getMonth(), now.getDate() + dayOffset, hours, minutes);
  if (occurrence.getHours() !== hours || occurrence.getMinutes() !== minutes) {
    // Date preserves the gap offset; the schedule requires the first valid instant.
    const previous = new Date(occurrence.getTime() - 60_000);
    while (previous.getTimezoneOffset() === occurrence.getTimezoneOffset()) {
      occurrence.setTime(previous.getTime());
      previous.setTime(previous.getTime() - 60_000);
    }
  }
  return occurrence;
}

export function parseLocalTime(localTime: SyncSchedule['localTime']): readonly [number, number] {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(localTime)) {
    throw new Error('Schedule time must use HH:mm.');
  }

  return [Number(localTime.slice(0, 2)), Number(localTime.slice(3, 5))];
}
