import { Queue } from "bullmq";
import { bullConnectionOptions } from "./connection";
import { logger } from "../config/logger";

export const NO_SHOW_QUEUE_NAME = "reservations-no-show-sweep";
export const NO_SHOW_JOB_NAME = "sweep";

export const noShowQueue = new Queue(NO_SHOW_QUEUE_NAME, { connection: bullConnectionOptions });

/**
 * Registers (or re-registers, idempotently) a repeatable job that sweeps
 * for overdue CONFIRMED bookings every hour. Called once at server
 * bootstrap. BullMQ dedupes repeatable jobs by their repeat config, so
 * calling this on every deploy/restart is safe and won't create duplicates.
 */
export async function scheduleNoShowSweep() {
  await noShowQueue.add(
    NO_SHOW_JOB_NAME,
    {},
    {
      repeat: { every: 60 * 60 * 1000 }, // every hour
      jobId: "no-show-sweep-hourly",
      removeOnComplete: { count: 50 },
      removeOnFail: { count: 50 },
    }
  );
  logger.info("🕒 No-show sweep scheduled (hourly)");
}

export async function closeNoShowQueue() {
  await noShowQueue.close();
}
