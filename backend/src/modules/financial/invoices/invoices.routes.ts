import { Router } from "express";
import { invoicesController } from "./invoices.controller";
import { authenticate } from "../../../middlewares/auth.middleware";
import { authorize } from "../../../middlewares/rbac.middleware";
import { validate } from "../../../middlewares/validate.middleware";
import { createInvoiceSchema, updateInvoiceDraftSchema, voidInvoiceSchema, listInvoicesSchema, idParamSchema } from "./invoices.schema";
import { FINANCE_STAFF, FINANCE_MANAGERS } from "../shared/financial.roles";

const router = Router();

router.get("/", authenticate, authorize(...FINANCE_STAFF), validate(listInvoicesSchema), invoicesController.list);
router.post("/", authenticate, authorize(...FINANCE_STAFF), validate(createInvoiceSchema), invoicesController.create);
router.get("/:id", authenticate, authorize(...FINANCE_STAFF), validate(idParamSchema), invoicesController.get);
router.patch("/:id", authenticate, authorize(...FINANCE_STAFF), validate(updateInvoiceDraftSchema), invoicesController.updateDraft);
router.post("/:id/issue", authenticate, authorize(...FINANCE_STAFF), validate(idParamSchema), invoicesController.issue);
router.post("/:id/void", authenticate, authorize(...FINANCE_MANAGERS), validate(voidInvoiceSchema), invoicesController.void);
router.post("/:id/mark-paid", authenticate, authorize(...FINANCE_STAFF), validate(idParamSchema), invoicesController.markAdhocPaid);

export default router;
