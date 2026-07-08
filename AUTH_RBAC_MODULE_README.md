# NovaStay HMS — Authentication & RBAC Module

This delivery covers **only** the Authentication & Role-Based Access Control
module of NovaStay HMS, built on top of the existing project you provided
(Express + Prisma + PostgreSQL + Redis + BullMQ backend, Vite + React 18 +
Tailwind + shadcn-style components frontend). No other module (bookings,
rooms, payments, housekeeping, etc.) was touched beyond what Auth/RBAC
needed to integrate cleanly.

> **Stack note:** your brief asked for Next.js 16 / React 19 / Tailwind v4 /
> NestJS. The zip you uploaded is an already-built app on Express + Vite /
> React 18 / Tailwind v3. Per your instruction, this module was built
> **inside your existing project on its existing stack**, not rewritten
> onto the newer stack.

## What's in this module

### Backend (`backend/src`)

| Area | Files |
|---|---|
| Auth core (already existed, hardened) | `modules/auth/*` |
| RBAC / staff management (already existed, audited) | `modules/users/*` |
| **New:** account lockout | `lib/loginLockout.ts` |
| **New:** audit trail writer | `lib/auditLog.ts` |
| **New:** audit log read API | `modules/audit-logs/*` |
| RBAC middleware (already existed) | `middlewares/rbac.middleware.ts` |
| JWT auth middleware (hardened) | `middlewares/auth.middleware.ts` |
| Role hierarchy (already existed) | `lib/roleHierarchy.ts` |

### What changed vs. the version you uploaded

1. **Account lockout.** After 5 failed login attempts for the same email
   within 15 minutes, the account is locked for 15 minutes (Redis-backed,
   independent of the existing per-IP rate limiter).
2. **Audit logging.** Every security-relevant event now writes to the
   existing `AuditLog` Prisma model: login success/failure/lockout,
   register, logout, token refresh, refresh-token-reuse detection,
   forgot/reset password, session revocation, and staff create / update /
   role change / password reset / deactivate / restore.
3. **Refresh-token reuse detection.** If a revoked refresh token is replayed
   (a signal of token theft), every session for that user is immediately
   revoked and the event is audited.
4. **Access-token blacklist enforcement.** `authenticate` now checks the
   Redis blacklist set at logout, so a bearer token can't be replayed after
   an explicit logout, even though access tokens are otherwise stateless.
5. **Session management API** — list/revoke your own active sessions
   (`GET/DELETE /auth/sessions`, `DELETE /auth/sessions/:id`), so a user can
   see every device they're logged in on and kick out ones they don't
   recognize.
6. **Read-only audit log API** (`GET /audit-logs`), scoped: `SUPER_ADMIN`
   sees everything; `HOTEL_ADMIN`/`MANAGER` only see events tied to users in
   their own hotel.
7. **Tests** for the role hierarchy, the RBAC middleware, `authService`
   (login/lockout/refresh/reset), and `usersService` (creation rules, hotel
   scoping, self-action guards).

### Frontend (`frontend/src`)

| Area | Files |
|---|---|
| Login (existing, added "Forgot password?" link) | `pages/auth/Login.tsx` |
| **New:** Forgot password | `pages/auth/ForgotPassword.tsx` |
| **New:** Reset password | `pages/auth/ResetPassword.tsx` |
| **New:** Security / active sessions | `pages/security/SecurityPage.tsx` |
| **New:** Audit log viewer | `pages/audit-logs/AuditLogsPage.tsx` |
| API clients | `api/auth.api.ts` (extended), `api/auditLogs.api.ts` (new) |
| Route wiring | `App.tsx`, `components/layout/Sidebar.tsx`, `lib/permissions.ts` |

The Security page is visible to every signed-in role (it only ever shows
*your own* sessions). The Audit Log page is visible to `SUPER_ADMIN`,
`HOTEL_ADMIN`, and `MANAGER` — the same audience that can already manage
staff on the Team page.

## Role model (unchanged, already existed)

```
SUPER_ADMIN   → platform-wide; can create/manage HOTEL_ADMIN, MANAGER, RECEPTIONIST, HOUSEKEEPING for ANY hotel
HOTEL_ADMIN   → can create/manage MANAGER, RECEPTIONIST, HOUSEKEEPING — only within their own hotel
MANAGER       → can create/manage RECEPTIONIST, HOUSEKEEPING — only within their own hotel
RECEPTIONIST  → no staff-management rights
HOUSEKEEPING  → no staff-management rights
GUEST         → self-registered, no staff-management rights
```

Enforcement lives in two places that mirror each other, on purpose:

- **Backend, source of truth:** `backend/src/lib/roleHierarchy.ts` +
  `usersService.assertInScope()` — every request is checked here regardless
  of what the UI shows.
- **Frontend, UX only:** `frontend/src/lib/permissions.ts` — hides links and
  form options the API would reject anyway, so no one gets a false promise
  from the UI.

## API surface (Auth & RBAC only)

```
POST   /api/v1/auth/register              Public — creates a GUEST account
POST   /api/v1/auth/login                 Public — rate-limited + lockout-guarded
POST   /api/v1/auth/refresh               Rotates access/refresh token pair
POST   /api/v1/auth/logout                Revokes refresh token + blacklists access token
POST   /api/v1/auth/forgot-password       Public — never reveals account existence
POST   /api/v1/auth/reset-password        Public — consumes a one-time token
GET    /api/v1/auth/me                    Current identity
GET    /api/v1/auth/sessions              List your own active sessions/devices
DELETE /api/v1/auth/sessions/:id          Revoke one session
DELETE /api/v1/auth/sessions              Revoke all other sessions

GET    /api/v1/users                      List staff (scoped to actor's hotel unless SUPER_ADMIN)
POST   /api/v1/users                      Create staff (role hierarchy enforced)
GET    /api/v1/users/:id                  Get one staff member (scope-checked)
PATCH  /api/v1/users/:id                  Update staff (role/hotel reassignment rules enforced)
POST   /api/v1/users/:id/reset-password   Admin-driven password reset (revokes their sessions)
DELETE /api/v1/users/:id                  Deactivate staff (revokes their sessions)
POST   /api/v1/users/:id/restore          Reactivate staff

GET    /api/v1/audit-logs                 Read-only audit trail (SUPER_ADMIN/HOTEL_ADMIN/MANAGER)
```

Full request/response schemas are in the Zod files (`*.schema.ts`) and
exposed live via Swagger at `GET /api/docs` once the server is running.

## Database

No schema migration was required — the `User`, `RefreshToken`, and
`AuditLog` models already existed in `prisma/schema.prisma` and already had
everything this module needs (password reset token fields, audit log
`action`/`entity`/`metadata`/`ipAddress` columns, etc). If you're setting up
a fresh database, run:

```bash
cd backend
npm install
cp .env.example .env      # then fill in real secrets
npx prisma migrate dev
npm run seed               # optional demo data
```

Demo accounts created by the seed script:

| Email | Password | Role |
|---|---|---|
| `super@novastay.com` | `Super@123` | SUPER_ADMIN |
| `admin@novastay.com` | `Admin@123` | HOTEL_ADMIN (see seed for others) |

For a real deployment, don't rely on the seeded accounts — run
`npm run create:super-admin` instead (interactive, prompts for a real email
+ strong password) and skip/remove the demo seed block.

## Running this module

```bash
# Backend
cd backend
npm install
cp .env.example .env
npx prisma generate
npx prisma migrate dev
npm run seed          # optional
npm run dev            # http://localhost:4000, docs at /api/docs

# Frontend
cd frontend
npm install
cp .env.example .env   # set VITE_API_URL if not http://localhost:4000/api/v1
npm run dev             # http://localhost:5173
```

### Tests

```bash
cd backend
npm test
```

Covers: role hierarchy rules, the `authorize()` RBAC middleware, login
(including lockout and audit-write behavior), refresh-token validation, and
`usersService` creation/scoping/self-action rules. Tests mock Prisma and
Redis, so they run without a live database.

> **Note on this environment:** the sandbox this module was built in has no
> outbound network access, so `npm install` / `npm test` / `npm run build`
> could not be executed here to produce a live pass/fail transcript. Every
> new/changed `.ts`/`.tsx` file was syntax-checked and manually reviewed
> against the existing codebase's patterns. Please run `npm install && npm
> test && npm run build` in both `backend/` and `frontend/` as your
> acceptance step before approving this module.

## Security properties implemented

- Passwords hashed with bcrypt (cost factor 12), never logged or returned.
- Short-lived access tokens (default 15m) + rotating refresh tokens
  (default 7d), with reuse detection nuking all sessions on suspected theft.
- Redis-backed access-token blacklist honored on every authenticated
  request, so logout is immediate and effective.
- Redis-backed per-account lockout (5 attempts / 15 min → 15 min lockout),
  separate from the existing per-IP `express-rate-limit` guard.
- Password reset tokens are single-use, hashed at rest (SHA-256), and
  expire after 30 minutes; using one revokes every existing session.
- Hotel-scoped RBAC enforced server-side (`assertInScope` +
  `ROLE_HIERARCHY`), never trusting client-supplied `hotelId`/`role` on
  staff create/update.
- Full audit trail for every authentication and staff-management event,
  queryable via a scoped, paginated API.

## Explicitly out of scope (per your instructions)

- No other HMS module (bookings, rooms, payments, housekeeping, maintenance,
  expenses, reviews, reports, notifications, dashboard) was modified beyond
  what was necessary for Auth/RBAC to keep working (e.g. `users.controller`
  already emitted socket events on staff changes — left as-is).
- No Channel Manager / OTA integrations.
- No AI features or AI automation.

---
**This module is now complete and ready for your manual testing. Per your
instructions, no further modules will be built until you approve this one.**
