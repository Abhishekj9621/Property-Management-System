import { Router } from "express";
import { taxRatesController } from "./tax-rates.controller";
import { authenticate } from "../../../middlewares/auth.middleware";
import { authorize } from "../../../middlewares/rbac.middleware";
import { validate } from "../../../middlewares/validate.middleware";
import { createTaxRateSchema, updateTaxRateSchema, idParamSchema } from "./tax-rates.schema";
import { FINANCE_STAFF, FINANCE_MANAGERS } from "../shared/financial.roles";

const router = Router();

router.get("/", authenticate, authorize(...FINANCE_STAFF), taxRatesController.list);
router.post("/", authenticate, authorize(...FINANCE_MANAGERS), validate(createTaxRateSchema), taxRatesController.create);
router.patch("/:id", authenticate, authorize(...FINANCE_MANAGERS), validate(updateTaxRateSchema), taxRatesController.update);
router.delete("/:id", authenticate, authorize(...FINANCE_MANAGERS), validate(idParamSchema), taxRatesController.remove);

export default router;
