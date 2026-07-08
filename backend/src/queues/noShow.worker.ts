import { Worker, Job } from "bullmq";
import type { Server as SocketIOServer } from "socket.io";
import { bullConnectionOptions } from "./connection";
import { NO_SHOW_QUEUE_NAME } from "./noShow.queue";
import { bookingsService } from "../modules/bookings/bookings.service";
import { logger } from "../config/logger";

/**
 * Starts the worker that processes the hourly no-show sweep job.
 * `io` is optional: when the worker runs inside the main API process (the
 * default for this deployment size — see server.ts) it's passed in so
 * flipped bookings push a `booking:updated` event to the affected hotel's
 * room immediately. Run as a standalone process instead (`npm run worker`)
 * for horizontal scaling; in that mode `io` is omitted and clients simply
 * pick up the status change on their next fetch/poll.
 */
export function startNoShowWorker(io?: SocketIOServer) {
  const worker = new Worker(
    NO_SHOW_QUEUE_NAME,
    async (_job: Job) => {
      const flipped = await bookingsService.sweepNoShows();
      if (flipped.length) {
        logger.info(`No-show sweep: marked ${flipped.length} booking(s) as NO_SHOW`);
        if (io) {
          for (const booking of flipped) {
            io.to(`hotel:${booking.hotelId}`).emit("booking:updated", booking);
          }
        }
      }
      return { flippedCount: flipped.length };
    },
    { connection: bullConnectionOptions }
  );

  worker.on("failed", (job, err) => {
    logger.error(`No-show sweep job ${job?.id} failed`, err);
  });

  return worker;
}
