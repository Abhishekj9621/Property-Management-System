import { Router } from "express";
import { usersController } from "./users.controller";
import { authenticate } from "../../middlewares/auth.middleware";
import { authorize } from "../../middlewares/rbac.middleware";
import { validate } from "../../middlewares/validate.middleware";
import { createStaffSchema, updateStaffSchema, resetStaffPasswordSchema, listStaffQuerySchema } from "./users.schema";

const router = Router();

// Any staff-management action requires being logged in as staff that's
// somewhere in the hierarchy (SUPER_ADMIN / HOTEL_ADMIN / MANAGER); the
// fine-grained "who can touch whom" rules are enforced inside the service
// via ROLE_HIERARCHY + hotel scoping, not just this route-level check.
const CAN_MANAGE_STAFF = ["SUPER_ADMIN", "HOTEL_ADMIN", "MANAGER"];

router.get("/", authenticate, authorize(...CAN_MANAGE_STAFF), validate(listStaffQuerySchema), usersController.list);
router.post("/", authenticate, authorize(...CAN_MANAGE_STAFF), validate(createStaffSchema), usersController.create);
router.get("/:id", authenticate, authorize(...CAN_MANAGE_STAFF), usersController.get);
router.patch("/:id", authenticate, authorize(...CAN_MANAGE_STAFF), validate(updateStaffSchema), usersController.update);
router.post(
  "/:id/reset-password",
  authenticate,
  authorize(...CAN_MANAGE_STAFF),
  validate(resetStaffPasswordSchema),
  usersController.resetPassword
);
router.delete("/:id", authenticate, authorize(...CAN_MANAGE_STAFF), usersController.deactivate);
router.post("/:id/restore", authenticate, authorize(...CAN_MANAGE_STAFF), usersController.restore);

export default router;
