import { Queue } from "bullmq";
import { bullConnectionOptions } from "./connection";
import { logger } from "../config/logger";

export const RECURRING_EXPENSE_QUEUE_NAME = "expenses-recurring-sweep";
export const RECURRING_EXPENSE_JOB_NAME = "sweep";

export const recurringExpenseQueue = new Queue(RECURRING_EXPENSE_QUEUE_NAME, { connection: bullConnectionOptions });

/**
 * Registers (or re-registers, idempotently) a repeatable job that scans for
 * due RecurringExpense templates once a day and generates real Expense
 * claims from them. Called once at server bootstrap; BullMQ dedupes
 * repeatable jobs by their repeat config, so calling this on every
 * deploy/restart is safe and won't create duplicates.
 */
export async function scheduleRecurringExpenseSweep() {
  await recurringExpenseQueue.add(
    RECURRING_EXPENSE_JOB_NAME,
    {},
    {
      repeat: { every: 24 * 60 * 60 * 1000 }, // once a day
      jobId: "recurring-expense-sweep-daily",
      removeOnComplete: { count: 50 },
      removeOnFail: { count: 50 },
    }
  );
  logger.info("🔁 Recurring expense sweep scheduled (daily)");
}

export async function closeRecurringExpenseQueue() {
  await recurringExpenseQueue.close();
}
