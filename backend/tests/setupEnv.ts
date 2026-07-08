// Ensures required env vars exist for unit tests, without requiring a
// real .env file or live Postgres/Redis connection (those are mocked
// per-test with jest.mock where needed).
process.env.NODE_ENV = process.env.NODE_ENV ?? "test";
process.env.DATABASE_URL = process.env.DATABASE_URL ?? "postgresql://test:test@localhost:5432/test?schema=public";
process.env.REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";
process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET ?? "test-access-secret";
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET ?? "test-refresh-secret";
process.env.CORS_ORIGINS = process.env.CORS_ORIGINS ?? "http://localhost:5173,http://localhost:3000";
