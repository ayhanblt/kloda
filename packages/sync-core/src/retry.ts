export const MAX_ACCESS_ATTEMPTS = 5;
export const MAX_OS_ATTEMPTS = 5;
export const ACCESS_RETRY_DELAY_MS = 60_000;
export const OS_RETRY_TARGET_DELAY_MS = 5 * 60_000;

export interface RetryDecision {
  retryAt: Date | null;
  exhausted: boolean;
}

export function nextAccessRetry(failedAt: Date, attempts: number): RetryDecision {
  return nextRetry(failedAt, attempts, ACCESS_RETRY_DELAY_MS, MAX_ACCESS_ATTEMPTS);
}

export function nextOsRetry(observedAt: Date, attempts: number): RetryDecision {
  return nextRetry(observedAt, attempts, OS_RETRY_TARGET_DELAY_MS, MAX_OS_ATTEMPTS);
}

function nextRetry(
  observedAt: Date,
  attempts: number,
  delayMs: number,
  maximumAttempts: number,
): RetryDecision {
  if (!Number.isInteger(attempts) || attempts < 1) {
    throw new Error('Attempt count must include the completed attempt.');
  }

  if (attempts >= maximumAttempts) {
    return { retryAt: null, exhausted: true };
  }

  return { retryAt: new Date(observedAt.getTime() + delayMs), exhausted: false };
}
