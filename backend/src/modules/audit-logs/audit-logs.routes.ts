import { Router } from "express";
import { auditLogsController } from "./audit-logs.controller";
import { authenticate } from "../../middlewares/auth.middleware";
import { authorize } from "../../middlewares/rbac.middleware";

const router = Router();

/**
 * @openapi
 * /audit-logs:
 *   get:
 *     summary: List Auth & RBAC audit trail events (scoped to the caller's hotel unless SUPER_ADMIN)
 *     tags: [Audit Logs]
 */
router.get("/", authenticate, authorize("SUPER_ADMIN", "HOTEL_ADMIN", "MANAGER"), auditLogsController.list);

export default router;
