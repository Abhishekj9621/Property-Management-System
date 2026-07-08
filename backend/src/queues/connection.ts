import { env } from "../config/env";

/**
 * BullMQ bundles its own copy of `ioredis` internally. Handing it a live
 * instance from the app's own `ioredis` dependency (config/redis.ts) causes
 * a TypeScript error (and, if forced through, a runtime one) whenever the
 * two resolve to different package copies/versions in node_modules —
 * "Type 'Redis' is not assignable to type 'ConnectionOptions'" — because
 * they're structurally similar but nominally distinct classes.
 *
 * The reliable fix is to give BullMQ plain connection options instead of an
 * instance. BullMQ then constructs and owns its *own* ioredis client per
 * Queue/Worker, so there's no cross-package type — or version-drift —
 * mismatch, ever.
 */
function parseRedisUrl(url: string) {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: parsed.port ? Number(parsed.port) : 6379,
    username: parsed.username || undefined,
    password: parsed.password || undefined,
    ...(parsed.protocol === "rediss:" ? { tls: {} } : {}),
  };
}

export const bullConnectionOptions = parseRedisUrl(env.REDIS_URL);
