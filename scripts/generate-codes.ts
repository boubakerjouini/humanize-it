/**
 * Generate 10 discount codes and insert them into the DB.
 * Run with:
 *   DATABASE_URL="..." npx tsx scripts/generate-codes.ts
 */

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../app/generated/prisma/client/index.js";
import * as fs from "fs";
import * as path from "path";

function createClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL not set");
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

function randomChars(n: number): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let result = "";
  for (let i = 0; i < n; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

async function main() {
  const db = createClient();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 90);

  const codes: Array<{ code: string; plan: string }> = [];

  // 5 PRO codes
  for (let i = 0; i < 5; i++) {
    codes.push({ code: `HUMAN-PRO-${randomChars(5)}`, plan: "PRO" });
  }

  // 5 TEAM codes
  for (let i = 0; i < 5; i++) {
    codes.push({ code: `HUMAN-TEAM-${randomChars(5)}`, plan: "TEAM" });
  }

  const created: string[] = [];

  for (const { code, plan } of codes) {
    try {
      await db.discountCode.create({
        data: {
          code,
          plan,
          maxUses: 1,
          usedCount: 0,
          expiresAt,
        },
      });
      created.push(`${code} [${plan}] — expires ${expiresAt.toISOString().split("T")[0]}`);
      console.log(`✓ Created: ${code} [${plan}]`);
    } catch (err) {
      console.error(`✗ Failed to create ${code}:`, err);
    }
  }

  const outputPath = path.join(__dirname, "generated-codes.txt");
  const content = [
    `Generated on ${new Date().toISOString()}`,
    `Expires: ${expiresAt.toISOString().split("T")[0]}`,
    "",
    "=== PRO CODES ===",
    ...created.filter(c => c.includes("[PRO]")),
    "",
    "=== TEAM CODES ===",
    ...created.filter(c => c.includes("[TEAM]")),
    "",
    `Total: ${created.length} codes generated`,
  ].join("\n");

  fs.writeFileSync(outputPath, content, "utf-8");
  console.log(`\n✅ ${created.length} codes generated and saved to scripts/generated-codes.txt`);

  await db.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
