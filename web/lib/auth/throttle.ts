/**
 * Login throttling: sliding-window rate limits keyed per IP and per account.
 *
 * Deliberately store-agnostic so it can back onto Postgres (DATABASE_URL),
 * Redis, or in-memory for single-instance dev. The enforcement point is the
 * server-side auth flow: the server must observe login *failures* to reset or
 * escalate counters correctly, so this is consumed by the auth API routes,
 * not by a client-side preflight.
 */

export type ThrottleVerdict = {
  allowed: boolean;
  /** Attempts observed in the current window. */
  attempts: number;
  maxAttempts: number;
  /** Milliseconds until the user may try again, when throttled. */
  retryAfterMs: number | null;
};

export interface ThrottleStore {
  /** Increment `key`'s counter within a sliding window; returns the new count. */
  incr(key: string, windowMs: number): Promise<number>;
  /** Read the current count without mutating (0 when absent/expired). */
  peek(key: string, windowMs: number): Promise<number>;
  /** Clear `key` (e.g. after a successful sign-in). */
  reset(key: string): Promise<void>;
}

/**
 * In-memory sliding-window store. Correct for single-instance development and
 * tests; for multi-instance serverless deploys use a shared store (Postgres)
 * instead.
 */
export class InMemoryThrottleStore implements ThrottleStore {
  private readonly counts = new Map<string, { count: number; expiresAt: number }>();

  async incr(key: string, windowMs: number): Promise<number> {
    const now = Date.now();
    const entry = this.counts.get(key);
    if (!entry || entry.expiresAt <= now) {
      this.counts.set(key, { count: 1, expiresAt: now + windowMs });
      return 1;
    }
    entry.count += 1;
    return entry.count;
  }

  async peek(key: string, windowMs: number): Promise<number> {
    const now = Date.now();
    const entry = this.counts.get(key);
    if (!entry || entry.expiresAt <= now) return 0;
    return entry.count;
  }

  async reset(key: string): Promise<void> {
    this.counts.delete(key);
  }
}

export type LoginThrottleConfig = {
  /** Max login attempts per IP within the window. */
  maxPerIp?: number;
  /** Max login attempts per account (normalized email) within the window. */
  maxPerAccount?: number;
  /** Sliding window length in milliseconds. */
  windowMs?: number;
};

export const DEFAULT_THROTTLE_CONFIG: Required<LoginThrottleConfig> = {
  maxPerIp: 20,
  maxPerAccount: 6,
  windowMs: 15 * 60 * 1000,
};

export function normalizeAccountKey(email: string): string {
  return email.trim().toLowerCase();
}

/** Formats a retry delay for user-facing messages. */
export function formatRetryAfter(ms: number): string {
  const minutes = Math.ceil(ms / 60_000);
  if (minutes <= 1) return "about a minute";
  if (minutes < 60) return `${minutes} minutes`;
  const hours = Math.ceil(minutes / 60);
  return `${hours} hour${hours > 1 ? "s" : ""}`;
}

export class LoginThrottle {
  private readonly store: ThrottleStore;
  private readonly config: Required<LoginThrottleConfig>;

  constructor(store: ThrottleStore, config: LoginThrottleConfig = {}) {
    this.store = store;
    this.config = { ...DEFAULT_THROTTLE_CONFIG, ...config };
  }

  private ipKey(ip: string): string {
    return `login:ip:${ip}`;
  }

  private accountKey(email: string): string {
    return `login:acct:${normalizeAccountKey(email)}`;
  }

  /**
   * Record an attempt and return the verdict. Both the IP and the account are
   * checked; the strictest limit wins.
   */
  async recordAttempt(ip: string, email: string): Promise<ThrottleVerdict> {
    const { maxPerIp, maxPerAccount, windowMs } = this.config;

    const [ipAttempts, accountAttempts] = await Promise.all([
      this.store.incr(this.ipKey(ip), windowMs),
      this.store.incr(this.accountKey(email), windowMs),
    ]);

    const ipLimitHit = ipAttempts > maxPerIp;
    const accountLimitHit = accountAttempts > maxPerAccount;

    if (!ipLimitHit && !accountLimitHit) {
      return {
        allowed: true,
        attempts: Math.max(ipAttempts, accountAttempts),
        maxAttempts: maxPerIp,
        retryAfterMs: null,
      };
    }

    return {
      allowed: false,
      attempts: ipLimitHit ? ipAttempts : accountAttempts,
      maxAttempts: ipLimitHit ? maxPerIp : maxPerAccount,
      retryAfterMs: windowMs,
    };
  }

  /** Call after a successful sign-in so a legit user never trips the limit. */
  async recordSuccess(ip: string, email: string): Promise<void> {
    await Promise.all([
      this.store.reset(this.ipKey(ip)),
      this.store.reset(this.accountKey(email)),
    ]);
  }

  /** Read-only check, e.g. to render a "try again later" message. */
  async peek(ip: string, email: string): Promise<ThrottleVerdict> {
    const { maxPerIp, maxPerAccount, windowMs } = this.config;

    const [ipAttempts, accountAttempts] = await Promise.all([
      this.store.peek(this.ipKey(ip), windowMs),
      this.store.peek(this.accountKey(email), windowMs),
    ]);

    const ipLimitHit = ipAttempts >= maxPerIp;
    const accountLimitHit = accountAttempts >= maxPerAccount;

    if (!ipLimitHit && !accountLimitHit) {
      return { allowed: true, attempts: Math.max(ipAttempts, accountAttempts), maxAttempts: maxPerIp, retryAfterMs: null };
    }

    return {
      allowed: false,
      attempts: ipLimitHit ? ipAttempts : accountAttempts,
      maxAttempts: ipLimitHit ? maxPerIp : maxPerAccount,
      retryAfterMs: windowMs,
    };
  }
}
