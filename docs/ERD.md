# Entity Relationship Diagram & Schema Rationale

```
Hotel 1───* User
Hotel 1───* RoomType 1───* Room
Hotel 1───* Guest
Hotel 1───* Booking

Guest 1───* Booking
Booking 1───* BookingRoom *───1 Room
BookingRoom *───1 RoomType

Booking 1───* Payment
Booking 1───1 Invoice

Room 1───* HousekeepingTask *───1 User (assignee)

User 1───* RefreshToken
User 1───* AuditLog
User 1───1 Guest (optional, guest portal login)
```

## Why a `BookingRoom` join table instead of `Booking.roomId`?
Group and family reservations routinely span multiple rooms under one itinerary/folio. Modeling `Booking 1─*─BookingRoom─*─1 Room` supports that natively, and each line item freezes `pricePerNight` + `nights` at booking time — so a later room-type price change never mutates a historical invoice.

## Why is `Guest` hotel-scoped, not global?
Loyalty tiers, notes, and stay history are property-specific in most independent/boutique HMS deployments (this is also how Opera PMS and Cloudbeds model it). A `Guest.userId` optionally links to a platform-wide `User` for guests who create a self-service portal login, without forcing every walk-in guest to have an account.

## Status Machines
**Room.status**
```
AVAILABLE → RESERVED → OCCUPIED → DIRTY → CLEANING → AVAILABLE
                                        ↘ MAINTENANCE / OUT_OF_SERVICE (any time)
```

**Booking.status**
```
PENDING → CONFIRMED → CHECKED_IN → CHECKED_OUT
                    ↘ CANCELLED
        ↘ NO_SHOW
```
Transitions are enforced in `bookings.service.ts` (e.g., you cannot check out a booking that was never checked in) rather than left to the client.

## Key Indexes
| Table | Index | Purpose |
|---|---|---|
| `rooms` | `(hotelId, status)` | Room-status board filtering |
| `bookings` | `(hotelId, status)`, `(checkInDate, checkOutDate)` | Availability search, dashboard KPIs |
| `booking_rooms` | `(roomId)` | Overlap-detection query in booking creation |
| `guests` | `(hotelId, email)` | CRM search / dedup on booking creation |

## Money & Precision
All monetary columns use `Decimal(10,2)` (Prisma/Postgres `NUMERIC`), never floating point, to avoid rounding drift across tax/discount calculations and payment reconciliation.
