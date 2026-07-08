import { Router } from "express";
import { reviewsController } from "./reviews.controller";
import { authenticate } from "../../middlewares/auth.middleware";
import { authorize } from "../../middlewares/rbac.middleware";

const router = Router();
const STAFF = ["SUPER_ADMIN", "HOTEL_ADMIN", "MANAGER", "RECEPTIONIST"];
const MANAGE = ["SUPER_ADMIN", "HOTEL_ADMIN", "MANAGER"];

router.post("/", authenticate, authorize(...STAFF), reviewsController.create);
router.get("/", authenticate, authorize(...STAFF), reviewsController.list);
router.patch("/:id/respond", authenticate, authorize(...MANAGE), reviewsController.respond);

export default router;
