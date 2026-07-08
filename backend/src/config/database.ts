import { PrismaClient } from "@prisma/client";
import { logger } from "./logger";

export const prisma = new PrismaClient({
  log: [
    { emit: "event", level: "query" },
    { emit: "event", level: "error" },
    { emit: "event", level: "warn" },
  ],
});

// @ts-ignore - prisma event typing quirk
prisma.$on("error", (e: any) => logger.error("Prisma error", e));
// @ts-ignore
prisma.$on("warn", (e: any) => logger.warn("Prisma warn", e));

export async function connectDatabase() {
  await prisma.$connect();
  logger.info("✅ PostgreSQL connected via Prisma");
}

export async function disconnectDatabase() {
  await prisma.$disconnect();
}
