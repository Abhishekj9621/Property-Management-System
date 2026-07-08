import { Router } from "express";
import { notificationsController } from "./notifications.controller";
import { authenticate } from "../../middlewares/auth.middleware";

const router = Router();

router.get("/", authenticate, notificationsController.list);
router.patch("/read-all", authenticate, notificationsController.markAllRead);
router.patch("/:id/read", authenticate, notificationsController.markRead);
router.delete("/:id", authenticate, notificationsController.remove);

export default router;
