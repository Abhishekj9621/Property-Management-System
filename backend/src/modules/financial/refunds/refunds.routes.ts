import { Router } from "express";
import { refundsController } from "./refunds.controller";
import { authenticate } from "../../../middlewares/auth.middleware";
import { authorize } from "../../../middlewares/rbac.middleware";
import { validate } from "../../../middlewares/validate.middleware";
import { requestRefundSchema, decideRefundSchema, processRefundSchema, listRefundsSchema, idParamSchema } from "./refunds.schema";
import { FINANCE_STAFF, FINANCE_MANAGERS } from "../shared/financial.roles";

const router = Router();

router.get("/", authenticate, authorize(...FINANCE_STAFF), validate(listRefundsSchema), refundsController.list);
router.post("/", authenticate, authorize(...FINANCE_STAFF), validate(requestRefundSchema), refundsController.create);
router.get("/:id", authenticate, authorize(...FINANCE_STAFF), validate(idParamSchema), refundsController.get);
router.post("/:id/decision", authenticate, authorize(...FINANCE_MANAGERS), validate(decideRefundSchema), refundsController.decide);
router.post("/:id/process", authenticate, authorize(...FINANCE_MANAGERS), validate(processRefundSchema), refundsController.process);

export default router;
