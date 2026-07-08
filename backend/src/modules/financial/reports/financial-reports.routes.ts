import { Router } from "express";
import { financialReportsController } from "./financial-reports.controller";
import { authenticate } from "../../../middlewares/auth.middleware";
import { authorize } from "../../../middlewares/rbac.middleware";
import { validate } from "../../../middlewares/validate.middleware";
import { dateRangeSchema, dailyCashSchema } from "./financial-reports.schema";
import { FINANCE_MANAGERS, FINANCE_CONSOLIDATED_VIEWERS } from "../shared/financial.roles";

const router = Router();

router.get("/profit-and-loss", authenticate, authorize(...FINANCE_MANAGERS), validate(dateRangeSchema), financialReportsController.profitAndLoss);
router.get("/profit-and-loss.csv", authenticate, authorize(...FINANCE_MANAGERS), validate(dateRangeSchema), financialReportsController.profitAndLossCsv);
router.get("/ar-aging", authenticate, authorize(...FINANCE_MANAGERS), financialReportsController.arAging);
router.get("/ar-aging.csv", authenticate, authorize(...FINANCE_MANAGERS), financialReportsController.arAgingCsv);
router.get("/daily-cash", authenticate, authorize(...FINANCE_MANAGERS), validate(dailyCashSchema), financialReportsController.dailyCash);
router.get("/consolidated", authenticate, authorize(...FINANCE_CONSOLIDATED_VIEWERS), validate(dateRangeSchema), financialReportsController.consolidated);

export default router;
