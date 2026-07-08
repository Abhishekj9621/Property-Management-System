import { Router } from "express";
import { housekeepingController } from "./housekeeping.controller";
import { authenticate } from "../../middlewares/auth.middleware";
import { authorize } from "../../middlewares/rbac.middleware";
import { validate } from "../../middlewares/validate.middleware";
import { createTaskSchema, updateTaskSchema } from "./housekeeping.schema";

const router = Router();
const MANAGE = ["SUPER_ADMIN", "HOTEL_ADMIN", "MANAGER"];
const STAFF = [...MANAGE, "RECEPTIONIST", "HOUSEKEEPING"];

router.post("/", authenticate, authorize(...MANAGE), validate(createTaskSchema), housekeepingController.create);
router.get("/", authenticate, authorize(...STAFF), housekeepingController.list);
router.patch("/:id", authenticate, authorize(...STAFF), validate(updateTaskSchema), housekeepingController.update);
router.delete("/:id", authenticate, authorize(...MANAGE), housekeepingController.remove);

export default router;
