import express, { Application } from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import morgan from "morgan";
import hpp from "hpp";
import swaggerUi from "swagger-ui-express";
import "express-async-errors";

import { env } from "./config/env";
import { logger } from "./config/logger";
import { swaggerSpec } from "./config/swagger";
import routes from "./routes";
import { notFoundHandler, errorHandler } from "./middlewares/error.middleware";
import { globalRateLimiter } from "./middlewares/rateLimit.middleware";
import { paymentsController } from "./modules/payments/payments.controller";

export function createApp(): Application {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin(origin, callback) {
        // No Origin header (curl, server-to-server, same-origin) — allow.
        if (!origin) return callback(null, true);
        if (env.CORS_ORIGINS.includes(origin)) return callback(null, true);
        return callback(new Error(`Origin ${origin} is not allowed by CORS`));
      },
      credentials: true,
    })
  );
  app.use(compression());
  app.use(hpp());
  app.use(
    morgan("combined", {
      stream: { write: (message: string) => logger.info(message.trim()) },
    })
  );
  app.use(globalRateLimiter);

  // Stripe webhook needs the RAW body (must be registered before express.json())
  app.post("/webhooks/stripe", express.raw({ type: "application/json" }), paymentsController.webhook);

  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true }));

  app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
  app.use(env.API_PREFIX, routes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
