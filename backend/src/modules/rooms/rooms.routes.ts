import { Router } from "express";
import { roomsController } from "./rooms.controller";
import { authenticate } from "../../middlewares/auth.middleware";
import { authorize } from "../../middlewares/rbac.middleware";
import { validate } from "../../middlewares/validate.middleware";
import {
  createRoomTypeSchema,
  createRoomSchema,
  updateRoomTypeSchema,
  updateRoomSchema,
  updateRoomStatusSchema,
  bulkCreateRoomsSchema,
  availabilityQuerySchema,
} from "./rooms.schema";

const router = Router();
const STAFF = ["SUPER_ADMIN", "HOTEL_ADMIN", "MANAGER", "RECEPTIONIST"];
const MANAGE = ["SUPER_ADMIN", "HOTEL_ADMIN", "MANAGER"];

router.get("/availability", authenticate, validate(availabilityQuerySchema), roomsController.searchAvailability);

router.get("/types", authenticate, roomsController.listRoomTypes);
router.post("/types", authenticate, authorize(...MANAGE), validate(createRoomTypeSchema), roomsController.createRoomType);
router.patch("/types/:id", authenticate, authorize(...MANAGE), validate(updateRoomTypeSchema), roomsController.updateRoomType);
router.delete("/types/:id", authenticate, authorize(...MANAGE), roomsController.deleteRoomType);

router.get("/floors", authenticate, authorize(...STAFF, "HOUSEKEEPING"), roomsController.listFloors);

router.get("/", authenticate, authorize(...STAFF, "HOUSEKEEPING"), roomsController.listRooms);
router.post("/", authenticate, authorize(...MANAGE), validate(createRoomSchema), roomsController.createRoom);
router.post("/bulk", authenticate, authorize(...MANAGE), validate(bulkCreateRoomsSchema), roomsController.bulkCreateRooms);
router.get("/:id", authenticate, authorize(...STAFF, "HOUSEKEEPING"), roomsController.getRoom);
router.patch("/:id", authenticate, authorize(...MANAGE), validate(updateRoomSchema), roomsController.updateRoom);
router.delete("/:id", authenticate, authorize(...MANAGE), roomsController.deleteRoom);
router.patch(
  "/:id/status",
  authenticate,
  authorize(...STAFF, "HOUSEKEEPING"),
  validate(updateRoomStatusSchema),
  roomsController.updateRoomStatus
);

export default router;
