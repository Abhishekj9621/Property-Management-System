import dotenv from "dotenv";
dotenv.config();

function required(key: string, fallback?: string): string {
  const value = process.env[key] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

const isProd = (process.env.NODE_ENV ?? "development") === "production";

// Placeholder values shipped in .env.example — if these are still in use in
// production, the JWT signing keys are effectively public knowledge, which
// lets anyone forge staff/admin access tokens. Fail fast at boot rather than
// silently running with a compromised signing key.
const KNOWN_PLACEHOLDER_SECRETS = new Set([
  "change_this_access_secret_in_production",
  "change_this_refresh_secret_in_production",
  "secret",
  "changeme",
]);

function requiredSecret(key: string): string {
  const value = required(key);
  if (isProd) {
    if (value.length < 32) {
      throw new Error(`${key} must be at least 32 characters in production (got ${value.length}). Generate one with: openssl rand -hex 32`);
    }
    if (KNOWN_PLACEHOLDER_SECRETS.has(value)) {
      throw new Error(`${key} is still set to its .env.example placeholder value. Generate a real secret with: openssl rand -hex 32`);
    }
  }
  return value;
}

export const env = {
  NODE_ENV: process.env.NODE_ENV ?? "development",
  PORT: Number(process.env.PORT ?? 4000),
  API_PREFIX: process.env.API_PREFIX ?? "/api/v1",

  DATABASE_URL: required("DATABASE_URL"),
  REDIS_URL: required("REDIS_URL", "redis://localhost:6379"),

  JWT_ACCESS_SECRET: requiredSecret("JWT_ACCESS_SECRET"),
  JWT_ACCESS_EXPIRES_IN: process.env.JWT_ACCESS_EXPIRES_IN ?? "15m",
  JWT_REFRESH_SECRET: requiredSecret("JWT_REFRESH_SECRET"),
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN ?? "7d",

  // Comma-separated allow-list. Two browser apps talk to this one backend
  // now: the internal management app (full authenticated API) and the
  // public curatdconcepts.com site (read-only /public/* endpoints +
  // contact form). Parsed into an array — see cors() setup in app.ts.
  CORS_ORIGINS: (process.env.CORS_ORIGINS ?? "http://localhost:5173,http://localhost:3000")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean),

  // Used to build links in staff-facing emails (password reset, etc.) —
  // always the management app, never the public site. Defaults to the
  // first CORS origin, which is the management app in local dev.
  MANAGEMENT_APP_URL:
    process.env.MANAGEMENT_APP_URL ||
    (process.env.CORS_ORIGINS ?? "http://localhost:5173").split(",")[0].trim(),

  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY ?? "",
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET ?? "",

  SMTP_HOST: process.env.SMTP_HOST ?? "",
  SMTP_PORT: Number(process.env.SMTP_PORT ?? 587),
  SMTP_USER: process.env.SMTP_USER ?? "",
  SMTP_PASS: process.env.SMTP_PASS ?? "",
  EMAIL_FROM: process.env.EMAIL_FROM ?? "NovaStay <no-reply@novastay.com>",

  // Where the public site's contact form / partner inquiry form emails get
  // delivered. Falls back to SMTP_USER since that's already a real mailbox
  // in most setups, but set this explicitly in production.
  CONTACT_INBOX_EMAIL: process.env.CONTACT_INBOX_EMAIL || process.env.SMTP_USER || "",

  RATE_LIMIT_WINDOW_MS: Number(process.env.RATE_LIMIT_WINDOW_MS ?? 900000),
  RATE_LIMIT_MAX: Number(process.env.RATE_LIMIT_MAX ?? 300),

  // Cloudflare R2 (S3-compatible) — hotel/room-type photo uploads from the
  // management app. See src/utils/r2.ts. Left blank by default so the
  // upload endpoint can fail with a clear "not configured" error rather
  // than a confusing SDK crash.
  R2_ACCOUNT_ID: process.env.R2_ACCOUNT_ID ?? "",
  R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID ?? "",
  R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY ?? "",
  R2_BUCKET_NAME: process.env.R2_BUCKET_NAME ?? "",
  // Public base URL images are served from — either the bucket's public
  // r2.dev URL or a custom domain you've mapped to it. No trailing slash.
  R2_PUBLIC_URL: (process.env.R2_PUBLIC_URL ?? "").replace(/\/+$/, ""),

  // NovaStay HMS operates exclusively in Indian Rupees (INR). There is
  // no multi-currency support, so no FX provider/rate configuration is
  // needed.
  CURRENCY_CODE: "INR",
  CURRENCY_SYMBOL: "₹",

  isProd,
};

if (isProd && env.JWT_ACCESS_SECRET === env.JWT_REFRESH_SECRET) {
  throw new Error("JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different values in production");
}
