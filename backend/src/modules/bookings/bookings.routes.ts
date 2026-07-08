import { Router } from "express";
import { bookingsController } from "./bookings.controller";
import { authenticate } from "../../middlewares/auth.middleware";
import { authorize } from "../../middlewares/rbac.middleware";
import { validate } from "../../middlewares/validate.middleware";
import { createBookingSchema, updateBookingStatusSchema, amendBookingSchema, listBookingsQuerySchema } from "./bookings.schema";

const router = Router();
const STAFF = ["SUPER_ADMIN", "HOTEL_ADMIN", "MANAGER", "RECEPTIONIST"];
const MANAGE = ["SUPER_ADMIN", "HOTEL_ADMIN", "MANAGER"];

router.post("/", authenticate, authorize(...STAFF), validate(createBookingSchema), bookingsController.create);
router.get("/", authenticate, authorize(...STAFF), validate(listBookingsQuerySchema), bookingsController.list);
router.get("/:id", authenticate, authorize(...STAFF), bookingsController.get);
router.patch("/:id/status", authenticate, authorize(...STAFF), validate(updateBookingStatusSchema), bookingsController.updateStatus);
router.patch("/:id/amend", authenticate, authorize(...STAFF), validate(amendBookingSchema), bookingsController.amend);
router.post("/:id/check-in", authenticate, authorize(...STAFF), bookingsController.checkIn);
router.post("/:id/check-out", authenticate, authorize(...STAFF), bookingsController.checkOut);
router.delete("/:id", authenticate, authorize(...MANAGE), bookingsController.remove);

export default router;
