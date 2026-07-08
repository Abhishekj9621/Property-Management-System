import { Router } from "express";
import { paymentsController } from "./payments.controller";
import { authenticate } from "../../middlewares/auth.middleware";
import { authorize } from "../../middlewares/rbac.middleware";
import { validate } from "../../middlewares/validate.middleware";
import { createPaymentSchema, createPaymentIntentSchema } from "./payments.schema";

const router = Router();
const STAFF = ["SUPER_ADMIN", "HOTEL_ADMIN", "MANAGER", "RECEPTIONIST"];

const REVENUE_VIEWERS = ["SUPER_ADMIN", "HOTEL_ADMIN", "MANAGER"];

router.get("/", authenticate, authorize(...REVENUE_VIEWERS), paymentsController.listForHotel);
router.post("/intent", authenticate, authorize(...STAFF), validate(createPaymentIntentSchema), paymentsController.createIntent);
router.post("/", authenticate, authorize(...STAFF), validate(createPaymentSchema), paymentsController.recordPayment);
router.get("/booking/:bookingId", authenticate, authorize(...STAFF), paymentsController.listForBooking);
// NOTE: the raw-body webhook route is mounted separately in app.ts (needs raw body, not JSON-parsed)

export default router;
