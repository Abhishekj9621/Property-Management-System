import { Router } from "express";
import { authController } from "./auth.controller";
import { validate } from "../../middlewares/validate.middleware";
import { authenticate } from "../../middlewares/auth.middleware";
import { authRateLimiter } from "../../middlewares/rateLimit.middleware";
import {
  registerSchema,
  loginSchema,
  refreshSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  revokeAllSessionsSchema,
} from "./auth.schema";

const router = Router();

/**
 * @openapi
 * /auth/register:
 *   post:
 *     summary: Register a new guest account
 *     tags: [Auth]
 */
router.post("/register", authRateLimiter, validate(registerSchema), authController.register);

/**
 * @openapi
 * /auth/login:
 *   post:
 *     summary: Login with email/password
 *     tags: [Auth]
 */
router.post("/login", authRateLimiter, validate(loginSchema), authController.login);

/**
 * @openapi
 * /auth/refresh:
 *   post:
 *     summary: Rotate an access/refresh token pair
 *     tags: [Auth]
 */
router.post("/refresh", validate(refreshSchema), authController.refresh);

/**
 * @openapi
 * /auth/logout:
 *   post:
 *     summary: Revoke the current refresh token and blacklist the access token
 *     tags: [Auth]
 */
router.post("/logout", validate(refreshSchema), authController.logout);

router.post("/forgot-password", authRateLimiter, validate(forgotPasswordSchema), authController.forgotPassword);
router.post("/reset-password", authRateLimiter, validate(resetPasswordSchema), authController.resetPassword);

/**
 * @openapi
 * /auth/me:
 *   get:
 *     summary: Get the currently authenticated user's identity
 *     tags: [Auth]
 */
router.get("/me", authenticate, authController.me);

/**
 * @openapi
 * /auth/sessions:
 *   get:
 *     summary: List the current user's active sessions/devices
 *     tags: [Auth]
 */
router.get("/sessions", authenticate, authController.listSessions);

/**
 * @openapi
 * /auth/sessions/{id}:
 *   delete:
 *     summary: Revoke a specific session by id
 *     tags: [Auth]
 */
router.delete("/sessions/:id", authenticate, authController.revokeSession);

/**
 * @openapi
 * /auth/sessions:
 *   delete:
 *     summary: Revoke all sessions except (optionally) the current one
 *     tags: [Auth]
 */
router.delete("/sessions", authenticate, validate(revokeAllSessionsSchema), authController.revokeAllSessions);

export default router;
