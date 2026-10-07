// ===========================================================
// app/api/webhooks/clerk/route.ts — Mirror Clerk users into the DB (svix-
// verified). Also hands each created/updated user to the CRM after the
// response, and writes the CRM's hashed suppressions before a user is deleted.
// CRM work is best-effort: it never changes this route's responses.
// ===========================================================

import { Webhook } from "svix";
import { headers } from "next/headers";
import { WebhookEvent } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import type { User } from "@/app/generated/prisma/client";
import { runAfter } from "@/lib/growth/safe";

/** Sync the CRM contact after the response. Webhooks carry no visitor cookies, so no attribution. */
function identifyAfterResponse(user: User, isNew: boolean): void {
  runAfter("clerk-identify", async () => {
    const { onUserIdentified } = await import("@/lib/crm/hooks");
    await onUserIdentified(user, { isNew, attribution: null, via: "clerk_webhook" });
  });
}

export async function POST(req: Request) {
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;

  if (!WEBHOOK_SECRET) {
    throw new Error("Missing CLERK_WEBHOOK_SECRET environment variable");
  }

  const headerPayload = await headers();
  const svix_id = headerPayload.get("svix-id");
  const svix_timestamp = headerPayload.get("svix-timestamp");
  const svix_signature = headerPayload.get("svix-signature");

  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new Response("Missing svix headers", { status: 400 });
  }

  const payload = await req.json();
  const body = JSON.stringify(payload);

  const wh = new Webhook(WEBHOOK_SECRET);
  let evt: WebhookEvent;

  try {
    evt = wh.verify(body, {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    }) as WebhookEvent;
  } catch {
    console.error("Clerk webhook verification failed");
    return new Response("Invalid signature", { status: 400 });
  }

  const eventType = evt.type;

  // Pick the address Clerk marks as primary — email_addresses[0] is not
  // guaranteed to be it (matches scripts/grant-admin.ts and lib/user.ts).
  const primaryEmail = (data: {
    primary_email_address_id?: string | null;
    email_addresses?: { id: string; email_address: string }[];
  }): string | undefined => {
    const list = data.email_addresses ?? [];
    const primary = list.find((e) => e.id === data.primary_email_address_id) ?? list[0];
    return primary?.email_address?.trim().toLowerCase();
  };

  if (eventType === "user.created") {
    const { id, first_name, last_name } = evt.data;
    const email = primaryEmail(evt.data);

    if (!email) {
      return new Response("No email found", { status: 400 });
    }

    const name = [first_name, last_name].filter(Boolean).join(" ") || null;
    // Upsert (not create): an API route may have already upserted this user with
    // a placeholder email before this webhook fired. Backfill the real email so
    // the admin allowlist and invite-email matching work reliably.
    const user = await db.user.upsert({
      where: { clerkId: id },
      update: { email, name },
      create: { clerkId: id, email, name },
    });
    identifyAfterResponse(user, true);
  }

  if (eventType === "user.updated") {
    const { id, first_name, last_name } = evt.data;
    const email = primaryEmail(evt.data);
    const name = [first_name, last_name].filter(Boolean).join(" ") || null;

    // Upsert, not update: the row may not exist yet if the create webhook was
    // missed. Never overwrite a known email with undefined.
    const user = await db.user.upsert({
      where: { clerkId: id },
      update: { email: email ?? undefined, name },
      create: { clerkId: id, email: email ?? `${id}@placeholder.humanize-it.app`, name },
    });
    identifyAfterResponse(user, false);
  }

  if (eventType === "user.deleted") {
    const { id } = evt.data;

    if (id) {
      // Hashed suppressions first: deleting the user cascades to its contact,
      // and an unsubscribed or bounced address must never be emailed again.
      try {
        const { onUserDeleted } = await import("@/lib/crm/hooks");
        await onUserDeleted({ clerkId: id, actor: "clerk_webhook" });
      } catch {
        // Best effort: the deletion itself must still happen.
      }

      // deleteMany is idempotent — won't throw if the row is already gone.
      await db.user.deleteMany({
        where: { clerkId: id },
      });
    }
  }

  return new Response("OK", { status: 200 });
}
