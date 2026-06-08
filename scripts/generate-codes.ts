/**
 * Generate 10 discount codes and insert them into the DB.
 * Run with:
 *   DATABASE_URL="..." npx tsx scripts/generate-codes.ts
 */

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../app/generated/prisma/client/index.js";
import crypto from "crypto";

function createClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL not set");
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

// Cryptographically-secure, unambiguous code chars (no 0/O/1/I).
function randomChars(n: number): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.randomBytes(n);
  let result = "";
  for (let i = 0; i < n; i++) {
    result += chars[bytes[i] % chars.length];
  }
  return result;
}

async function main() {
  const db = createClient();

  // The CODE itself can expire (can't be redeemed after this date)...
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 90);
  // ...and the GRANT it confers is time-boxed (plan reverts to FREE after grantDays).
  const grantDays = Number(process.env.CODE_GRANT_DAYS ?? "365");
  const proCount = Number(process.env.CODE_PRO_COUNT ?? "5");
  const teamCount = Number(process.env.CODE_TEAM_COUNT ?? "5");

  const codes: Array<{ code: string; plan: string }> = [];
  for (let i = 0; i < proCount; i++) codes.push({ code: `HUMAN-PRO-${randomChars(6)}`, plan: "PRO" });
  for (let i = 0; i < teamCount; i++) codes.push({ code: `HUMAN-TEAM-${randomChars(6)}`, plan: "TEAM" });

  const created: string[] = [];
  for (const { code, plan } of codes) {
    try {
      await db.discountCode.create({
        data: { code, plan, maxUses: 1, usedCount: 0, grantDays, expiresAt },
      });
      created.push(`${code} [${plan}]`);
      console.log(`✓ Created: ${code} [${plan}] — grant ${grantDays}d, code expires ${expiresAt.toISOString().split("T")[0]}`);
    } catch (err) {
      console.error(`✗ Failed to create ${code}:`, err);
    }
  }

  // SECURITY: codes are secrets — printed to stdout only, never written to a
  // file in the repo. Copy them from the terminal and store them privately.
  console.log(`\n✅ ${created.length} codes generated (grant ${grantDays} days each). Save them now — they are not persisted to disk.`);

  await db.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
