import { Router } from "express";
import authRoutes from "../modules/auth/auth.routes";
import hotelRoutes from "../modules/hotels/hotels.routes";
import roomRoutes from "../modules/rooms/rooms.routes";
import bookingRoutes from "../modules/bookings/bookings.routes";
import guestRoutes from "../modules/guests/guests.routes";
import paymentRoutes from "../modules/payments/payments.routes";
import housekeepingRoutes from "../modules/housekeeping/housekeeping.routes";
import dashboardRoutes from "../modules/dashboard/dashboard.routes";
import usersRoutes from "../modules/users/users.routes";
import catalogRoutes from "../modules/catalog/catalog.routes";
import notificationsRoutes from "../modules/notifications/notifications.routes";
import reviewsRoutes from "../modules/reviews/reviews.routes";
import reportsRoutes from "../modules/reports/reports.routes";
import maintenanceRoutes from "../modules/maintenance/maintenance.routes";
import expensesRoutes from "../modules/expenses/expenses.routes";
import auditLogsRoutes from "../modules/audit-logs/audit-logs.routes";
import financialRoutes from "../modules/financial/financial.routes";
import publicRoutes from "../modules/public/public.routes";
import uploadsRoutes from "../modules/uploads/uploads.routes";

const router = Router();

router.use("/auth", authRoutes);
router.use("/hotels", hotelRoutes);
router.use("/rooms", roomRoutes);
router.use("/bookings", bookingRoutes);
router.use("/guests", guestRoutes);
router.use("/payments", paymentRoutes);
router.use("/housekeeping", housekeepingRoutes);
router.use("/dashboard", dashboardRoutes);
router.use("/users", usersRoutes);
router.use("/", catalogRoutes); // exposes /hotel-types, /currencies, /room-categories
router.use("/notifications", notificationsRoutes);
router.use("/reviews", reviewsRoutes);
router.use("/reports", reportsRoutes);
router.use("/maintenance", maintenanceRoutes);
router.use("/expenses", expensesRoutes);
router.use("/audit-logs", auditLogsRoutes);
router.use("/financial", financialRoutes);
router.use("/public", publicRoutes);
router.use("/uploads", uploadsRoutes);

router.get("/health", (_req, res) => {
  res.status(200).json({ success: true, message: "NovaStay HMS API is healthy", timestamp: new Date().toISOString() });
});

export default router;
