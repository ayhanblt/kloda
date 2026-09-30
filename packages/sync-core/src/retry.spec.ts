import { describe, expect, it } from 'vitest';

import {
  ACCESS_RETRY_DELAY_MS,
  MAX_ACCESS_ATTEMPTS,
  MAX_OS_ATTEMPTS,
  OS_RETRY_TARGET_DELAY_MS,
  nextAccessRetry,
  nextOsRetry,
} from './retry.js';

describe('retry policies', () => {
  it('waits sixty seconds after an access failure and stops after five attempts', () => {
    const failure = new Date('2026-01-01T12:00:00.000Z');

    expect(nextAccessRetry(failure, 1)).toEqual({
      exhausted: false,
      retryAt: new Date(failure.getTime() + ACCESS_RETRY_DELAY_MS),
    });
    expect(nextAccessRetry(failure, MAX_ACCESS_ATTEMPTS)).toEqual({
      exhausted: true,
      retryAt: null,
    });
  });

  it('uses a separate five-minute OS recovery budget', () => {
    const observation = new Date('2026-01-01T12:00:00.000Z');

    expect(nextOsRetry(observation, 1)).toEqual({
      exhausted: false,
      retryAt: new Date(observation.getTime() + OS_RETRY_TARGET_DELAY_MS),
    });
    expect(nextOsRetry(observation, MAX_OS_ATTEMPTS)).toEqual({
      exhausted: true,
      retryAt: null,
    });
  });
});
