import { Router } from "express";
import { recurringExpenseController } from "./recurring.controller";
import { authenticate } from "../../../middlewares/auth.middleware";
import { authorize } from "../../../middlewares/rbac.middleware";
import { validate } from "../../../middlewares/validate.middleware";
import { createRecurringExpenseSchema, updateRecurringExpenseSchema, idParamSchema } from "./recurring.schema";
import { EXPENSE_MANAGERS } from "../shared/expense.roles";

const router = Router();

router.get("/", authenticate, authorize(...EXPENSE_MANAGERS), recurringExpenseController.list);
router.post("/", authenticate, authorize(...EXPENSE_MANAGERS), validate(createRecurringExpenseSchema), recurringExpenseController.create);
router.get("/:id", authenticate, authorize(...EXPENSE_MANAGERS), validate(idParamSchema), recurringExpenseController.get);
router.patch("/:id", authenticate, authorize(...EXPENSE_MANAGERS), validate(updateRecurringExpenseSchema), recurringExpenseController.update);
router.post("/:id/pause", authenticate, authorize(...EXPENSE_MANAGERS), validate(idParamSchema), recurringExpenseController.pause);
router.post("/:id/resume", authenticate, authorize(...EXPENSE_MANAGERS), validate(idParamSchema), recurringExpenseController.resume);
router.delete("/:id", authenticate, authorize(...EXPENSE_MANAGERS), validate(idParamSchema), recurringExpenseController.remove);

export default router;
