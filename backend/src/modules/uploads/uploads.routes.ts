import { Router } from "express";
import { authenticate } from "../../middlewares/auth.middleware";
import { authorize } from "../../middlewares/rbac.middleware";
import { uploadsController } from "./uploads.controller";

const router = Router();

// POST /uploads/hotels or /uploads/room-types — same role scope as editing
// the hotel/room type itself. Returns R2 URLs to save into Hotel.images[]
// or RoomType.images[] via the normal update endpoints.
router.post("/:folder", authenticate, authorize("SUPER_ADMIN", "HOTEL_ADMIN"), uploadsController.uploadImages);

export default router;
