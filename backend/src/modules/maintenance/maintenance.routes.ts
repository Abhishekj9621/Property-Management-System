import { Router } from "express";
import { maintenanceController } from "./maintenance.controller";
import { authenticate } from "../../middlewares/auth.middleware";
import { authorize } from "../../middlewares/rbac.middleware";
import { validate } from "../../middlewares/validate.middleware";
import {
  createMaintenanceRequestSchema,
  updateMaintenanceRequestSchema,
  createAssetSchema,
  updateAssetSchema,
} from "./maintenance.schema";

const router = Router();
const MANAGE = ["SUPER_ADMIN", "HOTEL_ADMIN", "MANAGER"];
// Any hotel-side staff (incl. Housekeeping) can raise a maintenance request —
// a housekeeper is often the first to spot a broken A/C or leaking pipe.
const REPORTERS = [...MANAGE, "RECEPTIONIST", "HOUSEKEEPING"];

// NOTE: the /assets/* subroutes MUST be registered before the generic
// "/:id" routes below, otherwise Express would match "GET /assets/list"
// against "GET /:id" (with id="assets") first.
router.post("/assets", authenticate, authorize(...MANAGE), validate(createAssetSchema), maintenanceController.createAsset);
router.get("/assets/list", authenticate, authorize(...REPORTERS), maintenanceController.listAssets);
router.get("/assets/:id", authenticate, authorize(...REPORTERS), maintenanceController.getAsset);
router.patch("/assets/:id", authenticate, authorize(...MANAGE), validate(updateAssetSchema), maintenanceController.updateAsset);
router.delete("/assets/:id", authenticate, authorize(...MANAGE), maintenanceController.removeAsset);

router.post("/", authenticate, authorize(...REPORTERS), validate(createMaintenanceRequestSchema), maintenanceController.create);
router.get("/", authenticate, authorize(...REPORTERS), maintenanceController.list);
router.get("/:id", authenticate, authorize(...REPORTERS), maintenanceController.get);
router.patch("/:id", authenticate, authorize(...REPORTERS), validate(updateMaintenanceRequestSchema), maintenanceController.update);
router.delete("/:id", authenticate, authorize(...MANAGE), maintenanceController.remove);

export default router;
