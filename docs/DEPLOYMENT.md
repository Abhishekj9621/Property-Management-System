# Deployment Guide

## Option A — Docker Compose (single VM / small property)
```bash
cp backend/.env.example backend/.env   # edit secrets
docker compose up -d --build
docker compose exec backend npx prisma migrate deploy
docker compose exec backend npx prisma db seed
```
Put Nginx or Caddy in front for TLS termination, or point a managed load balancer at ports 80 (frontend) / 4000 (API).

## Option B — Managed platforms (recommended for production)
| Layer | Suggested service |
|---|---|
| Backend API | Render / Railway / Fly.io / AWS ECS Fargate |
| Frontend | Vercel / Netlify / Cloudflare Pages (static build output of `npm run build`) |
| Postgres | AWS RDS / Neon / Supabase / Railway Postgres |
| Redis | AWS ElastiCache / Upstash / Railway Redis |
| Object storage (room images, invoices) | AWS S3 / Cloudflare R2 |

### Backend environment checklist
- `DATABASE_URL`, `REDIS_URL` pointing at managed instances
- Strong, unique `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` (32+ random bytes)
- `CORS_ORIGINS` set to a comma-separated list of every frontend origin that calls this API — the management app **and** the public marketing site if you're using this backend for both (not `*`)
- `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` from the Stripe dashboard, webhook endpoint registered at `https://<api-domain>/webhooks/stripe`
- Run `npx prisma migrate deploy` as a release/predeploy step, not `migrate dev`

### Zero-downtime migrations
Prefer additive migrations (new nullable columns, new tables) deployed ahead of the code that depends on them; use a second deploy to drop/rename columns once the old code path is retired.

## Scaling checklist
- Run the API as multiple stateless replicas behind a load balancer — no sticky sessions required (JWT auth).
- Socket.IO across multiple replicas needs the Redis adapter (`@socket.io/redis-adapter`) so events broadcast across instances — add this once you run >1 API replica.
- Enable Postgres connection pooling (PgBouncer or the managed provider's pooler) once replica count grows, since Prisma opens a pool per instance.
- Add a CDN in front of the frontend static assets and room images.

## Health & Monitoring
- `GET /api/v1/health` for load-balancer health checks.
- Ship Winston JSON logs (production mode) to your log aggregator.
- Add uptime checks against `/health` and the Stripe webhook endpoint.

## Backups
- Automated daily Postgres snapshots (RDS/managed provider default) + point-in-time recovery.
- Test restore procedure quarterly — booking data loss is a business-critical failure mode for an HMS.
