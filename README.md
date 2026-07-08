# 🏨 NovaStay HMS — Enterprise Hotel Management System

A production-grade, multi-property Hotel Management System built on the modern React + Node.js ecosystem.

This backend also doubles as the sole API for the public curatdconcepts.com
marketing site (`src/modules/public/`) — see `docs/API.md`'s "Public
Website API" section and `DEPLOY_RAILWAY_VERCEL.md` for how that's wired up.

## Tech Stack

### Backend
| Concern | Choice | Why |
|---|---|---|
| Runtime/Language | Node.js 20 + TypeScript | Type safety, huge ecosystem |
| Framework | Express 4 | Battle-tested, minimal, huge middleware ecosystem |
| ORM / DB | Prisma + PostgreSQL 16 | Type-safe queries, migrations, relational integrity for bookings |
| Cache / Sessions / Locks | Redis 7 (ioredis) | Room-availability locking, rate limiting, refresh-token store |
| Auth | JWT (access + refresh) + bcrypt + RBAC | Stateless, scalable, revocable via Redis blacklist |
| Validation | Zod | Compile-time + runtime schema safety |
| Background Jobs | BullMQ (Redis-backed) | Emails, invoice generation, no-show auto-cancel |
| Realtime | Socket.IO | Live room-status board, housekeeping updates |
| Payments | Stripe SDK | PCI-compliant, industry standard |
| Docs | Swagger/OpenAPI (swagger-jsdoc + swagger-ui-express) | Self-documenting API |
| Logging | Winston + Morgan | Structured logs, request tracing |
| Testing | Jest + Supertest | Unit + integration |
| Security | Helmet, express-rate-limit, cors, express-mongo-sanitize style input sanitization, hpp | OWASP baseline |

### Frontend
| Concern | Choice | Why |
|---|---|---|
| Framework | React 18 + TypeScript + Vite | Fast HMR, modern build, tree-shaking |
| Routing | React Router v6 | Nested routes, protected routes |
| Server State | TanStack Query v5 | Caching, retries, optimistic updates |
| Client State | Zustand | Lightweight auth/UI state, no boilerplate |
| Forms | React Hook Form + Zod resolver | Performant, schema-validated |
| Styling | Tailwind CSS + shadcn/ui primitives | Consistent design system, accessible components |
| Charts | Recharts | Dashboard KPIs, occupancy/revenue graphs |
| HTTP | Axios (interceptors for refresh-token rotation) | |
| Calendar | React Big Calendar (booking timeline) | |

### Architecture Pattern
**Layered / Modular Monolith** (Controller → Service → Repository via Prisma) organized as **feature modules**, each self-contained (routes, controller, service, schema). This is the pragmatic industry choice for HMS at this scale — easy to later extract a module (e.g., Payments) into a microservice if load demands it, without a premature-distributed-systems tax.

```
Client Request
   → Route (auth + RBAC middleware)
   → Zod Validation Middleware
   → Controller (HTTP concerns only)
   → Service (business logic, transactions)
   → Prisma Repository Layer
   → PostgreSQL
```

Cross-cutting: centralized error handler → `ApiError`, structured `ApiResponse`, Winston request logging, Redis caching for read-heavy endpoints (room availability), Socket.IO events emitted from services on state changes.

## Monorepo Layout
```
hms/
├── backend/            # Express + TS API
├── frontend/           # React + TS SPA
├── docs/               # Architecture, ERD, API guide
└── docker-compose.yml  # Postgres + Redis + backend + frontend
```

## Core Modules
1. **Auth** — register/login, JWT access+refresh rotation, RBAC (SUPER_ADMIN, HOTEL_ADMIN, MANAGER, RECEPTIONIST, HOUSEKEEPING, GUEST), password reset.
2. **Hotels** — multi-property support (chain-level).
3. **Rooms & Room Types** — inventory, pricing, amenities, status machine (AVAILABLE → RESERVED → OCCUPIED → DIRTY → CLEANING → AVAILABLE / MAINTENANCE).
4. **Bookings/Reservations** — availability search (date-range overlap query), create/modify/cancel, check-in/check-out, folio.
5. **Guests** — CRM-style profiles, stay history, loyalty tier.
6. **Payments & Invoices** — Stripe PaymentIntents, invoice generation, refunds.
7. **Housekeeping** — task queue tied to room status changes, staff assignment.
8. **Dashboard/Analytics** — occupancy rate, ADR, RevPAR, revenue trend, upcoming arrivals/departures.
9. **Notifications** — email (booking confirmation, cancellation) via BullMQ worker.

## Quick Start

```bash
# 1. Clone & configure
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# 2. Boot everything (Postgres, Redis, API, Web)
docker compose up --build

# 3. Run migrations + seed demo data (first time only, in another shell)
docker compose exec backend npx prisma migrate deploy
docker compose exec backend npx prisma db seed

# App:      http://localhost:5173
# API:      http://localhost:4000/api/v1
# API Docs: http://localhost:4000/api/docs
```

### Local (non-docker) dev
```bash
cd backend && npm install && npx prisma generate && npx prisma migrate dev && npm run dev
cd frontend && npm install && npm run dev
```

## Demo Credentials (after seed)
| Role | Email | Password | Scope |
|---|---|---|---|
| Super Admin | super@novastay.com | Super@123 | Entire platform, all hotels |
| Hotel Admin | admin@novastay.com | Admin@123 | NovaStay Downtown only |
| Manager | manager@novastay.com | Manager@123 | NovaStay Downtown only |
| Receptionist | frontdesk@novastay.com | Front@123 | NovaStay Downtown only |
| Housekeeping | clean@novastay.com | Clean@123 | NovaStay Downtown only |
| Hotel Admin | admin.airport@novastay.com | Admin@123 | NovaStay Airport only |
| Hotel Admin | admin.beach@novastay.com | Admin@123 | NovaStay Beach Resort only |

These are **demo** credentials with well-known passwords — fine for local evaluation, not for production. For a real deployment, run:

```bash
cd backend && npm run create:super-admin
```

This interactively creates one real, platform-level Super Admin (or promotes an existing account) with a password you choose. From there, log in and use the **Team** page to create Hotel Admins/Managers/Receptionists/Housekeeping and assign each to a specific hotel — see "Hierarchy & access control" below.

## Hierarchy & access control

Staff accounts form a strict hierarchy, enforced on the backend (`backend/src/lib/roleHierarchy.ts`) and mirrored in the UI so nobody is ever offered an action the API would reject:

```
SUPER_ADMIN   → can create/manage HOTEL_ADMIN, MANAGER, RECEPTIONIST, HOUSEKEEPING for ANY hotel
HOTEL_ADMIN   → can create/manage MANAGER, RECEPTIONIST, HOUSEKEEPING — only for their own hotel
MANAGER       → can create/manage RECEPTIONIST, HOUSEKEEPING — only for their own hotel
RECEPTIONIST / HOUSEKEEPING → no staff-management rights
```

- Every staff account (except Super Admin) is pinned to exactly one hotel via `hotelId`. All hotel-scoped API routes (`/rooms`, `/bookings`, `/guests`, `/users`, hotel `PATCH`, etc.) verify `req.user.hotelId` server-side — a Manager can never read or write another property's data, even by guessing an ID.
- `users.createdById` records who provisioned each account, so the Team page can show "created by" for auditing.
- Super Admin creates a hotel (Hotels page) → creates a Hotel Admin and assigns them to that hotel (Team page) → that Hotel Admin can then staff their own property.

## Customization: Hotel Types, Currencies, Room Categories & Pricing

Rather than hard-coded enums, hotel types, currencies, and room categories are database-backed lookup tables managed from **Settings** (Super Admin only):
- **Hotel Types** — Business, Resort, Boutique, Budget, Luxury, Serviced Apartment, Hostel, or any custom type you add.
- **Currencies** — any ISO 4217 code with its own symbol and decimal precision; each hotel picks one.
- **Room Categories** — Standard, Deluxe, Suite, Executive, Family, Presidential, or custom, used to group Room Types.

Room Types (Rooms page → Room Types) support full pricing customization: base price, optional weekend price override, extra-bed price, per-type tax %, per-type discount %, min/max occupancy, bed type, and size. Booking totals are computed per room line using each room type's own tax/discount, not a single hotel-wide flat rate.

## Fixed: "can't add a hotel after deleting all of them"

Hotels are soft-deleted (deactivated) rather than erased, so historical bookings/guests survive — but that also means a hotel's `slug` stays reserved in the database even after it's deactivated. Previously, trying to re-add a hotel with a previously-used slug failed with an opaque database error and no way to see or recover the deactivated hotel. This is now fixed:
- The **Hotels** page has **Active / Inactive / All** tabs (Super Admin) so deactivated hotels are never invisible.
- Inactive hotels can be **Restored** in one click, or **permanently deleted** once they have zero bookings/guests/staff on record.
- If you try to create a hotel whose slug belongs to a deactivated one, the form now shows a clear "Restore & reuse this slug" option instead of a dead-end error.

## Further Docs
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — deep dive on system design, scaling strategy
- [`docs/ERD.md`](docs/ERD.md) — entity relationship diagram & schema rationale
- [`docs/API.md`](docs/API.md) — endpoint reference
- [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) — production deployment (AWS/Render/Fly.io) guidance
- [`DEPLOY_RAILWAY_VERCEL.md`](DEPLOY_RAILWAY_VERCEL.md) — concrete click-by-click Railway (backend + Postgres + Redis) + Vercel (frontend) walkthrough

## License
MIT — provided as a reference architecture / starter kit.
