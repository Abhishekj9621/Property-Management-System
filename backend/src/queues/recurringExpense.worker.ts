import { Worker, Job } from "bullmq";
import type { Server as SocketIOServer } from "socket.io";
import { bullConnectionOptions } from "./connection";
import { RECURRING_EXPENSE_QUEUE_NAME } from "./recurringExpense.queue";
import { recurringExpenseService } from "../modules/expenses/recurring/recurring.service";
import { checkBudgetAfterSpend } from "../modules/expenses/budgets/budgets.service";
import { logger } from "../config/logger";

/**
 * Starts the worker that processes the daily recurring-expense sweep job.
 * `io` is optional, same convention as the no-show sweep worker: when run
 * in-process (the default — see server.ts) newly generated claims push an
 * `expense:created` event to the affected hotel's room immediately; run as
 * a standalone process instead (`npm run worker`) for horizontal scaling,
 * where `io` is omitted and clients pick up the new claim on next fetch.
 */
export function startRecurringExpenseWorker(io?: SocketIOServer) {
  const worker = new Worker(
    RECURRING_EXPENSE_QUEUE_NAME,
    async (_job: Job) => {
      const generated = await recurringExpenseService.runDueRecurringExpenses();
      if (generated.length) {
        logger.info(`Recurring expense sweep: generated ${generated.length} expense claim(s)`);
        for (const expense of generated) {
          if (io) io.to(`hotel:${expense.hotelId}`).emit("expense:created", expense);
          await checkBudgetAfterSpend(expense.hotelId, expense.categoryId, expense.expenseDate, Number(expense.amount)).catch(() => undefined);
        }
      }
      return { generatedCount: generated.length };
    },
    { connection: bullConnectionOptions }
  );

  worker.on("failed", (job, err) => {
    logger.error(`Recurring expense sweep job ${job?.id} failed`, err);
  });

  return worker;
}
