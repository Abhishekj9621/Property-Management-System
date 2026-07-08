import { Router } from "express";
import { guestsController } from "./guests.controller";
import { authenticate } from "../../middlewares/auth.middleware";
import { authorize } from "../../middlewares/rbac.middleware";
import { validate } from "../../middlewares/validate.middleware";
import { createGuestSchema, updateGuestSchema } from "./guests.schema";

const router = Router();
const STAFF = ["SUPER_ADMIN", "HOTEL_ADMIN", "MANAGER", "RECEPTIONIST"];
const MANAGE = ["SUPER_ADMIN", "HOTEL_ADMIN", "MANAGER"];

router.post("/", authenticate, authorize(...STAFF), validate(createGuestSchema), guestsController.create);
router.get("/", authenticate, authorize(...STAFF), guestsController.list);
router.get("/:id", authenticate, authorize(...STAFF), guestsController.get);
router.patch("/:id", authenticate, authorize(...STAFF), validate(updateGuestSchema), guestsController.update);
router.delete("/:id", authenticate, authorize(...MANAGE), guestsController.remove);

export default router;
