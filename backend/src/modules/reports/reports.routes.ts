import { Router } from "express";
import { reportsController } from "./reports.controller";
import { authenticate } from "../../middlewares/auth.middleware";
import { authorize } from "../../middlewares/rbac.middleware";

const router = Router();
const MANAGE = ["SUPER_ADMIN", "HOTEL_ADMIN", "MANAGER"];

router.get("/bookings.csv", authenticate, authorize(...MANAGE), reportsController.bookingsCsv);
router.get("/revenue.csv", authenticate, authorize(...MANAGE), reportsController.revenueCsv);
router.get("/occupancy.csv", authenticate, authorize(...MANAGE), reportsController.occupancyCsv);

export default router;
