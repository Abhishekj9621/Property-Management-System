import { Router } from "express";
import { hotelsController } from "./hotels.controller";
import { authenticate } from "../../middlewares/auth.middleware";
import { authorize } from "../../middlewares/rbac.middleware";
import { validate } from "../../middlewares/validate.middleware";
import { createHotelSchema, updateHotelSchema, listHotelsQuerySchema, upsertWebsiteListingSchema } from "./hotels.schema";

const router = Router();

// Listing/getting a single hotel is authenticated but open to any signed-in
// role — the service layer itself scopes non-SUPER_ADMIN staff down to only
// their own hotel, so a Manager can never see another property's details.
router.get("/", authenticate, validate(listHotelsQuerySchema), hotelsController.list);
router.get("/:id", authenticate, hotelsController.get);
router.post("/", authenticate, authorize("SUPER_ADMIN"), validate(createHotelSchema), hotelsController.create);
router.patch("/:id", authenticate, authorize("SUPER_ADMIN", "HOTEL_ADMIN"), validate(updateHotelSchema), hotelsController.update);
router.delete("/:id", authenticate, authorize("SUPER_ADMIN"), hotelsController.remove);
router.post("/:id/restore", authenticate, authorize("SUPER_ADMIN"), hotelsController.restore);
router.delete("/:id/permanent", authenticate, authorize("SUPER_ADMIN"), hotelsController.permanentlyDelete);

// Public website (curatdconcepts.com) listing management — same
// SUPER_ADMIN/HOTEL_ADMIN scope as editing the hotel itself.
router.get("/:id/website-listing", authenticate, authorize("SUPER_ADMIN", "HOTEL_ADMIN"), hotelsController.getWebsiteListing);
router.put(
  "/:id/website-listing",
  authenticate,
  authorize("SUPER_ADMIN", "HOTEL_ADMIN"),
  validate(upsertWebsiteListingSchema),
  hotelsController.upsertWebsiteListing
);

export default router;
