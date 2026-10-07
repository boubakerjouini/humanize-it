// ===========================================================
// GET/POST /api/me/email-preferences — The signed-in user's email choices
//
// GET  → { email, topics, pendingTopics, lifecycleEmails, prompt }
// POST { subscribe?, unsubscribe?, lifecycleEmails?, dismissPrompt?, source? }
//      → same shape.
//
// Changes are deltas, never a full set, so a client that only knows about one
// topic can't silently withdraw (or confirm) another, e.g. a waitlist topic
// still waiting for its double opt-in. `subscribe` grants directly (method
// in_app: the user ticked the box here and Clerk verified the address, so no
// double opt-in); `unsubscribe` withdraws (method preferences). Every POST
// marks the in-app prompt as answered, so the consent card never comes back
// after Save or Not now.
// `prompt` stays false for anyone who unsubscribed before: we don't re-ask.
// ===========================================================

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ensureUser } from "@/lib/user";
import { clientIp } from "@/lib/client-ip";
import { getOrCreateContactForUser } from "@/lib/crm/contacts";
import { grantTopics, markConsentPrompted, setLifecycleEmails, withdrawTopics } from "@/lib/crm/consent";
import { TOPICS, type ConsentWordingId, type Topic } from "@/lib/growth/constants";

const topicList = z.array(z.enum(TOPICS)).max(TOPICS.length);

const bodySchema = z.object({
  subscribe: topicList.optional(),
  unsubscribe: topicList.optional(),
  lifecycleEmails: z.boolean().optional(),
  dismissPrompt: z.boolean().optional(),
  source: z.enum(["consent_card", "settings"]).optional(),
});

/** The wording shown next to each topic's in-app checkbox (ConsentRecord proof). */
const IN_APP_WORDING: Record<Topic, ConsentWordingId> = {
  tips: "inapp-tips-v1",
  extension_launch: "ext-v1",
};

function unauthorized() {
  return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Authentication required." } }, { status: 401 });
}

function internalError(label: string, err: unknown) {
  console.error(`[me/email-preferences] ${label}:`, err instanceof Error ? err.message : err);
  return NextResponse.json({ error: { code: "INTERNAL_ERROR", message: "Something went wrong." } }, { status: 500 });
}

async function contactIdFor(clerkId: string): Promise<{ contactId: string | null; email: string }> {
  const user = await ensureUser(clerkId);
  return { contactId: await getOrCreateContactForUser(user.id), email: user.email };
}

async function snapshot(contactId: string | null, fallbackEmail: string) {
  const contact = contactId
    ? await db.contact.findUnique({
        where: { id: contactId },
        select: {
          email: true,
          subscribedTopics: true,
          pendingTopics: true,
          lifecycleEmails: true,
          consentPromptedAt: true,
          unsubscribedAt: true,
        },
      })
    : null;
  if (!contact) {
    return { email: fallbackEmail, topics: [], pendingTopics: [], lifecycleEmails: true, prompt: false };
  }
  return {
    email: contact.email ?? fallbackEmail,
    topics: contact.subscribedTopics,
    pendingTopics: contact.pendingTopics,
    lifecycleEmails: contact.lifecycleEmails,
    prompt: !contact.consentPromptedAt && !contact.unsubscribedAt && contact.subscribedTopics.length === 0,
  };
}

export async function GET() {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) return unauthorized();
    const { contactId, email } = await contactIdFor(clerkId);
    return NextResponse.json(await snapshot(contactId, email));
  } catch (err) {
    return internalError("GET", err);
  }
}

export async function POST(req: Request) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) return unauthorized();

    let raw: unknown;
    try {
      raw = await req.json();
    } catch {
      return NextResponse.json({ error: { code: "INVALID_JSON", message: "Invalid JSON body." } }, { status: 400 });
    }
    const parsed = bodySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: { code: "INVALID_INPUT", message: "Invalid preferences." } }, { status: 400 });
    }
    const body = parsed.data;

    const { contactId, email } = await contactIdFor(clerkId);
    if (!contactId) {
      return NextResponse.json({ error: { code: "DB_ERROR", message: "Could not load your preferences." } }, { status: 503 });
    }

    const source = body.source ?? "settings";
    const meta = { source: `in_app:${source}`, ip: clientIp(req), userAgent: req.headers.get("user-agent") };

    const unsubscribe = new Set<Topic>(body.unsubscribe ?? []);
    // A topic in both lists is a contradiction: withdrawing is the safe reading.
    for (const topic of new Set<Topic>(body.subscribe ?? [])) {
      if (unsubscribe.has(topic)) continue;
      await grantTopics(contactId, [topic], { ...meta, method: "in_app", pending: false, wording: IN_APP_WORDING[topic] });
    }
    if (unsubscribe.size > 0) await withdrawTopics(contactId, [...unsubscribe], { ...meta, method: "preferences" });

    if (typeof body.lifecycleEmails === "boolean") {
      await setLifecycleEmails(contactId, body.lifecycleEmails, { ...meta, method: "preferences" });
    }

    await markConsentPrompted(contactId);
    return NextResponse.json(await snapshot(contactId, email));
  } catch (err) {
    return internalError("POST", err);
  }
}
