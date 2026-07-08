# Architecture

## 1. Guiding Principles
1. **Modular monolith over premature microservices.** A hotel chain's booking engine, payments, and housekeeping are tightly coupled by transactional consistency (a booking touches rooms, guests, payments, and invoices atomically). Splitting these into services before there's a proven scaling need adds distributed-transaction complexity for no benefit. Each module is still isolated enough (own routes/controller/service/schema) to be extracted later.
2. **Correctness of the booking engine is non-negotiable.** Double-booking a room is the single worst failure mode of an HMS. See §3.
3. **Stateless API tier.** Access tokens are short-lived JWTs; no server-side session store is required to authenticate a request, so the API tier scales horizontally behind a load balancer. Redis is used only for locks, refresh-token adjacent lookups, and rate limiting/caching — not primary session state.

## 2. Request Lifecycle
```
Client → Helmet/CORS/Compression → Rate Limiter → Route
       → authenticate (JWT verify) → authorize (RBAC) → validate (Zod)
       → Controller (HTTP only) → Service (business logic + Prisma transaction)
       → PostgreSQL
       ← Structured ApiResponse / ApiError
```
Errors thrown anywhere (including inside `async` handlers, thanks to `express-async-errors`) are funneled to a single `errorHandler`, which also translates known Prisma error codes (unique constraint, FK violation, not-found) into clean HTTP responses instead of leaking stack traces.

## 3. Preventing Double-Booking (the core correctness problem)
A naive "check availability, then insert" has a race window between two concurrent requests for the same room/date range. NovaStay closes it with two layers:

1. **Redis distributed lock** (`SET key NX EX 10`) per room ID for the duration of the booking transaction — a cheap, fast guard against the common case of two front-desk agents clicking "Book" within milliseconds of each other.
2. **Re-validation inside the Postgres transaction.** Even if the lock layer were bypassed, the transaction re-queries for overlapping `BookingRoom` rows using the interval-overlap predicate `existing.checkIn < newCheckOut AND existing.checkOut > newCheckIn` before inserting. Combined with Postgres's transactional isolation, this makes double-booking structurally impossible, not just unlikely.

Room status changes (e.g., `DIRTY` → triggers a housekeeping task) are also lock-guarded so a housekeeping app and a front-desk override can't race.

## 4. Data Model Highlights
- **`BookingRoom` join table** — a booking can span multiple rooms (group/family bookings) and stores the price-per-night *at time of booking*, so later room-type price changes never retroactively alter historical invoices.
- **`Guest` is hotel-scoped, `User` is platform-scoped.** A `Guest` record exists per hotel (their stay history, loyalty tier are property-specific in this model); a `User` is only created for staff accounts and, optionally, guests who create a portal login (`Guest.userId` links them).
- **Soft status machines** — `Room.status` and `Booking.status` are enums with explicit, service-layer-enforced transitions rather than a generic string, preventing invalid states like "checked out but still occupied."

## 5. AuthN/AuthZ
- Passwords hashed with bcrypt (cost factor 12).
- Access token (15 min) + refresh token (7 days), refresh tokens persisted in Postgres so they can be revoked (logout, password reset) and rotated on every refresh (mitigates replay if a refresh token leaks).
- RBAC via a simple `authorize(...roles)` middleware — sufficient for the 6 roles in scope; if permission logic grows more granular (e.g., per-hotel resource ownership), this is the seam to introduce a policy engine (CASL, OPA).

## 6. Realtime Layer
Socket.IO namespaces clients into `hotel:{hotelId}` rooms on connect (JWT-authenticated handshake). Services emit domain events (`room:status-changed`, `booking:created`, `booking:checked-in`, `housekeeping:task-updated`) after a successful DB write, giving the front-desk dashboard and housekeeping board live updates without polling.

## 7. Caching & Performance
- Room-type/availability reads are natural caching candidates (Redis, short TTL) once traffic grows — not enabled by default in this reference build to keep the source of truth obviously the database, but the seam is `roomsService.searchAvailability`.
- Prisma's connection pooling + indexed columns (`hotelId+status`, `checkInDate/checkOutDate`, `guestId`) keep the hot paths (availability search, booking list) fast at the schema level (see `schema.prisma` `@@index` annotations).
- `compression` middleware + HTTP/2-friendly static hosting (Nginx) on the frontend.

## 8. Background Jobs
BullMQ (Redis-backed queues) is wired in as a dependency for jobs that shouldn't block the request/response cycle: booking-confirmation emails, invoice PDF generation, no-show auto-cancellation sweeps. The reference implementation ships the queue infra; wiring specific job processors is a documented extension point (`src/jobs/`).

## 9. Observability
Winston structured logging (JSON in production) + Morgan HTTP access logs feed into whatever log aggregator the deployment target uses (CloudWatch, Datadog, ELK). Swagger/OpenAPI is generated from JSDoc annotations on route files, served at `/api/docs`, so the contract is always in sync with the code.

## 10. Scaling Path
| Growth vector | Mitigation already in place | Next step |
|---|---|---|
| More concurrent bookings | Redis locks + transactional re-check | Move to Postgres advisory locks or a saga/outbox pattern if cross-service |
| More hotels (multi-tenant) | `hotelId` scoping baked into every query | Row-level security policies in Postgres for defense-in-depth |
| More API traffic | Stateless JWT auth, horizontal pod/replica scaling | Add a CDN + Redis read cache for availability search |
| Reporting/analytics load | Simple aggregation queries today | Read replica or a dedicated OLAP store (ClickHouse) fed via CDC |
