import { Router } from "express";
import { vendorsController } from "./vendors.controller";
import { authenticate } from "../../../middlewares/auth.middleware";
import { authorize } from "../../../middlewares/rbac.middleware";
import { validate } from "../../../middlewares/validate.middleware";
import { createVendorSchema, updateVendorSchema, idParamSchema } from "./vendors.schema";
import { EXPENSE_STAFF, EXPENSE_MANAGERS } from "../shared/expense.roles";

const router = Router();

router.get("/", authenticate, authorize(...EXPENSE_STAFF), vendorsController.list);
router.post("/", authenticate, authorize(...EXPENSE_MANAGERS), validate(createVendorSchema), vendorsController.create);
router.get("/:id", authenticate, authorize(...EXPENSE_STAFF), validate(idParamSchema), vendorsController.get);
router.get("/:id/spend-summary", authenticate, authorize(...EXPENSE_MANAGERS), validate(idParamSchema), vendorsController.spendSummary);
router.patch("/:id", authenticate, authorize(...EXPENSE_MANAGERS), validate(updateVendorSchema), vendorsController.update);
router.delete("/:id", authenticate, authorize(...EXPENSE_MANAGERS), validate(idParamSchema), vendorsController.deactivate);

export default router;
