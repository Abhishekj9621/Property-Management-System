import { logger } from "./config/logger";
import { connectDatabase, disconnectDatabase } from "./config/database";
import { redis } from "./config/redis";
import { scheduleNoShowSweep, closeNoShowQueue } from "./queues/noShow.queue";
import { startNoShowWorker } from "./queues/noShow.worker";
import { scheduleRecurringExpenseSweep, closeRecurringExpenseQueue } from "./queues/recurringExpense.queue";
import { startRecurringExpenseWorker } from "./queues/recurringExpense.worker";

/**
 * Standalone worker process — run this separately from the API
 * (`npm run worker`) to scale background job processing independently of
 * request handling. Not required for local dev / a single-instance
 * deployment: `npm run dev` / `npm start` already start this worker
 * in-process (see server.ts) so reservation no-show sweeping works out of
 * the box either way.
 */
async function bootstrap() {
  await connectDatabase();
  await scheduleNoShowSweep();
  const worker = startNoShowWorker();
  logger.info("👷 Reservation worker process started (no-show sweep)");

  await scheduleRecurringExpenseSweep();
  const recurringExpenseWorker = startRecurringExpenseWorker();
  logger.info("👷 Expense worker process started (recurring expense sweep)");

  const shutdown = async (signal: string) => {
    logger.info(`${signal} received. Shutting down worker...`);
    await worker.close();
    await closeNoShowQueue();
    await recurringExpenseWorker.close();
    await closeRecurringExpenseQueue();
    await disconnectDatabase();
    await redis.quit();
    process.exit(0);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

bootstrap().catch((err) => {
  logger.error("Failed to bootstrap worker process", err);
  process.exit(1);
});
