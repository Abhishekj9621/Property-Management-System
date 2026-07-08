# API Reference

Base URL: `http://localhost:4000/api/v1`
Interactive Swagger UI: `http://localhost:4000/api/docs`

All authenticated endpoints require `Authorization: Bearer <accessToken>`.
All responses follow: `{ success, message, data, meta? }` on success, `{ success: false, message, details? }` on error.

## Auth
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/auth/register` | Public | Register a guest account |
| POST | `/auth/login` | Public | Login, returns access + refresh tokens |
| POST | `/auth/refresh` | Public (refresh token in body) | Rotate access/refresh tokens |
| POST | `/auth/logout` | Public (refresh token in body) | Revoke refresh token |
| POST | `/auth/forgot-password` | Public | Request password reset token |
| POST | `/auth/reset-password` | Public | Reset password with token |
| GET | `/auth/me` | Bearer | Current authenticated identity |

## Hotels
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/hotels?status=active\|inactive\|all&search=` | Bearer | List hotels — SUPER_ADMIN sees the requested `status`; everyone else only ever sees their own hotel |
| GET | `/hotels/:id` | Bearer | Hotel details |
| POST | `/hotels` | SUPER_ADMIN | Create a hotel. If the slug belongs to a deactivated hotel, returns 409 unless `reactivateIfInactive: true` is sent, which restores + overwrites it instead |
| PATCH | `/hotels/:id` | SUPER_ADMIN, HOTEL_ADMIN | Update hotel settings (Hotel Admin restricted to their own hotel); audited |
| DELETE | `/hotels/:id` | SUPER_ADMIN | Deactivate (soft delete) — bookings/guests/rooms are preserved; audited |
| POST | `/hotels/:id/restore` | SUPER_ADMIN | Reactivate a deactivated hotel; audited |
| DELETE | `/hotels/:id/permanent` | SUPER_ADMIN | Hard delete — only allowed once the hotel has zero bookings/guests/staff on record; audited |

All create/update/deactivate/restore/permanent-delete actions above write an entry to `AuditLog` (`entity: "Hotel"`), viewable via `GET /audit-logs`.

## Team / Staff Hierarchy (`/users`)
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/users?hotelId&role&includeInactive&search` | SUPER_ADMIN, HOTEL_ADMIN, MANAGER | List staff — non-Super-Admins are auto-scoped to their own hotel and to roles they're allowed to manage |
| POST | `/users` | SUPER_ADMIN, HOTEL_ADMIN, MANAGER | Create a staff account. `role` must be one the caller's role can manage (see README "Hierarchy"); `hotelId` is required from SUPER_ADMIN, and forced to the caller's own hotel otherwise |
| GET | `/users/:id` | SUPER_ADMIN, HOTEL_ADMIN, MANAGER | Staff detail (must be in scope) |
| PATCH | `/users/:id` | SUPER_ADMIN, HOTEL_ADMIN, MANAGER | Update name/phone/role/hotel/active — role & hotel reassignment rules enforced server-side |
| POST | `/users/:id/reset-password` | SUPER_ADMIN, HOTEL_ADMIN, MANAGER | Reset a subordinate's password (revokes their refresh tokens) |
| DELETE | `/users/:id` | SUPER_ADMIN, HOTEL_ADMIN, MANAGER | Deactivate a staff account |
| POST | `/users/:id/restore` | SUPER_ADMIN, HOTEL_ADMIN, MANAGER | Reactivate a staff account |

## Catalog / Customization
| Method | Path | Auth | Description |
|---|---|---|---|
| GET / POST / PATCH / DELETE | `/hotel-types` | Read: Bearer · Write: SUPER_ADMIN | Manage the Hotel Type list (Business, Resort, Boutique, …) |
| GET / POST / PATCH / DELETE | `/room-categories` | Read: Bearer · Write: SUPER_ADMIN | Manage the Room Category list (Standard, Deluxe, Suite, …) |

Deleting a hotel type/room category that's already referenced by a hotel or room type retires it (`isActive: false`) instead of deleting, so existing records keep a valid reference. NovaStay HMS operates exclusively in Indian Rupees (INR); there is no currency configuration or FX endpoint. All catalog writes are audited (`entity: "HotelType"` / `"RoomCategory"`).

## Rooms
All room endpoints resolve the hotel from the caller's JWT (`hotelId`) or the `x-hotel-id` header for SUPER_ADMIN / multi-property users — see `requireHotelId` in the README.

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/rooms/availability?checkInDate&checkOutDate&adults` | Staff | Search available room types/rooms for a date range |
| GET | `/rooms/types?includeInactive=` | Staff | List room types |
| POST | `/rooms/types` | Manager+ | Create room type (audited) |
| PATCH | `/rooms/types/:id` | Manager+ | Update room type (audited) |
| DELETE | `/rooms/types/:id` | Manager+ | Retire room type if in use, else hard-delete (audited) |
| GET | `/rooms/floors` | Staff, Housekeeping | Distinct floors with per-floor room count + status breakdown |
| GET | `/rooms?status&roomTypeId&floor` | Staff, Housekeeping | List rooms (filterable) |
| POST | `/rooms` | Manager+ | Create a single room (rejects duplicate room numbers; audited; emits `room:created`) |
| POST | `/rooms/bulk` | Manager+ | Provision a contiguous range of rooms in one call (`roomTypeId, floor, startNumber, count, prefix?`); skips numbers that already exist and reports them; audited; emits `room:bulk-created` |
| GET | `/rooms/:id` | Staff, Housekeeping | Room details |
| PATCH | `/rooms/:id` | Manager+ | Update room details (audited; emits `room:updated`) |
| DELETE | `/rooms/:id` | Manager+ | Delete a room — blocked if occupied/reserved or has active/upcoming bookings (audited; emits `room:deleted`) |
| PATCH | `/rooms/:id/status` | Staff, Housekeeping | Update room status; Redis-locked to prevent racing writes; `DIRTY` auto-enqueues a `CHECKOUT_CLEAN` housekeeping task (audited; emits `room:status-changed`) |

## Reservation Management (Bookings)
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/bookings` | Staff | Create booking — locks each room in Redis, re-validates availability inside the DB transaction, upserts the guest, prices per room-type tax/discount; audited; emits `booking:created` |
| GET | `/bookings?status&from&to&page&limit` | Staff | Paginated booking list |
| GET | `/bookings/:id` | Staff | Booking details incl. rooms, payments, invoice |
| PATCH | `/bookings/:id/status` | Staff | Update status (CANCELLED, NO_SHOW, etc.); blocked once a booking is CHECKED_OUT or CANCELLED; releases reserved rooms on cancel/no-show; audited; emits `booking:updated` |
| PATCH | `/bookings/:id/amend` | Staff | Change check-in/out dates, rooms, occupancy, special requests, or discount on a PENDING/CONFIRMED (not yet checked-in) booking — re-validates availability for the new dates/rooms, re-prices the stay, releases rooms no longer used and reserves any newly-added ones; audited; emits `booking:updated` |
| POST | `/bookings/:id/check-in` | Staff | Check in guest, room → OCCUPIED; audited; emits `booking:checked-in` |
| POST | `/bookings/:id/check-out` | Staff | Check out guest, room → DIRTY (auto-enqueues housekeeping), generates invoice, awards loyalty points; audited; emits `booking:checked-out` |
| DELETE | `/bookings/:id` | Manager+ | Hard-delete — only PENDING/CANCELLED bookings with zero recorded payments; audited; emits `booking:deleted` |

**Auto no-show sweep:** a BullMQ job runs hourly and flips any CONFIRMED booking whose check-in date has fully elapsed without a check-in to `NO_SHOW`, releasing its rooms. It runs in-process with the API by default; run it as its own process with `npm run worker` to scale it independently. Every flip is audited (`RESERVATION_BOOKING_NO_SHOW_AUTO`) with `userId: null` since it's system-initiated.

All create/status-change/amend/check-in/check-out/delete actions above write to `AuditLog` (`entity: "Booking"`).

## Guests
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/guests` | Staff | Create guest profile |
| GET | `/guests?search=` | Staff | Search/list guests |
| GET | `/guests/:id` | Staff | Guest profile + booking history |
| PATCH | `/guests/:id` | Staff | Update guest |

## Payments
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/payments/intent` | Staff | Create Stripe PaymentIntent for a booking |
| POST | `/payments` | Staff | Record a manual/offline payment |
| GET | `/payments/booking/:bookingId` | Staff | List payments for a booking |
| POST | `/webhooks/stripe` | Stripe signature | Stripe webhook receiver (raw body) |

## Housekeeping
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/housekeeping` | Manager+ | Create a task |
| GET | `/housekeeping?status&assigneeId` | Staff | List tasks |
| PATCH | `/housekeeping/:id` | Staff | Advance task status (emits `housekeeping:task-updated`) |

## Dashboard
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/dashboard/overview` | Staff | Occupancy, ADR, RevPAR, revenue trend, room-status breakdown |
| GET | `/dashboard/upcoming` | Staff | Arrivals/departures in the next 7 days |

## Notifications
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/notifications?unreadOnly&page&limit` | Any authenticated user | List my in-app notifications |
| PATCH | `/notifications/read-all` | Any authenticated user | Mark all as read |
| PATCH | `/notifications/:id/read` | Any authenticated user | Mark one as read |
| DELETE | `/notifications/:id` | Any authenticated user | Delete a notification |

## Reviews
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/reviews` | Staff | Record a guest review for a checked-out booking |
| GET | `/reviews?page&limit` | Staff | List published reviews with rating averages |
| PATCH | `/reviews/:id/respond` | Manager+ | Post a public management response |

## Reports (CSV export)
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/reports/bookings.csv?from&to` | Manager+ | Download bookings as CSV |
| GET | `/reports/revenue.csv?from&to` | Manager+ | Download payment ledger as CSV |
| GET | `/reports/occupancy.csv?from&to` | Manager+ | Download daily occupancy as CSV |

## Expense Management (`/expenses/*`)
All routes below are hotel-scoped via the same `x-hotel-id` header / JWT hotelId
convention as the rest of the API. "Staff" = SUPER_ADMIN, HOTEL_ADMIN, MANAGER,
RECEPTIONIST, HOUSEKEEPING (anyone can submit/track their own claims).
"Manager+" = SUPER_ADMIN, HOTEL_ADMIN, MANAGER. "High-value approver" =
SUPER_ADMIN, HOTEL_ADMIN only.

### Expenses & claims — `/expenses`
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/expenses?status&isReimbursable&submittedById&vendorId&categoryId&from&to&page&limit` | Staff | Paginated list with status-summary totals. Non-managers are automatically scoped to their own claims regardless of `submittedById` |
| POST | `/expenses` | Staff | Submit a claim/operating expense (status starts SUBMITTED); optional inline `attachments[]`; checks the relevant budget and proactively notifies managers the moment a category crosses its alert threshold |
| GET | `/expenses/:id` | Staff | Detail — 403s for non-managers viewing someone else's claim |
| PATCH | `/expenses/:id` | Staff | Edit while still DRAFT/SUBMITTED — only the original submitter or a manager |
| POST | `/expenses/:id/attachments` | Staff | Attach another receipt/document URL |
| DELETE | `/expenses/:id/attachments/:attachmentId` | Staff | Remove an attachment |
| POST | `/expenses/:id/decision` | Manager+ (see below) | Approve / reject / mark REIMBURSED / mark PAID. Rejecting requires `rejectionReason`; reimbursing/paying accepts `paymentMethod` + `paymentReference` |
| DELETE | `/expenses/:id` | Staff | Delete while DRAFT/SUBMITTED/REJECTED only |

**Multi-level (high-value) approval:** if the hotel has `highValueExpenseThreshold`
configured, approving (SUBMITTED → APPROVED) an expense at or above that amount
requires a high-value approver (HOTEL_ADMIN/SUPER_ADMIN) — a plain MANAGER gets
a 403 naming who can approve it instead. Every other transition is unaffected.

### Categories — `/expenses/categories`
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/expenses/categories?includeInactive` | Staff | List categories (this hotel's + platform-wide) |
| POST | `/expenses/categories` | Manager+ | Create a hotel-scoped category |
| PATCH | `/expenses/categories/:id` | Manager+ | Update/deactivate a category |

### Vendors — `/expenses/vendors`
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/expenses/vendors?includeInactive` | Staff | List vendors (this hotel's + platform-wide) |
| POST | `/expenses/vendors` | Manager+ | Create a vendor |
| GET | `/expenses/vendors/:id` | Staff | Vendor detail |
| GET | `/expenses/vendors/:id/spend-summary` | Manager+ | Total approved+ spend and expense count for this vendor |
| PATCH | `/expenses/vendors/:id` | Manager+ | Update a vendor |
| DELETE | `/expenses/vendors/:id` | Manager+ | Soft-delete (sets `isActive: false`) |

### Budgets — `/expenses/budgets`
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/expenses/budgets?year&month&categoryId` | Manager+ | List budgets with live committed/actual spend, remaining, and percent-used computed from Expense rows (never a stored running total) |
| POST | `/expenses/budgets` | Manager+ | Create a budget for a hotel+category+period (`categoryId` omitted = overall budget; `month` omitted = annual) |
| PATCH | `/expenses/budgets/:id` | Manager+ | Update the amount or alert threshold |
| DELETE | `/expenses/budgets/:id` | Manager+ | Delete a budget |

### Recurring expenses — `/expenses/recurring`
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/expenses/recurring?includeInactive` | Manager+ | List templates |
| POST | `/expenses/recurring` | Manager+ | Create a template (rent, subscriptions, contracts) — a daily sweep auto-generates a SUBMITTED `Expense` from it each time `nextRunDate` arrives, then advances `nextRunDate` by its frequency |
| GET | `/expenses/recurring/:id` | Manager+ | Template detail |
| PATCH | `/expenses/recurring/:id` | Manager+ | Update a template |
| POST | `/expenses/recurring/:id/pause` / `/resume` | Manager+ | Pause/resume generation |
| DELETE | `/expenses/recurring/:id` | Manager+ | Delete the template — expenses it already generated keep their history |

### Reports — `/expenses/reports`
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/expenses/reports/summary?from&to` | Manager+ | Total spend, pending-approval total, and awaiting-reimbursement total |
| GET | `/expenses/reports/by-category?from&to` (+ `.csv`) | Manager+ | Spend grouped by category, sorted descending |
| GET | `/expenses/reports/by-vendor?from&to` (+ `.csv`) | Manager+ | Spend grouped by vendor, sorted descending |
| GET | `/expenses/reports/monthly-trend?months` | Manager+ | Total spend per month for the last N months (default 6) |

Every mutating action above writes to `AuditLog` (`entity` = `Expense` /
`ExpenseCategory` / `Vendor` / `ExpenseBudget` / `RecurringExpense`) and emits
the matching Socket.IO event listed below.

## Financial Management (`/financial/*`)
All routes below are hotel-scoped via the same `x-hotel-id` header / JWT hotelId
convention as the rest of the API. "Staff" = SUPER_ADMIN, HOTEL_ADMIN, MANAGER,
RECEPTIONIST. "Manager+" = SUPER_ADMIN, HOTEL_ADMIN, MANAGER.

### Invoices — `/financial/invoices`
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/financial/invoices?status&type&guestId&bookingId&from&to&page&limit` | Staff | Paginated invoice list with status-summary totals |
| POST | `/financial/invoices` | Staff | Create an invoice — booking-linked or ad-hoc (guestId only); computes subtotal/tax/total from line items; issues immediately unless `asDraft: true`; posts REVENUE/TAX/DISCOUNT ledger entries when issued; blocked if the hotel's financial period is already closed for today |
| GET | `/financial/invoices/:id` | Staff | Invoice detail incl. line items, credit notes; payment status (PAID/PARTIALLY_PAID/OVERDUE) is refreshed from the linked booking's paid amount on read |
| PATCH | `/financial/invoices/:id` | Staff | Edit a DRAFT invoice's line items/discount/notes/due date |
| POST | `/financial/invoices/:id/issue` | Staff | Transition a DRAFT/PROFORMA invoice to ISSUED, generating its invoice number and posting ledger entries |
| POST | `/financial/invoices/:id/void` | Manager+ | Void an invoice (not allowed once fully PAID — issue a credit note instead); posts an offsetting ADJUSTMENT entry |
| POST | `/financial/invoices/:id/mark-paid` | Staff | Mark an **ad-hoc** (non-booking) invoice as paid; booking-linked invoices are paid via the Payments module and sync automatically |

### Credit Notes — `/financial/credit-notes`
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/financial/credit-notes?invoiceId&status` | Staff | List credit notes |
| POST | `/financial/credit-notes` | Manager+ | Issue a credit note against an invoice (amount capped at invoice total minus prior credits); posts an ADJUSTMENT debit |
| GET | `/financial/credit-notes/:id` | Staff | Credit note detail |
| POST | `/financial/credit-notes/:id/void` | Manager+ | Void a credit note; posts a reversing credit |

### Refunds — `/financial/refunds`
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/financial/refunds?status&bookingId&from&to` | Staff | Paginated refund list with status-summary totals |
| POST | `/financial/refunds` | Staff | Request a refund against a booking (and optionally a specific payment); capped at the booking's refundable balance |
| GET | `/financial/refunds/:id` | Staff | Refund detail |
| POST | `/financial/refunds/:id/decision` | Manager+ | Approve or reject a REQUESTED refund (`rejectionReason` required when rejecting) |
| POST | `/financial/refunds/:id/process` | Manager+ | Process an APPROVED refund — decrements the booking's paid amount, flips the source Payment to REFUNDED when fully refunded, posts a REFUND ledger debit; blocked if the financial period is closed |

### Tax Rates — `/financial/tax-rates`
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/financial/tax-rates?includeInactive` | Staff | List tax rates (this hotel's + platform-wide) |
| POST | `/financial/tax-rates` | Manager+ | Create a hotel-scoped tax rate; setting `isDefault` unsets any prior default |
| PATCH | `/financial/tax-rates/:id` | Manager+ | Update a tax rate |
| DELETE | `/financial/tax-rates/:id` | Manager+ | Soft-delete (sets `isActive: false`) |

### General Ledger — `/financial/ledger`
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/financial/ledger?type&direction&sourceType&from&to` | Manager+ | Paginated, append-only ledger with debit/credit/net summary |
| POST | `/financial/ledger/manual-entries` | Manager+ | Post a manual adjustment entry (e.g. bank reconciliation write-off); blocked if the financial period is closed |

### Day-End / Night Audit — `/financial/period-close`
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/financial/period-close?from&to` | Manager+ | Close history |
| GET | `/financial/period-close/preview?businessDate` | Manager+ | Computes revenue/tax/refunds/expenses/net-cash for a business date without closing it |
| POST | `/financial/period-close/close` | Manager+ | Closes the books for a business date — once closed, no invoice/refund/credit-note/ledger entry can be dated on or before that day for this hotel |
| POST | `/financial/period-close/:id/reopen` | HOTEL_ADMIN/SUPER_ADMIN | Reopens the **most recently closed** period only (must reopen in reverse order) |

### Financial Reports — `/financial/reports`
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/financial/reports/profit-and-loss?from&to` | Manager+ | Revenue, tax, refunds, expenses, net profit for a date range |
| GET | `/financial/reports/profit-and-loss.csv?from&to` | Manager+ | Same, as CSV download |
| GET | `/financial/reports/ar-aging` | Manager+ | Outstanding invoice balances bucketed 0/1-30/31-60/61-90/90+ days |
| GET | `/financial/reports/ar-aging.csv` | Manager+ | Same, as CSV download |
| GET | `/financial/reports/daily-cash?date` | Manager+ | Cash collected by payment method, refunds/expenses paid out, and net cash for one date |
| GET | `/financial/reports/consolidated?from&to` | SUPER_ADMIN | Cross-property P&L rollup with grand totals |

All create/decide/process/void/close/reopen actions above write to `AuditLog`
(`entity` = `Invoice` / `CreditNote` / `Refund` / `TaxRate` / `LedgerEntry` /
`FinancialPeriodClose`), and the mutating ones emit their corresponding
Socket.IO event listed below.

## Realtime (Socket.IO)
Connect with `auth: { token: accessToken }`; the server auto-joins `hotel:{hotelId}`.

| Event | Payload | Emitted when |
|---|---|---|
| `room:status-changed` | `Room` | A room's status is updated |
| `room:created` | `Room` | A room is added to a property |
| `room:updated` | `Room` | A room's details are edited |
| `room:deleted` | `{ id }` | A room is removed |
| `room:bulk-created` | `{ created, createdCount, skipped }` | A batch of rooms is provisioned via `/rooms/bulk` |
| `booking:created` | `Booking` | A new booking is made |
| `booking:updated` | `Booking` | Status change (cancel, no-show) |
| `booking:checked-in` / `booking:checked-out` | `Booking` | Guest check-in/out |
| `housekeeping:task-updated` | `HousekeepingTask` | A cleaning/maintenance task advances |
| `payment:recorded` | `Payment` | A payment is recorded (manual or Stripe webhook) |
| `notification:new` | `Notification` | A staff member receives a new in-app alert |
| `expense:created` / `expense:updated` / `expense:deleted` | `Expense` | Expense claim lifecycle changes (including auto-generated recurring expenses) |
| `expense-category:created` / `expense-category:updated` | `ExpenseCategory` | Category changes |
| `vendor:created` / `vendor:updated` / `vendor:deactivated` | `Vendor` | Vendor changes |
| `expense-budget:created` / `expense-budget:updated` / `expense-budget:deleted` | `ExpenseBudget` | Budget changes |
| `recurring-expense:created` / `recurring-expense:updated` / `recurring-expense:deleted` | `RecurringExpense` | Recurring expense template changes |
| `invoice:created` / `invoice:issued` / `invoice:voided` / `invoice:paid` | `Invoice` | Invoice lifecycle changes |
| `creditnote:issued` / `creditnote:voided` | `CreditNote` | Credit note lifecycle changes |
| `refund:requested` / `refund:approved` / `refund:rejected` / `refund:processed` | `Refund` | Refund workflow changes |
| `taxrate:created` / `taxrate:updated` / `taxrate:deactivated` | `TaxRate` | Tax rate changes |
| `ledger:entry-created` | `LedgerEntry` | A manual ledger entry is posted |
| `period:closed` / `period:reopened` | `FinancialPeriodClose` | Day-end close/reopen |

## Email notifications
Booking confirmation, cancellation, checkout (with loyalty points earned), payment
receipts, and password-reset links are sent via `src/utils/mailer.ts`. If `SMTP_HOST`
is not configured, emails are logged instead of sent (safe default for local dev).

## Loyalty program
Guests earn 1 loyalty point per ₹100 spent, applied automatically at
checkout. Tiers: BRONZE (0+), SILVER (500+), GOLD (2000+), PLATINUM (5000+).

## Public Website API (`/public/*`)
This backend is the only backend for both the internal management app
*and* the public curatdconcepts.com marketing site — these two endpoints
are what the public site's browser bundle calls directly. No user
session, no shared secret (a secret can't be hidden in browser JS anyway)
— CORS (`CORS_ORIGINS`, see `app.ts`) is what actually restricts which
sites can call these from a browser.

| Method | Path | Notes |
|---|---|---|
| GET | `/public/listings` | Every hotel with a **published** `WebsiteListing` — merged photos/amenities, AC/Non-AC per room type, rating (manual override or computed from published Reviews), review count, OTA platform links. See `src/modules/public/public.service.ts` for the exact shape. |
| POST | `/public/contact` | `{ name, email, phone?, subject?, message }` → emails `CONTACT_INBOX_EMAIL` via the existing mailer. Rate-limited (10/15min) since there's no auth to lean on. |

## Website Listing management (`/hotels/:id/website-listing`)
Authenticated, same RBAC scope as editing the hotel itself
(`SUPER_ADMIN`/`HOTEL_ADMIN`). This is how staff publish a hotel to
curatdconcepts.com and set the marketing-only fields the ops system
doesn't track.

| Method | Path | Notes |
|---|---|---|
| GET | `/hotels/:id/website-listing` | Returns defaults (`isPublished: false`, etc.) if never saved before, rather than 404. |
| PUT | `/hotels/:id/website-listing` | `{ isPublished?, rating?, reviewCount?, platformLinks? }` — upserts. |

## Photo uploads (`/uploads/:folder`)
Authenticated (`SUPER_ADMIN`/`HOTEL_ADMIN`), `multipart/form-data`, field
name `images` (up to 10 files, 8MB each). `:folder` is `hotels` or
`room-types`. Uploads to Cloudflare R2 (see `src/utils/r2.ts` and the
`R2_*` env vars) and returns `{ urls: string[] }` — save those URLs into
the hotel's or room type's `images[]` via the normal update endpoint.
Returns a clear 400 if R2 isn't configured yet, rather than an SDK crash.
