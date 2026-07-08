import { Router } from "express";
import { expensesController } from "./expenses.controller";
import { authenticate } from "../../middlewares/auth.middleware";
import { authorize } from "../../middlewares/rbac.middleware";
import { validate } from "../../middlewares/validate.middleware";
import {
  createExpenseSchema,
  updateExpenseSchema,
  addAttachmentSchema,
  decideExpenseSchema,
  createExpenseCategorySchema,
  updateExpenseCategorySchema,
  idParamSchema,
} from "./expenses.schema";
import { EXPENSE_STAFF, EXPENSE_MANAGERS } from "./shared/expense.roles";
import vendorsRoutes from "./vendors/vendors.routes";
import budgetsRoutes from "./budgets/budgets.routes";
import recurringRoutes from "./recurring/recurring.routes";
import expenseReportsRoutes from "./reports/expense-reports.routes";

const router = Router();

// Sub-modules
router.use("/vendors", vendorsRoutes);
router.use("/budgets", budgetsRoutes);
router.use("/recurring", recurringRoutes);
router.use("/reports", expenseReportsRoutes);

// Categories
router.get("/categories", authenticate, authorize(...EXPENSE_STAFF), expensesController.listCategories);
router.post("/categories", authenticate, authorize(...EXPENSE_MANAGERS), validate(createExpenseCategorySchema), expensesController.createCategory);
router.patch("/categories/:id", authenticate, authorize(...EXPENSE_MANAGERS), validate(updateExpenseCategorySchema), expensesController.updateCategory);

// Any staff member can submit/track their own expense claims; only
// managers can approve, reject, or see the full hotel-wide ledger
// (enforced in the service/controller, not just here). High-value
// approvals additionally require EXPENSE_HIGH_VALUE_APPROVERS — enforced
// inside expensesService.decideExpense, since it depends on both the
// hotel's configured threshold and the specific expense's amount.
router.post("/", authenticate, authorize(...EXPENSE_STAFF), validate(createExpenseSchema), expensesController.create);
router.get("/", authenticate, authorize(...EXPENSE_STAFF), expensesController.list);
router.get("/:id", authenticate, authorize(...EXPENSE_STAFF), validate(idParamSchema), expensesController.get);
router.patch("/:id", authenticate, authorize(...EXPENSE_STAFF), validate(updateExpenseSchema), expensesController.update);
router.post("/:id/attachments", authenticate, authorize(...EXPENSE_STAFF), validate(addAttachmentSchema), expensesController.addAttachment);
router.delete("/:id/attachments/:attachmentId", authenticate, authorize(...EXPENSE_STAFF), expensesController.removeAttachment);
router.post("/:id/decision", authenticate, authorize(...EXPENSE_MANAGERS), validate(decideExpenseSchema), expensesController.decide);
router.delete("/:id", authenticate, authorize(...EXPENSE_STAFF), validate(idParamSchema), expensesController.remove);

export default router;
