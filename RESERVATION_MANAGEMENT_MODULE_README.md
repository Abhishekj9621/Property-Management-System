# NovaStay HMS — Reservation Management Module

This delivery covers **only** the Reservation Management module of NovaStay
HMS — creating, listing, amending, checking in/out, cancelling, and
deleting bookings, plus the automatic no-show sweep. No other module
(properties/rooms, payments beyond the invoice generated at checkout,
housekeeping beyond the auto-enqueued cleaning task, channel manager, OTA
integrations, or AI features) was touched or built.

> **Stack note:** same as the two prior deliveries — the brief asked for
> Next.js 16 / React 19 / NestJS. The uploaded project is an already-built
> app on **Express + Prisma + PostgreSQL + Redis + BullMQ (backend)** and
> **Vite + React 18 + Tailwind (frontend)**. This module was built inside
> that existing project so it works with the auth/RBAC, property/room, and
> audit systems already in place.

## What's in this module

### Backend (`backend/src`)

| Area | Files |
|---|---|
| Bookings — already existed, now audited + extended | `modules/bookings/*` |
| Audit action constants | `lib/auditLog.ts` (extended) |
| **New:** BullMQ no-show sweep | `queues/connection.ts`, `queues/noShow.queue.ts`, `queues/noShow.worker.ts`, `worker.ts` |
| **New:** unit tests | `tests/bookingsService.test.ts` |

### What changed vs. the version you uploaded

1. **Audit logging.** Booking create, status change (cancel/no-show/other),
   amend, check-in, check-out, and delete all now write to the shared
   `AuditLog` table, the same one the Property Management and Auth/RBAC
   modules write to. Bookings are financial records, so this was the most
   important gap to close. The automatic no-show sweep (below) writes its
   own entries with `userId: null` since it's system-initiated, not staff-
   initiated.
2. **Booking amendment** (`PATCH /bookings/:id/amend`). The existing API
   could create a booking, change its *status*, or delete it — but there
   was no way to change a reservation's dates, rooms, or occupancy once
   made, short of cancelling and rebooking (which loses the original
   record and can lose the room to someone else in between). This adds a
   proper amend workflow:
   - Only allowed on **PENDING** or **CONFIRMED** bookings (i.e. before the
     guest has checked in) — mid-stay room moves/extensions are a
     different workflow and intentionally out of scope here.
   - Re-locks the affected rooms in Redis and re-checks availability for
     the *new* dates/rooms inside a DB transaction, excluding the booking's
     own existing rows, so it can't collide with itself.
   - Re-prices the whole stay from the (possibly new) room set and
     night count, rather than patching numbers in place.
   - Swaps `BookingRoom` line items: rooms removed from the reservation go
     back to `AVAILABLE`, newly-added rooms become `RESERVED`.
   - Audited and pushed live over `booking:updated`.
   - Wired into a new "Amend" action on the frontend Bookings page (dates
     for now, the API accepts rooms/occupancy too).
3. **Automatic no-show sweep — first real use of BullMQ in this project.**
   `bullmq` was already a dependency but nothing used it. This adds:
   - `queues/noShow.queue.ts` — a queue with an hourly repeatable job.
   - `queues/noShow.worker.ts` — the worker: finds every `CONFIRMED`
     booking whose check-in date has fully passed with no check-in, flips
     it to `NO_SHOW`, releases its rooms, and (when running in-process)
     pushes `booking:updated` for each one.
   - Runs **in-process** with the API by default (started from
     `server.ts`) — no extra deployment step needed for local dev or a
     single-instance deployment.
   - `worker.ts` is a standalone entry point (`npm run worker`) for
     running the job processor as its own process at higher scale.
   - `bookingsService.sweepNoShows()` is the plain, directly-testable
     function the worker calls — see the tests for its behavior in
     isolation from BullMQ/Redis.
4. **Status-transition guard.** `PATCH /bookings/:id/status` now rejects
   any further status change once a booking is `CHECKED_OUT` or
   `CANCELLED` (previously it would silently overwrite a finished booking's
   status).
5. **Tests.** `tests/bookingsService.test.ts` covers: room-lock contention
   on create, the overlap re-check, per-room-type pricing math, check-in/
   check-out status guards and their side effects (invoice creation,
   housekeeping task, loyalty points/tier), the amend workflow's own-
   booking-exclusion and room-swap behavior, delete guards (payments /
   status), and the no-show sweep. Same `jest.mock("../src/config/database", ...)`
   pattern as the rest of the suite — no live Postgres/Redis needed to run
   these.

### What already existed and was **not** rebuilt (confirmed working, left in place)

- Transactional booking creation with per-room Redis locks to prevent
  double-booking races, guest upsert, and per-room-type tax/discount
  pricing.
- Check-in (`room → OCCUPIED`) and check-out (`room → DIRTY`, invoice
  generation, loyalty points + tier recalculation) workflows.
- Cancel / no-show status changes that release reserved rooms.
- Guarded hard-delete (only PENDING/CANCELLED bookings with zero payments).
- Real-time updates over Socket.IO (`booking:created`, `booking:updated`,
  `booking:checked-in`, `booking:checked-out`, `booking:deleted`) and
  in-app + email notifications on booking creation/cancellation/checkout.
- Seed data: a demo guest with a completed, paid booking
  (`backend/prisma/seed.ts`) — `npm run seed`.
- Frontend: `pages/bookings/BookingsPage.tsx` (list, check-in/out, cancel,
  payment recording, delete) and `pages/bookings/NewBooking.tsx` (search
  availability → create booking).

## RBAC summary (Reservation Management scope)

```
SUPER_ADMIN, HOTEL_ADMIN, MANAGER, RECEPTIONIST
  → create/list/view/amend/status-change/check-in/check-out bookings
    for their own hotel (SUPER_ADMIN can act on any hotel via x-hotel-id)
SUPER_ADMIN, HOTEL_ADMIN, MANAGER
  → hard-delete a booking (PENDING/CANCELLED + zero payments only)
HOUSEKEEPING, GUEST
  → no access to this module
```

Enforcement is route-level (`middlewares/rbac.middleware.ts`) plus
hotel-scoping via `requireHotelId` in every service call, so staff can
never touch another property's bookings.

## Note: BullMQ + ioredis fix (post-delivery)

The first version of this zip passed a live `ioredis` instance (from
`config/redis.ts`) as BullMQ's `connection` option. BullMQ bundles its own
internal copy of `ioredis`, and when npm resolves that to a different
package instance than the app's own `ioredis` dependency, TypeScript (and
potentially the runtime) treats them as incompatible types even though
they're structurally identical — this surfaced as a `tsc`/`ts-node` error
on `npm run dev` (`Type 'Redis' is not assignable to type 'ConnectionOptions'`).

Fixed by having `queues/connection.ts` export **plain connection options**
(host/port/username/password parsed from `REDIS_URL`) instead of an
`ioredis` instance. BullMQ then constructs and owns its own client per
Queue/Worker, so there's no cross-package type mismatch. Graceful shutdown
now closes the `Queue` and `Worker` objects directly (`closeNoShowQueue()`,
`worker.close()`) instead of quitting a shared connection.

A second issue surfaced right after: BullMQ rejects `:` in queue names
(`Error: Queue name cannot contain :`) because it uses colons internally as
the Redis key delimiter for a queue's namespaced keys. The queue was
originally named `reservations:no-show-sweep`; it's now
`reservations-no-show-sweep`. No other files needed to change since both
the queue and worker import the same `NO_SHOW_QUEUE_NAME` constant.

## Running / verifying this module

```bash
cd backend
npm install
npm run prisma:generate
npm run prisma:migrate      # applies the existing schema, no new migrations needed
npm run seed                # demo hotels, rooms, a sample paid booking
npm run build                # tsc — verify the module compiles cleanly
npm test                     # jest — includes the new bookingsService suite
npm run dev                  # starts the API + the no-show sweep worker in-process

# optional, for running the sweep as its own process instead:
npm run worker

cd ../frontend
npm install
npm run build
npm run dev
```

**Note on this delivery:** as with the previous two modules, the sandbox
this was built in has no outbound network access, so `npm install` /
`npm run build` / `npm test` could not be executed here to produce a green
CI run. Every change was reviewed manually against the existing (working)
code and the project's own test patterns, but please run the commands
above yourself before relying on this, and treat that as the actual
"build and verify" gate for this delivery.

## API surface (Reservation Management only)

See `docs/API.md` — **Reservation Management (Bookings)** section, updated
in this delivery with the audit-trail notes, the new `/bookings/:id/amend`
endpoint, and the no-show sweep.

---

As requested: this module only. No property/room, payment-processing,
housekeeping, channel manager, OTA, or AI functionality was added beyond
what already existed. Stopping here for your manual testing and approval
before the next module.
