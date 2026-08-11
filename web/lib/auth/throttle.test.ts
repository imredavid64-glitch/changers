import { describe, expect, it } from "vitest";
import {
  formatRetryAfter,
  InMemoryThrottleStore,
  LoginThrottle,
  normalizeAccountKey,
} from "./throttle";

const TINY_WINDOW = 60_000;

function makeThrottle(overrides: { maxPerIp?: number; maxPerAccount?: number; windowMs?: number } = {}) {
  return new LoginThrottle(new InMemoryThrottleStore(), {
    maxPerIp: 3,
    maxPerAccount: 2,
    windowMs: TINY_WINDOW,
    ...overrides,
  });
}

describe("LoginThrottle", () => {
  it("allows attempts below both limits", async () => {
    const throttle = makeThrottle();
    const first = await throttle.recordAttempt("1.2.3.4", "qa@example.com");
    expect(first.allowed).toBe(true);
    expect(first.retryAfterMs).toBeNull();

    const second = await throttle.recordAttempt("1.2.3.4", "qa@example.com");
    expect(second.allowed).toBe(true);
  });

  it("throttles when the account limit is exceeded, independently per account", async () => {
    const throttle = makeThrottle();
    await throttle.recordAttempt("1.2.3.4", "qa@example.com");
    await throttle.recordAttempt("1.2.3.4", "qa@example.com");

    const blocked = await throttle.recordAttempt("1.2.3.4", "qa@example.com");
    expect(blocked.allowed).toBe(false);
    expect(blocked.attempts).toBe(3);
    expect(blocked.maxAttempts).toBe(2);
    expect(blocked.retryAfterMs).toBe(TINY_WINDOW);

    // A different account from a different IP is still allowed.
    const other = await throttle.recordAttempt("9.9.9.9", "other@example.com");
    expect(other.allowed).toBe(true);
  });

  it("throttles when the IP limit is exceeded, independently per IP", async () => {
    const throttle = makeThrottle();
    const ip = "10.0.0.1";
    // Four attempts from one IP exceed the per-IP limit of 3, even across accounts.
    await throttle.recordAttempt(ip, "a@example.com");
    await throttle.recordAttempt(ip, "b@example.com");
    await throttle.recordAttempt(ip, "c@example.com");
    await throttle.recordAttempt(ip, "d@example.com");
    const verdict = await throttle.recordAttempt(ip, "e@example.com");
    expect(verdict.allowed).toBe(false);
    expect(verdict.maxAttempts).toBe(3);

    // A different IP is unaffected.
    const otherIp = await throttle.recordAttempt("10.0.0.2", "qa@example.com");
    expect(otherIp.allowed).toBe(true);
  });

  it("resets counters on success so legitimate users are not locked out", async () => {
    const throttle = makeThrottle();
    await throttle.recordAttempt("1.2.3.4", "qa@example.com");
    await throttle.recordSuccess("1.2.3.4", "qa@example.com");

    const verdict = await throttle.recordAttempt("1.2.3.4", "qa@example.com");
    expect(verdict.allowed).toBe(true);
    expect(verdict.attempts).toBe(1);
  });

  it("normalizes account keys case-insensitively", async () => {
    expect(normalizeAccountKey("  QA@Example.COM ")).toBe("qa@example.com");
    const throttle = makeThrottle({ maxPerAccount: 2 });
    await throttle.recordAttempt("1.2.3.4", "QA@Example.COM");
    await throttle.recordAttempt("1.2.3.4", "qa@example.com");
    const blocked = await throttle.recordAttempt("1.2.3.4", "qa@example.com");
    expect(blocked.allowed).toBe(false);
  });

  it("peek reports throttled state without consuming an attempt", async () => {
    const throttle = makeThrottle();
    await throttle.recordAttempt("1.2.3.4", "qa@example.com");
    await throttle.recordAttempt("1.2.3.4", "qa@example.com");
    const peek = await throttle.peek("1.2.3.4", "qa@example.com");
    expect(peek.allowed).toBe(false);
    // Still exactly two attempts recorded — peek did not increment.
    const after = await throttle.peek("1.2.3.4", "qa@example.com");
    expect(after.attempts).toBe(2);
  });
});

describe("formatRetryAfter", () => {
  it("formats minutes and hours", () => {
    expect(formatRetryAfter(60_000)).toBe("about a minute");
    expect(formatRetryAfter(5 * 60_000)).toBe("5 minutes");
    expect(formatRetryAfter(90 * 60_000)).toBe("2 hours");
  });
});
