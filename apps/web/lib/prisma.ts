import { PrismaClient } from "@prisma/client";
import { Prisma } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

let ensured = false;

export async function ensureDatabase() {
  if (ensured) return;
  try {
    await prisma.shop.count();
    ensured = true;
    return;
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2021") {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "Shop" (
          "id" TEXT PRIMARY KEY,
          "shop" TEXT UNIQUE NOT NULL,
          "accessToken" TEXT NOT NULL,
          "plan" TEXT NOT NULL DEFAULT 'trial',
          "stripeId" TEXT,
          "quotaUsed" INTEGER NOT NULL DEFAULT 0,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `);
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "Log" (
          "id" TEXT PRIMARY KEY,
          "shop" TEXT NOT NULL,
          "productId" TEXT NOT NULL,
          "imageId" TEXT NOT NULL,
          "alt" TEXT NOT NULL,
          "ok" BOOLEAN NOT NULL,
          "msg" TEXT,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `);
      await prisma.$executeRawUnsafe(`
        CREATE UNIQUE INDEX IF NOT EXISTS "Shop_shop_key" ON "Shop" ("shop");
      `);
      ensured = true;
      return;
    }
    throw err;
  }
}
