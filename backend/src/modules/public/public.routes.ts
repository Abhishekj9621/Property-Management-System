import { Router } from "express";
import { publicController } from "./public.controller";
import { validate } from "../../middlewares/validate.middleware";
import { contactFormSchema } from "./public.schema";
import { publicFormRateLimiter } from "../../middlewares/rateLimit.middleware";

const router = Router();

// Genuinely public — no auth, no shared secret. Called directly from the
// curatdconcepts.com browser bundle. CORS (see app.ts) is what actually
// restricts which sites can call this from a browser; a secret key isn't
// meaningful here since anything shipped to the browser is visible to it.
router.get("/listings", publicController.listListings);

router.post("/contact", publicFormRateLimiter, validate(contactFormSchema), publicController.submitContact);

export default router;
