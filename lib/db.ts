import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/app/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * pg 8 already treats sslmode=require (what Neon's URLs carry) as
 * verify-full, but warns about it on every cold start because pg 9 will
 * change it, and Vercel files that warning as an error log. Asking for
 * verify-full by name keeps today's behavior without the noise.
 */
export function withExplicitSslMode(connectionString: string): string {
  return connectionString.replace(/([?&]sslmode=)require(?=&|$)/i, "$1verify-full");
}

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL environment variable is not set");
  }

  const adapter = new PrismaPg({ connectionString: withExplicitSslMode(connectionString) });
  return new PrismaClient({ adapter });
}

export const db = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
