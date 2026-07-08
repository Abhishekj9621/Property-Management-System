import { Router } from "express";
import { hotelTypesController, roomCategoriesController } from "./catalog.controller";
import { authenticate } from "../../middlewares/auth.middleware";
import { authorize } from "../../middlewares/rbac.middleware";
import { validate } from "../../middlewares/validate.middleware";
import {
  createHotelTypeSchema,
  updateHotelTypeSchema,
  createRoomCategorySchema,
  updateRoomCategorySchema,
} from "./catalog.schema";

const router = Router();

// Read access: any authenticated user (dropdowns on hotel/room forms).
// Write access: SUPER_ADMIN only — these are platform-wide customization
// lists (hotel types, room categories) that every property draws
// from, so only the platform owner can add/retire options.

// ---------- Hotel Types ----------
router.get("/hotel-types", authenticate, hotelTypesController.list);
router.post("/hotel-types", authenticate, authorize("SUPER_ADMIN"), validate(createHotelTypeSchema), hotelTypesController.create);
router.patch("/hotel-types/:id", authenticate, authorize("SUPER_ADMIN"), validate(updateHotelTypeSchema), hotelTypesController.update);
router.delete("/hotel-types/:id", authenticate, authorize("SUPER_ADMIN"), hotelTypesController.remove);

// ---------- Room Categories ----------
router.get("/room-categories", authenticate, roomCategoriesController.list);
router.post(
  "/room-categories",
  authenticate,
  authorize("SUPER_ADMIN"),
  validate(createRoomCategorySchema),
  roomCategoriesController.create
);
router.patch(
  "/room-categories/:id",
  authenticate,
  authorize("SUPER_ADMIN"),
  validate(updateRoomCategorySchema),
  roomCategoriesController.update
);
router.delete("/room-categories/:id", authenticate, authorize("SUPER_ADMIN"), roomCategoriesController.remove);

export default router;
