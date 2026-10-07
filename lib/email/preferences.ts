// ===========================================================
// lib/email/preferences.ts — The email preference center and one-click
// unsubscribe (spec §5.7). The signed link proves inbox ownership, so no
// sign-in is needed, and every change applies immediately (stricter than the
// 48 hours Gmail and Yahoo allow). Opting back in here is a direct grant with
// method "preferences"; the ConsentRecord keeps the proof.
// ===========================================================

import { z } from "zod";
import { db } from "@/lib/db";
import { emailHash, maskEmail, normalizeEmail } from "@/lib/email/address";
import { verifyToken, type UnsubScope } from "@/lib/email/tokens";
import { grantTopics, setLifecycleEmails, withdrawTopics, type ConsentMeta } from "@/lib/crm/consent";
import { TOPICS, TOPIC_LABELS, type Topic } from "@/lib/growth/constants";

export type PreferencesView = {
  maskedEmail: string;
  topics: { topic: Topic; label: string; subscribed: boolean; pending: boolean }[];
  /** Account (service) emails exist only for contacts with an account. */
  lifecycle: { applicable: boolean; enabled: boolean };
  /** The address bounced or complained: nothing but transactional mail can reach it anyway. */
  deliverable: boolean;
};

export type RequestMeta = { ip?: string | null; userAgent?: string | null };

export const preferencesInputSchema = z.object({
  t: z.string().min(10).max(2048),
  topics: z.array(z.enum(TOPICS)).max(TOPICS.length),
  lifecycle: z.boolean().optional(),
  /** "Unsubscribe from everything except account and billing notices." */
  all: z.boolean().optional(),
});
export type PreferencesInput = z.infer<typeof preferencesInputSchema>;

/** Contact id of a preference-center token (prefs), or null. */
export function contactFromPrefsToken(token: string | null | undefined): { contactId: string; scope: UnsubScope | null } | null {
  const payload = verifyToken(token, "prefs");
  return payload ? { contactId: payload.c, scope: payload.s ?? null } : null;
}

export async function loadPreferences(contactId: string): Promise<PreferencesView | null> {
  const c = await db.contact.findUnique({
    where: { id: contactId },
    select: { email: true, userId: true, subscribedTopics: true, pendingTopics: true, lifecycleEmails: true, emailStatus: true },
  });
  if (!c || !c.email) return null;
  return {
    maskedEmail: maskEmail(c.email),
    topics: TOPICS.map((topic) => ({
      topic,
      label: TOPIC_LABELS[topic],
      subscribed: c.subscribedTopics.includes(topic),
      pending: !c.subscribedTopics.includes(topic) && c.pendingTopics.includes(topic),
    })),
    lifecycle: { applicable: !!c.userId, enabled: c.lifecycleEmails },
    deliverable: c.emailStatus === "ok",
  };
}

function meta(method: ConsentMeta["method"], source: string, req: RequestMeta): ConsentMeta {
  return { method, source, ip: req.ip ?? null, userAgent: req.userAgent ?? null, actor: "recipient" };
}

/** RFC 8058 one-click: marketing withdraws every topic, lifecycle turns service email off, all does both. */
export async function applyOneClickUnsubscribe(contactId: string, scope: UnsubScope, req: RequestMeta): Promise<void> {
  if (scope === "marketing" || scope === "all") await withdrawTopics(contactId, "all", meta("one_click", "list-unsubscribe", req));
  if (scope === "lifecycle" || scope === "all") await setLifecycleEmails(contactId, false, meta("one_click", "list-unsubscribe", req));
}

/**
 * An explicit opt-back-in through the signed link lifts the hashed
 * "unsubscribe" suppressions left by an earlier departure. Bounce, complaint,
 * manual and erasure suppressions stay.
 */
async function liftUnsubscribeSuppressions(contactId: string, scopes: ("marketing" | "nonessential")[]): Promise<void> {
  const c = await db.contact.findUnique({ where: { id: contactId }, select: { email: true } });
  const email = normalizeEmail(c?.email);
  if (!email) return;
  await db.emailSuppression.deleteMany({ where: { emailHash: emailHash(email), scope: { in: scopes }, reason: "unsubscribe" } });
}

/** Apply the preference form. Returns the new state, or null when the contact is gone. */
export async function updatePreferences(contactId: string, input: Omit<PreferencesInput, "t">, req: RequestMeta): Promise<PreferencesView | null> {
  const current = await loadPreferences(contactId);
  if (!current) return null;
  const source = "preference-center";

  if (input.all) {
    await withdrawTopics(contactId, "all", meta("preferences", source, req));
    if (current.lifecycle.applicable) await setLifecycleEmails(contactId, false, meta("preferences", source, req));
    return loadPreferences(contactId);
  }

  const wanted = new Set<Topic>(input.topics);
  const toGrant = current.topics.filter((t) => wanted.has(t.topic) && !t.subscribed).map((t) => t.topic);
  const toWithdraw = current.topics.filter((t) => !wanted.has(t.topic) && (t.subscribed || t.pending)).map((t) => t.topic);

  if (toWithdraw.length) await withdrawTopics(contactId, toWithdraw, meta("preferences", source, req));
  if (toGrant.length) {
    const res = await grantTopics(contactId, toGrant, { ...meta("preferences", source, req), pending: false });
    if (res.granted.length) await liftUnsubscribeSuppressions(contactId, ["marketing"]);
  }
  if (current.lifecycle.applicable && input.lifecycle !== undefined && input.lifecycle !== current.lifecycle.enabled) {
    const res = await setLifecycleEmails(contactId, input.lifecycle, meta("preferences", source, req));
    if (res.changed && input.lifecycle) await liftUnsubscribeSuppressions(contactId, ["nonessential"]);
  }
  return loadPreferences(contactId);
}

/** Client IP and user agent for the consent record (the IP is stored only as a keyed hash). */
export function requestMeta(req: Request): RequestMeta {
  const ip = req.headers.get("x-real-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  return { ip, userAgent: req.headers.get("user-agent") };
}
