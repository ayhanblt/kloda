import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { getNextScheduleOccurrence } from './schedule.js';

const originalTimeZone = process.env.TZ;

beforeEach(() => { process.env.TZ = 'Europe/Berlin'; });
afterEach(() => {
  if (originalTimeZone === undefined) delete process.env.TZ;
  else process.env.TZ = originalTimeZone;
});

describe('local schedule occurrences', () => {
  it.each([
    ['2026-03-28T10:00:00+01:00', '2026-03-29T09:00:00+02:00'],
    ['2026-10-24T10:00:00+02:00', '2026-10-25T09:00:00+01:00'],
    ['2026-12-31T10:00:00+01:00', '2027-01-01T09:00:00+01:00'],
  ])('keeps the daily local time after %s', (input, expected) => {
    expect(getNextScheduleOccurrence({ intervalHours: 24, localTime: '09:00' }, new Date(input)))
      .toEqual(new Date(expected));
  });

  it.each([
    ['2026-01-02T01:00:00+01:00', '2026-01-02T02:00:00+01:00'],
    ['2026-01-02T02:00:00+01:00', '2026-01-02T14:00:00+01:00'],
    ['2026-01-02T14:00:00+01:00', '2026-01-03T02:00:00+01:00'],
    ['2026-03-29T01:00:00+01:00', '2026-03-29T03:00:00+02:00'],
    ['2026-03-29T03:00:00+02:00', '2026-03-29T14:00:00+02:00'],
    ['2026-10-25T01:00:00+02:00', '2026-10-25T02:00:00+02:00'],
    ['2026-10-25T02:15:00+02:00', '2026-10-25T14:00:00+01:00'],
  ])('selects the next 12-hour local slot after %s', (input, expected) => {
    expect(getNextScheduleOccurrence({ intervalHours: 12, localTime: '14:00' }, new Date(input)))
      .toEqual(new Date(expected));
  });

  it.each([
    ['Europe/Berlin', '2026-03-28T12:00:00+01:00', '2026-03-29T03:00:00+02:00'],
    ['Europe/Berlin', '2026-03-29T01:00:00+01:00', '2026-03-29T03:00:00+02:00'],
    ['Australia/Lord_Howe', '2026-10-03T12:00:00+10:30', '2026-10-04T02:30:00+11:00'],
  ])('uses the first valid instant in a %s gap', (zone, input, expected) => {
    process.env.TZ = zone;
    const localTime = zone === 'Australia/Lord_Howe' ? '02:15' : '02:30';
    expect(getNextScheduleOccurrence({ intervalHours: 24, localTime }, new Date(input)))
      .toEqual(new Date(expected));
  });
});
