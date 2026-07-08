# Deploying NovaStay HMS to Railway (backend) + Vercel (frontend)

This backend is the **only backend** — it serves both the internal
management app and the public curatdconcepts.com marketing site. Three
deployed pieces total, mapped to three domains:

| Piece | Repo path | Deploys to | Domain |
|---|---|---|---|
| HMS backend | `backend/` | Railway (+ Postgres + Redis plugins) | `api.curatdconcepts.com` |
| HMS management app | `frontend/` | Vercel | `management.curatdconcepts.com` |
| Public website | *(separate `curatd-concepts` repo)* | Vercel | `curatdconcepts.com` |

```
                    curatdconcepts.com                 management.curatdconcepts.com
                   (Vercel — public site,               (Vercel — this repo's
                    separate repo, static)                frontend/, staff-only)
                            │                                       │
                            │  GET /public/listings                │  authenticated API
                            │  POST /public/contact                │  (JWT + RBAC)
                            ▼                                       ▼
                    ┌───────────────────────────────────────────────────┐
                    │        api.curatdconcepts.com (Railway)            │
                    │        this repo's backend/ — the ONLY backend     │
                    │        Postgres + Redis (Railway plugins)          │
                    └───────────────────────────────────────────────────┘
```

---

## 1. Push to GitHub

```bash
cd hms
git init
git add .
git commit -m "Initial commit"
gh repo create novastay-hms --private --source=. --push
```

---

## 2. Deploy the backend to Railway

1. [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub
   repo** → select `novastay-hms`.
2. Service **Settings** → **Root Directory** → `backend`.
3. In the same Railway **project**, click **+ New** twice to add:
   - **Database → PostgreSQL**
   - **Database → Redis**
4. Backend service → **Variables** tab, add:
   | Variable | Value |
   |---|---|
   | `DATABASE_URL` | Reference the Postgres plugin's `DATABASE_URL` (click the "+" in the value field and pick it, rather than typing it by hand) |
   | `REDIS_URL` | Reference the Redis plugin's `REDIS_URL` the same way |
   | `NODE_ENV` | `production` |
   | `JWT_ACCESS_SECRET` | `openssl rand -hex 32` |
   | `JWT_REFRESH_SECRET` | a **different** `openssl rand -hex 32` |
   | `CORS_ORIGINS` | `https://curatdconcepts.com,https://management.curatdconcepts.com` — **comma-separated, no spaces**. This one backend serves two different browser apps; both origins need to be listed. |
   | `CONTACT_INBOX_EMAIL` | where curatdconcepts.com's contact form should land, e.g. `business@curatdconcepts.com` |
   | `SMTP_HOST` / `SMTP_USER` / `SMTP_PASS` | your real SMTP provider — without these, contact-form emails are logged, not sent |
   | `R2_ACCOUNT_ID` / `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` / `R2_BUCKET_NAME` / `R2_PUBLIC_URL` | see step 2.1 below — needed before photo uploads work in the management app |
   | `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | only if using Stripe payments |
5. Build/start commands are already set via `backend/railway.json`
   (`prisma generate && npm run build`, then `prisma migrate deploy && npm start`).
6. Deploy. Copy the URL Railway assigns for now (e.g.
   `https://novastay-hms-backend.up.railway.app`) — you'll point
   `api.curatdconcepts.com` at it in step 5.
7. Test: `curl https://<railway-url>/api/v1/health`.

### 2.1 Set up Cloudflare R2 (property photo storage)

1. [Cloudflare dashboard](https://dash.cloudflare.com/?to=/:account/r2) → R2
   → **Create bucket** (e.g. `curatd-property-photos`).
2. Bucket → **Settings** → enable public access, or connect a custom domain
   to the bucket — either way, note the public base URL (either the
   `*.r2.dev` URL or your custom domain). That's `R2_PUBLIC_URL`.
3. R2 → **Manage API tokens** → create a token with read+write access to
   this bucket. Note the Account ID, Access Key ID, and Secret Access Key.
4. Set all five `R2_*` variables on the Railway backend service (step 2
   above) and redeploy.
5. Without this configured, the photo upload button in the management app
   returns a clear "not configured" error rather than failing silently.

### 2.2 Load catalog data + create your real login

```bash
npm install -g @railway/cli
railway login
cd backend
railway link          # pick the novastay-hms-backend service
railway run npm run seed                  # hotel types, room categories, demo hotels
railway run npm run create:super-admin    # interactive — creates YOUR real admin login
```

---

## 3. Deploy the management frontend to Vercel

1. [vercel.com](https://vercel.com) → **Add New** → **Project** → import
   `novastay-hms`, **Root Directory** → `frontend`.
2. Environment variables:
   | Variable | Value |
   |---|---|
   | `VITE_API_URL` | `https://<railway-backend-url>/api/v1` (switch to `https://api.curatdconcepts.com/api/v1` once step 5 is done) |
   | `VITE_SOCKET_URL` | same host, no `/api/v1` suffix |
3. Deploy.

---

## 4. Deploy the public website (separate repo)

That's the `curatd-concepts` repo, not this one — see its own
`DEPLOYMENT.md`. It also needs `REACT_APP_HMS_API_URL` pointed at this
backend.

---

## 5. Custom domains

Buy `curatdconcepts.com` if you haven't, then in each Vercel/Railway
project's domain settings, add:

| Domain | Project |
|---|---|
| `curatdconcepts.com` (+ `www`) | the `curatd-concepts` Vercel project |
| `management.curatdconcepts.com` | this repo's `frontend` Vercel project |
| `api.curatdconcepts.com` | this repo's Railway backend service (Railway → service → **Settings → Networking → Custom Domain**) |

Each platform shows the exact DNS records to add at your registrar. Once
`api.curatdconcepts.com` resolves, update `VITE_API_URL` /
`REACT_APP_HMS_API_URL` on both frontends to use it instead of the raw
Railway/Vercel URLs, and double check `CORS_ORIGINS` (step 2) lists the
final `https://curatdconcepts.com` and `https://management.curatdconcepts.com`
— not the temporary `*.vercel.app` URLs.

---

## 6. Verify

1. `management.curatdconcepts.com` → log in → **Hotels** → add a hotel,
   give it photos and amenities, add a room type or two (with "AC" as an
   amenity on at least one, to see the badge).
2. Same hotel → **Website** button → check **Published**, optionally set a
   rating/review count/OTA links → **Save**.
3. `curatdconcepts.com/listings` → the hotel should appear with its real
   photos and a Room Types section showing AC/Non-AC badges.
4. Submit the contact form on the public site → confirm the email lands at
   `CONTACT_INBOX_EMAIL`.
5. Un-publish the hotel → confirm it disappears from the public site
   immediately (no redeploy, no sync delay — it's a live query).
