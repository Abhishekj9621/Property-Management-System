import { Router } from "express";
import { periodCloseController } from "./period-close.controller";
import { authenticate } from "../../../middlewares/auth.middleware";
import { authorize } from "../../../middlewares/rbac.middleware";
import { validate } from "../../../middlewares/validate.middleware";
import { previewCloseSchema, closeDaySchema, reopenDaySchema, listClosesSchema } from "./period-close.schema";
import { FINANCE_MANAGERS, FINANCE_PERIOD_REOPENERS } from "../shared/financial.roles";

const router = Router();

router.get("/", authenticate, authorize(...FINANCE_MANAGERS), validate(listClosesSchema), periodCloseController.list);
router.get("/preview", authenticate, authorize(...FINANCE_MANAGERS), validate(previewCloseSchema), periodCloseController.preview);
router.post("/close", authenticate, authorize(...FINANCE_MANAGERS), validate(closeDaySchema), periodCloseController.close);
// Reopening an already-closed day is a bigger deal than closing it — only
// property/platform admins may do it, matching FINANCE_PERIOD_REOPENERS.
router.post("/:id/reopen", authenticate, authorize(...FINANCE_PERIOD_REOPENERS), validate(reopenDaySchema), periodCloseController.reopen);

export default router;
