# NovaStay HMS — Production-Grade Audit Report

Full-system audit covering architecture, database, backend, frontend, APIs,
workflows, module integrations, RBAC, security, multi-property support,
transactions, audit logs, and performance. No new modules were built — this
is exclusively fixes, refactors, and verification of what already existed
(Auth/RBAC, Property Management, Reservation Management, Financial
Management, Expense Management).

**18 issues found and fixed.** Grouped by severity below, each with what was
wrong, the risk it posed, and exactly what changed.

---

## Security

### 1. JWT secrets had no strength validation in production
**File:** `backend/src/config/env.ts`
The app would boot happily with the literal placeholder values shipped in
`.env.example` (`change_this_access_secret_in_production`, etc.) or any
short/weak string, as long as `NODE_ENV=production` was set. Anyone who
forgot to change them would be signing tokens with a publicly-known key —
full authentication bypass.
**Fix:** added `requiredSecret()` — in production, rejects secrets under 32
characters, rejects the known placeholder values by name, and requires
`JWT_ACCESS_SECRET` ≠ `JWT_REFRESH_SECRET`. Fails fast at boot with a clear
message (`Generate one with: openssl rand -hex 32`), not silently.

### 2. Deactivating a staff account didn't revoke their current session
**Files:** `backend/src/middlewares/auth.middleware.ts`, `backend/src/modules/users/users.service.ts`
`deactivate()`/`update({isActive:false})` already revoked refresh tokens,
but a still-valid access token (up to 15 minutes, or longer if
`JWT_ACCESS_EXPIRES_IN` is configured higher) kept working — a fired
employee or compromised account stayed logged in until natural expiry.
**Fix:** deactivation now also sets a Redis flag (`deactivated:{userId}`,
30-day TTL as a safety net) that `authenticate` checks on every request
alongside the existing logout blacklist; `restore()`/`update({isActive:true})`
clears it immediately.

### 3. Stripe webhook replay could double-credit a booking
**File:** `backend/src/modules/payments/payments.service.ts`
Stripe delivers webhooks at-least-once and retries on any non-2xx or
timeout. `recordPayment` had no idempotency check, so a retried
`payment_intent.succeeded` would create a second `Payment` row and
increment `booking.paidAmount` a second time for money that was only paid
once. The `stripePaymentId` column existed on the schema already but was
never populated or checked.
**Fix:** `recordPayment` now accepts an optional `stripePaymentId`; the
webhook path passes the PaymentIntent id, and the service checks for an
existing payment with that id inside the transaction before creating a new
one — a duplicate delivery now returns the original payment untouched
instead of crediting twice.

### 4. Access token was persisted to localStorage unnecessarily
**File:** `frontend/src/store/authStore.ts`
Both the short-lived access token and the long-lived refresh token were
written to localStorage, readable by any injected script (XSS). The access
token never needed to survive a page reload — it's rebuilt from the refresh
token every time.
**Fix:** `partialize` now excludes `accessToken` from persistence; only
`user` and `refreshToken` survive a reload. This closes the at-rest
exposure window for the access token without changing behavior, because
the axios 401 interceptor already silently re-authenticates using the
persisted refresh token (see #16 below for what this required elsewhere).

### 5. `requireHotelId`'s tenant-isolation check was unreachable dead code
**File:** `backend/src/utils/requestHotel.ts`
The function computed `requested = req.user?.hotelId ?? header ?? query ?? body`,
then separately checked `if (req.user?.hotelId && req.user.hotelId !== requested) throw forbidden`.
Because of the `??` ordering, `requested` was *already* forced to
`req.user.hotelId` whenever it existed — so that check could never fire.
**The system was not actually vulnerable** (a pinned user's requested hotel
was always their own, just via the `??` chain rather than the explicit
check), but the code read as if a validation was happening when the real
protection was incidental and easy to break in a future edit.
**Fix:** rewritten to state the property directly — pinned users return
their own `hotelId` immediately, full stop, before any header/query/body is
even read. Added 7 regression tests (`tests/requestHotel.test.ts`) that
lock in the exact tenant-isolation guarantee, including spoofed
header/query/body attempts.

---

## Correctness / data integrity

### 6. Financial invoice reads silently wrote to the database
**File:** `backend/src/modules/financial/invoices/invoices.service.ts`
`listInvoices`/`getInvoice` recomputed each invoice's derived payment status
(PAID/PARTIALLY_PAID/OVERDUE) and, if it had changed, ran an `UPDATE` —
on every single read. A dashboard polling the invoice list, or any GET
request, could trigger a burst of writes proportional to the page size, on
every page load. This is hostile to read replicas (a standard scaling
pattern this pattern would silently break) and adds needless write/lock
load to a hot read path.
**Fix:** split into `derivePaymentState()` (pure, in-memory, used by
list/get — reads are reads now) and `syncInvoiceForBooking()` (persists,
called only when a booking's paid amount actually changes).

### 7. Payments and Refunds never told Financial Management an invoice's paid amount changed
Following directly from #6: once invoice reads stopped opportunistically
fixing up stale data, something has to keep `Invoice.status`/`amountPaid`
correct. Payments and Refunds already own the event that changes it
(`booking.paidAmount`) but never called into the Financial module.
**Fix:** `payments.service.ts#recordPayment` and
`financial/refunds/refunds.service.ts#processRefund` both now call
`syncInvoiceForBooking(bookingId, tx)` inside their existing transaction,
right after they change `paidAmount` — an explicit, event-driven
integration between three previously-disconnected modules, instead of the
read-time guesswork it was papering over.

### 8/9. Housekeeping and Maintenance had non-atomic two-step writes with a stale-data bug
**Files:** `backend/src/modules/housekeeping/housekeeping.service.ts`, `backend/src/modules/maintenance/maintenance.service.ts`
Both `updateTask`/`updateRequest` updated the task/request, then separately
updated the linked room/asset's status as an unrelated second write — if
the process crashed in between, the room/asset could be stuck (e.g. a room
permanently "CLEANING" after its task was actually verified). Worse: the
task/request update's `include: { room/asset: true }` snapshot was taken
*before* the second write ran, so the object returned to the controller —
and broadcast over Socket.IO as `room:status-changed` — carried the room's
**stale, pre-update** status. Real-time clients were being told the wrong
room status.
**Fix:** both dual-writes now run inside `prisma.$transaction`, and the
returned object's nested `room`/`asset` field is explicitly overwritten
with the fresh post-update record before it's returned (and before the
controller broadcasts it).

### 10. SUPER_ADMIN users never received any real-time updates
**Files:** `backend/src/sockets/index.ts`, `frontend/src/hooks/useRealtimeConnection.ts`, `frontend/src/lib/socket.ts`
The socket server auto-joined a `hotel:{hotelId}` room using the hotelId
baked into the connecting user's JWT — which is `null` for SUPER_ADMIN by
design (they're not pinned to one property). There was no mechanism for a
multi-property user to join *any* hotel's room, and no client-side code to
request it, so a SUPER_ADMIN using the hotel switcher got zero live updates
for whichever property they were viewing, ever.
**Fix:** added a `hotel:join` socket event — hotel-pinned users still
auto-join their own room from the JWT (unspoofable); SUPER_ADMIN's client
now emits `hotel:join` on connect and every time the hotel switcher
changes, and the server tracks/replaces their "current" room membership so
switching properties doesn't accumulate stale memberships. Same
tenant-isolation property as `requireHotelId`: a pinned user's join request
is always resolved to their own hotel regardless of what they ask for.

---

## Audit log coverage

Five modules had mutating endpoints with **zero** audit trail — a real gap
for a system whose Auth/RBAC module explicitly exists to provide one.
Added `recordAudit` calls (with the corresponding new `AuditActions`
constants) to:

| Module | Actions now logged |
|---|---|
| **Payments** | payment recorded, duplicate webhook ignored |
| **Guests** | created, updated, deleted (PII) |
| **Housekeeping** | task created, updated, deleted |
| **Maintenance** | request created/updated/deleted; asset created/updated/deleted |
| **Reviews** | management response posted |

---

## Performance / scalability

### 11/12/13. Three unbounded list queries
**Files:** `guests.service.ts#list`, `housekeeping.service.ts#listTasks`, `maintenance.service.ts#listAssets`
None of these had pagination or a result cap — a property that's
accumulated years of guests/tasks/assets would return an ever-growing,
unbounded JSON payload on every page load.
**Fix:** added a `take: 500` safety cap to each (with existing ordering
preserved, and `search` still available to narrow guest results further).
This is a stopgap, not full pagination — noted as a follow-up recommendation
below, since adding real pagination would change these endpoints' response
shape and require corresponding frontend changes, which felt like scope
creep for an audit-and-fix pass versus a deliberate net-new pagination
feature.

### 14. Frontend JS bundle exceeded 1MB with no code-splitting
**File:** `frontend/src/App.tsx`
Every page in the app — Financial Management, Expense Management, Rooms,
Bookings, everything — was statically imported into one chunk. Vite's own
build output flagged it: `dist/assets/index-*.js  1,057.80 kB`. A
receptionist who only ever opens Bookings and Guests was downloading the
entire Financial Reports charting code on first load.
**Fix:** converted every dashboard/feature page (everything except the
small, first-paint-critical Login/ForgotPassword/ResetPassword) to
`React.lazy()`, wrapped in a single `<Suspense>` boundary. Main chunk
dropped to 443.88 kB with the rest split into 20–30 on-demand page chunks
(a few KB each); the build's size warning is gone.

---

## Bugs found and fixed as a side effect of the above

### 15. `HotelSwitcher.tsx` failed to type-check at all
**File:** `frontend/src/components/layout/HotelSwitcher.tsx`
This was flagged in every prior module's delivery notes as a "pre-existing
baseline issue" and left alone on the assumption it was a sandbox artifact.
On closer inspection during this audit it's a real bug: `queryFn:
hotelsApi.list` passes a function whose optional parameter shape doesn't
structurally match TanStack Query v5's `QueryFunctionContext`, which is a
genuine type error anyone would hit running `npm install` fresh today —
not something specific to this sandbox.
**Fix:** wrapped as `queryFn: () => hotelsApi.list()`. The frontend now
builds with **zero** TypeScript errors and **zero** warnings for the first
time.

### 16. Excluding the access token from persistence (fix #4) would have broken login-on-reload
Removing `accessToken` from localStorage (a deliberate security fix) meant
`ProtectedRoute.tsx`'s `if (!accessToken) return <Navigate to="/login">`
would redirect every legitimately-logged-in user to the login screen on
every page reload, since `accessToken` is now `null` until refreshed.
**Fix, done together with #4 rather than after:** added
`hooks/useSessionBootstrap.ts`, which runs once at app start and — if a
`user`+`refreshToken` were restored but no `accessToken` exists — silently
exchanges the refresh token for a fresh session before anything renders.
`App.tsx` now waits on this before mounting routes, and `ProtectedRoute`
was corrected to gate on `user` (the actual persisted signal for "is there
a session") rather than the deliberately-non-persisted `accessToken`.

### 17. Dead empty `backend/src/modules/assets/` directory
Leftover from early scaffolding; asset management was actually implemented
inside `maintenance.service.ts` (correctly — assets and maintenance
requests are tightly coupled). The empty directory was just clutter.
**Fix:** removed.

### 18. Minor implicit-`any` cleanup
`payments.service.ts`'s revenue-summary `.reduce()` callback had no
parameter types — harmless at runtime, but worth tightening while already
in the file for the idempotency fix. Fixed.

---

## Audited and found solid (no changes needed)

Worth stating explicitly, since a "found nothing" module is still a
verified module: the following were reviewed in depth and are genuinely
production-ready as-is —

- **Booking creation** (`bookings.service.ts`): double-booking prevention
  via a Redis distributed lock (`NX`, 10s TTL, released in a `finally`)
  *plus* a re-check of overlapping bookings inside the same DB transaction.
  Belt-and-suspenders, correctly implemented, locks always released.
- **Privilege escalation guards** (`users.service.ts`, `roleHierarchy.ts`):
  every role-assignment path checks `canManageRole`, blocks self-role-change,
  blocks non-SUPER_ADMIN from ever creating/promoting-to SUPER_ADMIN, and
  scopes hotel-assignment strictly. No gaps found.
- **Stripe webhook signature verification**: correctly uses
  `stripe.webhooks.constructEvent` with the raw body and signing secret
  (the raw-body route is correctly registered before `express.json()`).
- **Rate limiting**: a stricter dedicated limiter on `/auth/*` beyond the
  global one; session listing/revocation endpoints exist and work.
  Password reset revokes all refresh tokens.
- **Hotels module** (`hotels.service.ts`): soft-delete with slug-reuse
  handling, hard-delete only permitted with zero historical records,
  full audit coverage already in place.
- **Dashboard aggregation queries**: properly parallelized with
  `Promise.all`, no N+1 patterns, hotel-scoped throughout.

---

## Verification performed

Same sandbox constraint noted in every prior module's README applies here
too: `binaries.prisma.sh` (Prisma's engine-binary host) isn't reachable
from this sandbox, so the Prisma Client here is an untyped stub — the
*only* build errors present anywhere in the project are the resulting
missing-enum-type diagnostics (`Prisma.XxxWhereInput`, `Role`,
`BookingStatus`, etc.), confirmed by grepping the full error list and
excluding those specific TS codes: **zero other backend errors remain.**

- **Backend build**: clean except the above.
- **Backend tests**: 59 passing across 10 suites that don't touch the
  missing types; the other 13 fail to *compile* for the same stub-client
  reason, not because of a real regression — each fix's test file (the two
  new suites, `paymentsService.test.ts` and `requestHotel.test.ts`, plus
  the existing financial invoice/refund suites touched by fixes #6/#7) was
  additionally verified to actually pass by temporarily relaxing the same
  handful of `Prisma.XxxWhereInput` type annotations (reverted immediately
  after, confirmed via diff against the pre-edit backups — not present in
  delivered code).
- **Frontend build**: `tsc -b && vite build` — **zero errors, zero
  warnings.** This is the first time in this project's delivery history
  that's been true; every prior module's README documented one lingering
  `HotelSwitcher.tsx` error as a "pre-existing baseline issue" — this audit
  found and fixed the actual bug (#15) rather than continuing to attribute
  it to the sandbox.
- **Migrations**: no schema changes were made in this audit pass (every fix
  was code-level), so the existing 3-migration history is untouched and
  still applies cleanly in sequence — re-verified against a fresh
  PostgreSQL 16 database.

## Recommended follow-ups (not fixed here — flagged for a deliberate pass)

- **Refresh token storage**: still in localStorage (fix #4 only addressed
  the access token). Migrating to an httpOnly cookie would close the
  remaining XSS exposure window but requires CORS-credentials, CSRF
  protection, and reworking the login/refresh/logout endpoints — a
  deliberate change, not an audit-scope fix.
- **Full pagination** for Guests/Housekeeping/Assets (currently a `take: 500`
  safety cap — see #11–13) if any property's history grows past that.
- Prisma's engine binaries should be reachable in whatever environment
  actually deploys this — confirm `binaries.prisma.sh` isn't blocked by a
  corporate proxy/firewall before going live, since that would reproduce
  every "stub client" symptom described above in production, which would
  be a real outage rather than a sandbox artifact.
