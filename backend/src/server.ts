import http from "http";
import { createApp } from "./app";
import { env } from "./config/env";
import { logger } from "./config/logger";
import { connectDatabase, disconnectDatabase } from "./config/database";
import { redis } from "./config/redis";
import { initSocket } from "./sockets";
import { scheduleNoShowSweep, closeNoShowQueue } from "./queues/noShow.queue";
import { startNoShowWorker } from "./queues/noShow.worker";
import { scheduleRecurringExpenseSweep, closeRecurringExpenseQueue } from "./queues/recurringExpense.queue";
import { startRecurringExpenseWorker } from "./queues/recurringExpense.worker";

async function bootstrap() {
  await connectDatabase();

  const app = createApp();
  const httpServer = http.createServer(app);

  const io = initSocket(httpServer);
  app.set("io", io);

  // Reservation Management: hourly sweep that auto-marks CONFIRMED bookings
  // whose check-in date has passed without a check-in as NO_SHOW, freeing
  // their rooms. Runs in-process by default; see src/worker.ts to run it as
  // a separate process instead for horizontal scaling.
  await scheduleNoShowSweep();
  const noShowWorker = startNoShowWorker(io);

  // Expense Management: daily sweep that generates real Expense claims
  // from due RecurringExpense templates (rent, subscriptions, etc.). Runs
  // in-process by default; see src/worker.ts to run it as a separate
  // process instead for horizontal scaling.
  await scheduleRecurringExpenseSweep();
  const recurringExpenseWorker = startRecurringExpenseWorker(io);

  httpServer.listen(env.PORT, () => {
    logger.info(`🏨 NovaStay HMS API listening on port ${env.PORT} [${env.NODE_ENV}]`);
    logger.info(`📚 API docs available at http://localhost:${env.PORT}/api/docs`);
  });

  const shutdown = async (signal: string) => {
    logger.info(`${signal} received. Shutting down gracefully...`);
    httpServer.close(async () => {
      await noShowWorker.close();
      await closeNoShowQueue();
      await recurringExpenseWorker.close();
      await closeRecurringExpenseQueue();
      await disconnectDatabase();
      await redis.quit();
      process.exit(0);
    });
    // Force-exit if not closed within 10s
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("unhandledRejection", (reason) => {
    logger.error("Unhandled Rejection:", reason);
  });
}

bootstrap().catch((err) => {
  logger.error("Failed to bootstrap application", err);
  process.exit(1);
});
