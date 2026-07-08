import { Router } from "express";
import { budgetsController } from "./budgets.controller";
import { authenticate } from "../../../middlewares/auth.middleware";
import { authorize } from "../../../middlewares/rbac.middleware";
import { validate } from "../../../middlewares/validate.middleware";
import { createBudgetSchema, updateBudgetSchema, idParamSchema, listBudgetsSchema } from "./budgets.schema";
import { EXPENSE_MANAGERS } from "../shared/expense.roles";

const router = Router();

router.get("/", authenticate, authorize(...EXPENSE_MANAGERS), validate(listBudgetsSchema), budgetsController.list);
router.post("/", authenticate, authorize(...EXPENSE_MANAGERS), validate(createBudgetSchema), budgetsController.create);
router.patch("/:id", authenticate, authorize(...EXPENSE_MANAGERS), validate(updateBudgetSchema), budgetsController.update);
router.delete("/:id", authenticate, authorize(...EXPENSE_MANAGERS), validate(idParamSchema), budgetsController.remove);

export default router;
