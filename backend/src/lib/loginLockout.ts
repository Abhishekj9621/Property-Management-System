import { redis } from "../config/redis";

/**
 * Simple Redis-backed brute-force guard, keyed per email (not IP, since
 * staff often share a front-desk IP). After MAX_ATTEMPTS failed logins
 * within WINDOW_SECONDS, the account is locked for LOCKOUT_SECONDS.
 * This is deliberately separate from the express-rate-limit middleware,
 * which throttles by IP — this one protects a specific account even if
 * the attacker rotates IPs.
 */
const MAX_ATTEMPTS = 5;
const WINDOW_SECONDS = 15 * 60;
const LOCKOUT_SECONDS = 15 * 60;

const attemptsKey = (email: string) => `login:attempts:${email.toLowerCase()}`;
const lockKey = (email: string) => `login:locked:${email.toLowerCase()}`;

export const loginLockout = {
  async isLocked(email: string): Promise<{ locked: boolean; retryAfterSeconds?: number }> {
    const ttl = await redis.ttl(lockKey(email));
    if (ttl && ttl > 0) return { locked: true, retryAfterSeconds: ttl };
    return { locked: false };
  },

  /** Returns true if this failure just tipped the account into a lockout. */
  async registerFailure(email: string): Promise<{ lockedOut: boolean; attemptsRemaining: number }> {
    const key = attemptsKey(email);
    const attempts = await redis.incr(key);
    if (attempts === 1) await redis.expire(key, WINDOW_SECONDS);

    if (attempts >= MAX_ATTEMPTS) {
      await redis.set(lockKey(email), "1", "EX", LOCKOUT_SECONDS);
      await redis.del(key);
      return { lockedOut: true, attemptsRemaining: 0 };
    }
    return { lockedOut: false, attemptsRemaining: MAX_ATTEMPTS - attempts };
  },

  async clear(email: string): Promise<void> {
    await redis.del(attemptsKey(email), lockKey(email));
  },
};
