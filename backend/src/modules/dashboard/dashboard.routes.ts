import { Router } from "express";
import { dashboardController } from "./dashboard.controller";
import { authenticate } from "../../middlewares/auth.middleware";
import { authorize } from "../../middlewares/rbac.middleware";

const router = Router();
const STAFF = ["SUPER_ADMIN", "HOTEL_ADMIN", "MANAGER", "RECEPTIONIST"];

router.get("/overview", authenticate, authorize(...STAFF), dashboardController.overview);
router.get("/upcoming", authenticate, authorize(...STAFF), dashboardController.upcoming);

export default router;
