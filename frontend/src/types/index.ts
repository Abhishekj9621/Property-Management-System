export type Role = "SUPER_ADMIN" | "HOTEL_ADMIN" | "MANAGER" | "RECEPTIONIST" | "HOUSEKEEPING" | "GUEST";

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  hotelId: string | null;
  avatarUrl?: string | null;
}

export type RoomStatus = "AVAILABLE" | "RESERVED" | "OCCUPIED" | "DIRTY" | "CLEANING" | "MAINTENANCE" | "OUT_OF_SERVICE";
export type BookingStatus = "PENDING" | "CONFIRMED" | "CHECKED_IN" | "CHECKED_OUT" | "CANCELLED" | "NO_SHOW";
export type PaymentMethod = "CARD" | "CASH" | "BANK_TRANSFER" | "WALLET";
export type PaymentStatus = "PENDING" | "PAID" | "PARTIALLY_PAID" | "FAILED" | "REFUNDED";

export interface HotelType {
  id: string;
  name: string;
  code: string;
  description?: string | null;
  icon?: string | null;
  isActive: boolean;
  sortOrder: number;
}

export interface RoomCategory {
  id: string;
  name: string;
  code: string;
  description?: string | null;
  isActive: boolean;
  sortOrder: number;
}

export interface Hotel {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  address: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  phone: string;
  email: string;
  timezone: string;
  hotelTypeId?: string | null;
  hotelType?: HotelType | null;
  starRating?: number | null;
  checkInTime: string;
  checkOutTime: string;
  defaultTaxPercent?: string | number;
  amenities: string[];
  images: string[];
  isActive: boolean;
  createdAt: string;
  createdBy?: { id: string; firstName: string; lastName: string; email: string } | null;
  _count?: { rooms: number; bookings: number; guests: number; users: number };
}

// Public curatdconcepts.com listing for a hotel — see WebsiteListing in
// schema.prisma for why this is separate from Hotel itself.
export interface WebsiteListing {
  hotelId: string;
  isPublished: boolean;
  rating: string | number | null;
  reviewCount: number;
  platformLinks: Record<string, string>;
}


export interface Payment {
  id: string;
  bookingId: string;
  amount: string | number;
  method: PaymentMethod;
  status: PaymentStatus;
  paidAt?: string | null;
  createdAt: string;
  booking?: {
    bookingRef: string;
    guest: { firstName: string; lastName: string };
  };
}

export interface RoomType {
  id: string;
  name: string;
  code?: string | null;
  description?: string;
  categoryId?: string | null;
  category?: RoomCategory | null;
  basePrice: string | number;
  weekendPrice?: string | number | null;
  extraBedPrice?: string | number | null;
  taxPercent: string | number;
  discountPercent: string | number;
  minOccupancy: number;
  maxOccupancy: number;
  bedType?: string;
  sizeSqft?: number;
  amenities: string[];
  images: string[];
  isActive: boolean;
}

export interface Room {
  id: string;
  roomNumber: string;
  floor: number;
  view?: string | null;
  smokingAllowed?: boolean;
  status: RoomStatus;
  roomType: RoomType;
  roomTypeId: string;
  hotelId: string;
}

export interface Guest {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  loyaltyTier: string;
  vip: boolean;
  createdAt: string;
}

export interface BookingRoomLine {
  id: string;
  room: Room;
  roomType: RoomType;
  pricePerNight: string | number;
  nights: number;
}

export interface Booking {
  id: string;
  bookingRef: string;
  guest: Guest;
  checkInDate: string;
  checkOutDate: string;
  status: BookingStatus;
  adults: number;
  children: number;
  totalAmount: string | number;
  paidAmount: string | number;
  rooms: BookingRoomLine[];
  createdAt: string;
}

export interface DashboardOverview {
  totalRooms: number;
  occupiedRooms: number;
  occupancyRate: number;
  adr: number;
  revPar: number;
  arrivalsToday: number;
  departuresToday: number;
  revenueTrend: { date: string; revenue: number }[];
  roomStatusBreakdown: { status: RoomStatus; count: number }[];
}

export type MaintenancePriority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type MaintenanceRequestStatus = "OPEN" | "IN_PROGRESS" | "ON_HOLD" | "COMPLETED" | "CANCELLED";
export type AssetStatus = "IN_SERVICE" | "UNDER_MAINTENANCE" | "RETIRED" | "DISPOSED";
export type ExpenseStatus = "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED" | "REIMBURSED" | "PAID";

export interface Asset {
  id: string;
  name: string;
  category: string;
  serialNumber?: string | null;
  location?: string | null;
  purchaseDate?: string | null;
  purchaseCost?: string | number | null;
  warrantyExpiry?: string | null;
  status: AssetStatus;
  notes?: string | null;
  createdAt: string;
}

export interface MaintenanceRequest {
  id: string;
  title: string;
  description?: string | null;
  location?: string | null;
  priority: MaintenancePriority;
  status: MaintenanceRequestStatus;
  asset?: Asset | null;
  assignee?: { id: string; firstName: string; lastName: string; role: Role } | null;
  reportedBy?: { id: string; firstName: string; lastName: string } | null;
  estimatedCost?: string | number | null;
  actualCost?: string | number | null;
  createdAt: string;
}

export interface ExpenseCategory {
  id: string;
  name: string;
  code?: string | null;
  isActive?: boolean;
}

export interface Vendor {
  id: string;
  hotelId?: string | null;
  name: string;
  contactName?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  taxId?: string | null;
  paymentTerms?: string | null;
  notes?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ExpenseAttachment {
  id: string;
  url: string;
  fileName?: string | null;
  createdAt: string;
}

export type RecurrenceFrequency = "WEEKLY" | "MONTHLY" | "QUARTERLY" | "YEARLY";

export interface RecurringExpense {
  id: string;
  hotelId: string;
  title: string;
  description?: string | null;
  amount: string | number;
  category?: ExpenseCategory | null;
  vendor?: Vendor | null;
  isReimbursable: boolean;
  frequency: RecurrenceFrequency;
  startDate: string;
  endDate?: string | null;
  nextRunDate: string;
  lastRunAt?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ExpenseBudget {
  id: string;
  hotelId: string;
  categoryId?: string | null;
  category?: ExpenseCategory | null;
  year: number;
  month?: number | null;
  amount: string | number;
  alertThresholdPercent: number;
  committedSpend: number;
  actualSpend: number;
  remaining: number;
  percentUsed: number;
  createdAt: string;
  updatedAt: string;
}

export interface Expense {
  id: string;
  title: string;
  description?: string | null;
  amount: string | number;
  vendor?: string | null;
  vendorRecord?: { id: string; name: string; contactName?: string | null; phone?: string | null; email?: string | null } | null;
  isReimbursable: boolean;
  receiptUrl?: string | null;
  attachments?: ExpenseAttachment[];
  status: ExpenseStatus;
  expenseDate: string;
  category?: ExpenseCategory | null;
  submittedBy?: { id: string; firstName: string; lastName: string; role: Role } | null;
  approvedBy?: { id: string; firstName: string; lastName: string } | null;
  rejectionReason?: string | null;
  paymentMethod?: PaymentMethod | null;
  paymentReference?: string | null;
  paidAt?: string | null;
  recurringExpenseId?: string | null;
  createdAt: string;
}

export interface StaffUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  role: Role;
  hotelId: string | null;
  hotel?: { id: string; name: string; slug: string } | null;
  isActive: boolean;
  isEmailVerified: boolean;
  createdById: string | null;
  createdBy?: { id: string; firstName: string; lastName: string; role: Role } | null;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------
// Financial Management module
// ---------------------------
export type InvoiceStatus = "DRAFT" | "ISSUED" | "PARTIALLY_PAID" | "PAID" | "OVERDUE" | "VOID";
export type InvoiceType = "STANDARD" | "PROFORMA";
export type CreditNoteStatus = "ISSUED" | "VOID";
export type RefundStatus = "REQUESTED" | "APPROVED" | "REJECTED" | "PROCESSED";
export type LedgerEntryType = "REVENUE" | "TAX" | "DISCOUNT" | "REFUND" | "EXPENSE" | "ADJUSTMENT";
export type LedgerDirection = "DEBIT" | "CREDIT";
export type LedgerSourceType = "BOOKING" | "INVOICE" | "PAYMENT" | "EXPENSE" | "REFUND" | "CREDIT_NOTE" | "MANUAL";
export type FinancialPeriodStatus = "OPEN" | "CLOSED";

export interface InvoiceLineItem {
  id: string;
  description: string;
  quantity: string | number;
  unitPrice: string | number;
  taxPercent: string | number;
  amount: string | number;
}

export interface Invoice {
  id: string;
  hotelId: string;
  bookingId?: string | null;
  booking?: { id: string; bookingRef: string; checkInDate: string; checkOutDate: string; paidAmount: string | number; totalAmount: string | number } | null;
  guestId?: string | null;
  guest?: { id: string; firstName: string; lastName: string; email: string; phone: string } | null;
  invoiceNumber: string;
  type: InvoiceType;
  status: InvoiceStatus;
  subtotal: string | number;
  tax: string | number;
  discount: string | number;
  total: string | number;
  amountPaid: string | number;
  dueDate?: string | null;
  notes?: string | null;
  voidedAt?: string | null;
  voidReason?: string | null;
  lineItems: InvoiceLineItem[];
  creditNotes?: CreditNote[];
  createdBy?: { id: string; firstName: string; lastName: string } | null;
  issuedAt: string;
  updatedAt: string;
}

export interface CreditNote {
  id: string;
  hotelId: string;
  invoiceId: string;
  invoice?: { id: string; invoiceNumber: string; total: string | number };
  creditNoteNumber: string;
  reason: string;
  amount: string | number;
  status: CreditNoteStatus;
  issuedBy?: { id: string; firstName: string; lastName: string } | null;
  issuedAt: string;
  voidedAt?: string | null;
}

export interface Refund {
  id: string;
  hotelId: string;
  bookingId: string;
  booking?: { id: string; bookingRef: string; paidAmount: string | number; totalAmount: string | number; guest: { firstName: string; lastName: string; email: string } };
  paymentId?: string | null;
  payment?: { id: string; amount: string | number; method: PaymentMethod; status: PaymentStatus } | null;
  amount: string | number;
  reason: string;
  method: PaymentMethod;
  status: RefundStatus;
  transactionRef?: string | null;
  requestedBy?: { id: string; firstName: string; lastName: string } | null;
  approvedBy?: { id: string; firstName: string; lastName: string } | null;
  rejectionReason?: string | null;
  processedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TaxRate {
  id: string;
  hotelId?: string | null;
  name: string;
  code?: string | null;
  percentage: string | number;
  isActive: boolean;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LedgerEntry {
  id: string;
  hotelId: string;
  entryDate: string;
  type: LedgerEntryType;
  direction: LedgerDirection;
  amount: string | number;
  description: string;
  sourceType: LedgerSourceType;
  sourceId?: string | null;
  referenceCode?: string | null;
  createdBy?: { id: string; firstName: string; lastName: string } | null;
  createdAt: string;
}

export interface FinancialPeriodClose {
  id: string;
  hotelId: string;
  businessDate: string;
  status: FinancialPeriodStatus;
  totalRevenue: string | number;
  totalTax: string | number;
  totalRefunds: string | number;
  totalExpenses: string | number;
  netCashPosition: string | number;
  notes?: string | null;
  closedBy?: { id: string; firstName: string; lastName: string } | null;
  closedAt: string;
  reopenedBy?: { id: string; firstName: string; lastName: string } | null;
  reopenedAt?: string | null;
}

