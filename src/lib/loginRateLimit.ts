/**
 * Rate limiting for POST /api/auth/login (in-memory, per server instance).
 * Key: normalized email + client IP so one IP does not block other accounts.
 */

type AttemptEntry = {
  count: number;
  firstAttempt: number;
};

const attemptStore = new Map<string, AttemptEntry>();

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;

export function normalizeLoginRateEmail(email: string): string {
  return email.toLowerCase().trim();
}

export function makeLoginRateLimitKey(email: string, ip: string): string {
  return `${normalizeLoginRateEmail(email)}|${ip}`;
}

/** Returns true if the request may proceed; false if rate limited. */
export function checkLoginRateLimit(key: string): boolean {
  const now = Date.now();
  const entry = attemptStore.get(key);

  if (!entry) {
    attemptStore.set(key, { count: 1, firstAttempt: now });
    return true;
  }

  if (now - entry.firstAttempt > WINDOW_MS) {
    attemptStore.set(key, { count: 1, firstAttempt: now });
    return true;
  }

  if (entry.count >= MAX_ATTEMPTS) {
    return false;
  }

  entry.count++;
  return true;
}

export function clearLoginRateLimit(key: string): void {
  attemptStore.delete(key);
}

/**
 * Clears all buckets for this email (any IP). Used by SUPER_ADMIN unblock.
 * @returns number of keys removed
 */
export function clearLoginRateLimitForEmail(email: string): number {
  const prefix = `${normalizeLoginRateEmail(email)}|`;
  let removed = 0;
  for (const k of [...attemptStore.keys()]) {
    if (k.startsWith(prefix)) {
      attemptStore.delete(k);
      removed++;
    }
  }
  return removed;
}
