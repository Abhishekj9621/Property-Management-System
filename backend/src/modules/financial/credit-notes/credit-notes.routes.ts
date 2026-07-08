import { Router } from "express";
import { creditNotesController } from "./credit-notes.controller";
import { authenticate } from "../../../middlewares/auth.middleware";
import { authorize } from "../../../middlewares/rbac.middleware";
import { validate } from "../../../middlewares/validate.middleware";
import { createCreditNoteSchema, listCreditNotesSchema, idParamSchema } from "./credit-notes.schema";
import { FINANCE_STAFF, FINANCE_MANAGERS } from "../shared/financial.roles";

const router = Router();

router.get("/", authenticate, authorize(...FINANCE_STAFF), validate(listCreditNotesSchema), creditNotesController.list);
router.post("/", authenticate, authorize(...FINANCE_MANAGERS), validate(createCreditNoteSchema), creditNotesController.create);
router.get("/:id", authenticate, authorize(...FINANCE_STAFF), validate(idParamSchema), creditNotesController.get);
router.post("/:id/void", authenticate, authorize(...FINANCE_MANAGERS), validate(idParamSchema), creditNotesController.void);

export default router;
