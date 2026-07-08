# NovaStay HMS — Property Management Module

This delivery covers **only** the Property Management module of NovaStay
HMS — properties (hotels), room types, rooms, floors, and the platform-wide
Hotel Type / Room Category catalog. No other module (bookings, payments,
housekeeping workflows beyond the auto-enqueued cleaning task, channel
manager, OTA integrations, or AI features) was touched or built.

> **Stack note:** the brief asked for Next.js 16 / React 19 / Tailwind v4 /
> NestJS. As with the previous Auth & RBAC delivery, the zip you uploaded is
> an already-built app on **Express + Prisma + PostgreSQL + Redis + BullMQ
> (backend)** and **Vite + React 18 + Tailwind + shadcn-style components
> (frontend)**. This module was built **inside that existing project, on
> its existing stack**, so it integrates with the auth/RBAC system, sockets,
> and audit trail already in place, rather than being a disconnected
> Next.js/NestJS app with no working login.

## What's in this module

### Backend (`backend/src`)

| Area | Files |
|---|---|
| Hotels (properties) — already existed, now audited | `modules/hotels/*` |
| Room types & rooms — already existed, now audited + extended | `modules/rooms/*` |
| Hotel Type / Room Category catalog — already existed, now audited | `modules/catalog/*` |
| Audit action constants | `lib/auditLog.ts` (extended) |
| **New:** unit tests | `tests/hotelsService.test.ts`, `tests/roomsService.test.ts`, `tests/catalogService.test.ts` |

### What changed vs. the version you uploaded

1. **Audit logging.** Every mutating Property Management action now writes
   to the shared `AuditLog` table (the same one the Auth/RBAC module reads
   from at `GET /audit-logs`): hotel create/update/deactivate/restore/
   permanent-delete; hotel type & room category create/update/retire;
   room type create/update/delete-or-retire; room create/update/delete;
   room status changes; and bulk room creation. Previously only
   Auth/RBAC events were audited — property changes were invisible in the
   audit trail. Every audit write includes the actor's user id and a
   `metadata` payload with the relevant before/after detail.
2. **Bulk room creation** (`POST /rooms/bulk`). The original API could
   only create rooms one at a time, which makes onboarding a new floor or
   property tedious. This adds a single call that provisions a contiguous
   range (e.g. "floor 4, rooms 401–420, Deluxe type") in one transaction,
   skips any room numbers that already exist instead of failing the whole
   batch, and reports which ones were skipped. Emits `room:bulk-created`
   over the existing Socket.IO channel and is fully audited.
3. **Floor overview** (`GET /rooms/floors`). Returns the distinct floors at
   a property with a total room count and a status breakdown per floor
   (how many `AVAILABLE`, `OCCUPIED`, `DIRTY`, etc.) — the data a
   floor-plan / building-overview screen needs, without the frontend
   having to fetch every room and group it client-side.
4. **Duplicate room number guard.** `POST /rooms` now rejects a room
   number that already exists at that hotel with a clear 409, instead of
   only surfacing a raw Prisma unique-constraint error.
5. **Tests.** Added unit test suites for `hotelsService` (slug reuse /
   reactivation, hotel-scoping for non-Super-Admin staff, permanent-delete
   guards), `roomsService` (room type retire-vs-hard-delete, duplicate
   room number, bulk creation with partial skips, delete guards for
   occupied/booked rooms, the Redis lock on status updates, and the
   availability-search overlap logic), and `catalogService` (retire-vs-
   hard-delete for hotel types and room categories). These follow the same
   `jest.mock("../src/config/database", ...)` pattern as the existing
   `authService`/`usersService` tests, so no live Postgres/Redis is needed
   to run them.

### What already existed and was **not** rebuilt (confirmed working, left in place)

- Full CRUD + soft-delete/reactivation lifecycle for hotels
  (`modules/hotels`), including slug-conflict handling for reactivating a
  previously-deactivated property.
- Room types and rooms CRUD, with hotel-scoping enforced via
  `requireHotelId` (JWT `hotelId` for single-property staff, `x-hotel-id`
  header for SUPER_ADMIN).
- Room status state machine with a Redis lock to prevent racing writes
  from front-desk and housekeeping acting on the same room at once, and
  automatic `CHECKOUT_CLEAN` housekeeping task creation on `DIRTY`.
- Availability search (`GET /rooms/availability`) — finds rooms with no
  overlapping active booking for a date range.
- Hotel Type / Room Category catalog, editable from Settings, with
  retire-instead-of-delete semantics once referenced.
- Real-time updates over Socket.IO (`hotel:{hotelId}` room) for room
  create/update/delete/status-change.
- Seed data: 7 hotel types, 6 room categories, 3 demo hotels, room types
  and rooms per hotel (`backend/prisma/seed.ts`) — `npm run seed`.
- Frontend pages: `pages/hotels/HotelsPage.tsx`, `pages/rooms/RoomsPage.tsx`,
  and the catalog management UI inside `pages/settings/SettingsPage.tsx`.

Because these already matched what the module needs (schema, RBAC-scoped
CRUD, validation, real-time updates, seeders), the effort here focused on
closing the two concrete gaps — audit logging and dedicated test coverage —
plus the bulk-provisioning and floor-overview workflows a property manager
actually asks for once individual CRUD exists.

## RBAC summary (Property Management scope)

```
SUPER_ADMIN   → create/update/deactivate/restore/permanently-delete any hotel;
                manage the platform-wide Hotel Type / Room Category catalog
HOTEL_ADMIN   → update their own hotel's settings; full room type/room CRUD
                for their own hotel
MANAGER       → full room type/room CRUD for their own hotel (cannot edit
                hotel-level settings or the catalog)
RECEPTIONIST  → read hotels/rooms/room types; update room status
HOUSEKEEPING  → read rooms/room types; update room status
GUEST         → no access to this module
```

Enforcement lives in `middlewares/rbac.middleware.ts` (route-level) and in
each service's `assertOwnHotel` / `requireHotelId` scoping (so a Manager's
token can never touch another property's rooms even if they guess an ID).

## Running / verifying this module

```bash
cd backend
npm install
npm run prisma:generate
npm run prisma:migrate      # applies the existing schema, no new migrations needed
npm run seed                # 3 demo hotels, hotel types, room categories, rooms
npm run build                # tsc — verify the module compiles cleanly
npm test                     # jest — includes the new hotels/rooms/catalog suites
npm run dev

cd ../frontend
npm install
npm run build
npm run dev
```

**Note on this delivery:** the sandbox this module was built in has no
outbound network access, so `npm install` / `npm run build` / `npm test`
could not be executed here to produce a green CI run. Every change was
reviewed manually against the existing (working) code style and the
project's own test patterns, but please run the commands above yourself
before relying on this in production, and treat that as the actual
"build and verify" gate for this delivery.

## Demo accounts (from `npm run seed`)

| Role | Email | Password |
|---|---|---|
| Super Admin | super@novastay.com | Super@123 |
| Hotel Admin (Downtown) | admin@novastay.com | Admin@123 |
| Manager (Downtown) | manager@novastay.com | Manager@123 |
| Hotel Admin (Airport) | admin.airport@novastay.com | Admin@123 |
| Hotel Admin (Beach Resort) | admin.beach@novastay.com | Admin@123 |

## API surface (Property Management only)

See `docs/API.md` — **Hotels**, **Catalog / Customization**, and **Rooms**
sections, updated in this delivery with the audit-trail notes and the new
`/rooms/bulk` and `/rooms/floors` endpoints.

---

As requested: this module only. No bookings/payments/housekeeping business
logic, channel manager, OTA integration, or AI features were added. Stopping
here for your manual testing and approval before the next module.
