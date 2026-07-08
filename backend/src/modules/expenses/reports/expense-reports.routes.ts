import { Router } from "express";
import { expenseReportsController } from "./expense-reports.controller";
import { authenticate } from "../../../middlewares/auth.middleware";
import { authorize } from "../../../middlewares/rbac.middleware";
import { validate } from "../../../middlewares/validate.middleware";
import { dateRangeSchema } from "./expense-reports.schema";
import { EXPENSE_MANAGERS } from "../shared/expense.roles";

const router = Router();

router.get("/summary", authenticate, authorize(...EXPENSE_MANAGERS), validate(dateRangeSchema), expenseReportsController.summary);
router.get("/by-category", authenticate, authorize(...EXPENSE_MANAGERS), validate(dateRangeSchema), expenseReportsController.byCategory);
router.get("/by-category.csv", authenticate, authorize(...EXPENSE_MANAGERS), validate(dateRangeSchema), expenseReportsController.byCategoryCsv);
router.get("/by-vendor", authenticate, authorize(...EXPENSE_MANAGERS), validate(dateRangeSchema), expenseReportsController.byVendor);
router.get("/by-vendor.csv", authenticate, authorize(...EXPENSE_MANAGERS), validate(dateRangeSchema), expenseReportsController.byVendorCsv);
router.get("/monthly-trend", authenticate, authorize(...EXPENSE_MANAGERS), expenseReportsController.monthlyTrend);

export default router;
