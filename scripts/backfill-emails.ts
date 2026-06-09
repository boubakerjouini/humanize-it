/**
 * Backfill real Clerk emails onto User rows that still hold a placeholder
 * (`<clerkId>@placeholder.humanize-it.app`).
 *
 * For each placeholder row it asks the Clerk Backend API for that user's
 * primary email and writes it back. Rows whose Clerk account no longer exists,
 * or whose real email already belongs to another row, are reported and skipped
 * (the unique constraint on User.email is respected — never throws the run).
 *
 * Reads DATABASE_URL + CLERK_SECRET_KEY from .env.local.
 *
 * Dry run (default — shows what would change, writes nothing):
 *   npx tsx scripts/backfill-emails.ts
 * Apply:
 *   npx tsx scripts/backfill-emails.ts --apply
 */

import dotenv from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../app/generated/prisma/client/index.js";

dotenv.config({ path: ".env.local" });

const PLACEHOLDER_DOMAIN = "@placeholder.humanize-it.app";

function createClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL not set (.env.local)");
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

type ClerkUser = {
  id: string;
  primary_email_address_id: string | null;
  email_addresses: { id: string; email_address: string }[];
};

async function fetchClerkUser(clerkId: string, secret: string): Promise<ClerkUser | null> {
  const res = await fetch(`https://api.clerk.com/v1/users/${encodeURIComponent(clerkId)}`, {
    headers: { Authorization: `Bearer ${secret}` },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Clerk API ${res.status}: ${await res.text()}`);
  return (await res.json()) as ClerkUser;
}

function primaryEmail(u: ClerkUser): string | null {
  const primary = u.email_addresses.find((e) => e.id === u.primary_email_address_id) ?? u.email_addresses[0];
  return primary?.email_address?.trim().toLowerCase() ?? null;
}

async function main() {
  const apply = process.argv.includes("--apply");
  const secret = process.env.CLERK_SECRET_KEY;
  if (!secret) throw new Error("CLERK_SECRET_KEY not set (.env.local)");

  const db = createClient();
  let updated = 0;
  let skippedNoClerk = 0;
  let skippedNoEmail = 0;
  let skippedCollision = 0;

  try {
    const placeholders = await db.user.findMany({
      where: { email: { endsWith: PLACEHOLDER_DOMAIN } },
      select: { id: true, clerkId: true, email: true },
    });
    console.log(`Found ${placeholders.length} user(s) with a placeholder email.\n`);

    for (const row of placeholders) {
      const clerkUser = await fetchClerkUser(row.clerkId, secret);
      if (!clerkUser) {
        console.log(`· ${row.clerkId} — no Clerk account (deleted?), skipping`);
        skippedNoClerk++;
        continue;
      }
      const real = primaryEmail(clerkUser);
      if (!real) {
        console.log(`· ${row.clerkId} — Clerk account has no email, skipping`);
        skippedNoEmail++;
        continue;
      }

      // Respect the unique constraint: another row may already own this email.
      const clash = await db.user.findUnique({ where: { email: real }, select: { id: true } });
      if (clash && clash.id !== row.id) {
        console.log(`· ${row.clerkId} — real email ${real} already used by ${clash.id}, skipping`);
        skippedCollision++;
        continue;
      }

      console.log(`${apply ? "✓" : "→"} ${row.clerkId}: ${row.email}  ->  ${real}`);
      if (apply) {
        await db.user.update({ where: { id: row.id }, data: { email: real } });
        updated++;
      }
    }

    console.log(
      `\n${apply ? "Updated" : "Would update"} ${apply ? updated : placeholders.length - skippedNoClerk - skippedNoEmail - skippedCollision} row(s). ` +
        `Skipped: ${skippedNoClerk} no-Clerk, ${skippedNoEmail} no-email, ${skippedCollision} collision.`
    );
    if (!apply) console.log("\nDry run — re-run with --apply to write changes.");
  } finally {
    await db.$disconnect();
  }
}

main().catch((e) => {
  console.error("✗", e instanceof Error ? e.message : e);
  process.exit(1);
});
