import { Router } from "express";
import { ledgerController } from "./ledger.controller";
import { authenticate } from "../../../middlewares/auth.middleware";
import { authorize } from "../../../middlewares/rbac.middleware";
import { validate } from "../../../middlewares/validate.middleware";
import { createManualEntrySchema, listLedgerSchema } from "./ledger.schema";
import { FINANCE_MANAGERS } from "../shared/financial.roles";

const router = Router();

// The ledger is a read-mostly audit trail — only managers+ can view it or
// post a manual adjustment; day-to-day staff never touch it directly.
router.get("/", authenticate, authorize(...FINANCE_MANAGERS), validate(listLedgerSchema), ledgerController.list);
router.post("/manual-entries", authenticate, authorize(...FINANCE_MANAGERS), validate(createManualEntrySchema), ledgerController.createManualEntry);

export default router;
