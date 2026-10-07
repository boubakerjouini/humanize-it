// ===========================================================
// lib/email/webhook-handler.ts — Pure decisions for Resend webhook events
// (spec §5.6; the route in app/api/webhooks/resend does the writes).
//
// Delivery statuses only move forward: complained > bounced > delivered >
// failed/suppressed > sent. Events arrive out of order and are retried, so a
// late "delivered" must never overwrite a bounce. Opens and clicks are not
// tracked (first-party click tracking was cut); they are acknowledged and
// ignored, like contact and domain events.
// ===========================================================

export type ResendEventLike = {
  type: string;
  created_at?: string;
  data?: {
    email_id?: string;
    created_at?: string;
    to?: string[] | string;
    tags?: Record<string, string> | { name: string; value: string }[];
    bounce?: { type?: string; subType?: string; message?: string };
    failed?: { reason?: string };
    suppressed?: { type?: string; message?: string };
  };
};

export type WebhookAction =
  | { kind: "delivered" }
  | { kind: "bounced"; permanent: boolean; detail: string }
  | { kind: "complained" }
  | { kind: "failed"; detail: string }
  | { kind: "suppressed"; detail: string }
  | { kind: "ignore" };

/** Higher wins. Statuses we set ourselves before sending (skipped, cancelled) are never touched. */
const STATUS_RANK: Record<string, number> = {
  queued: 0,
  sending: 1,
  sent: 2,
  failed: 3,
  suppressed: 3,
  delivered: 4,
  bounced: 5,
  complained: 6,
};

/** The status a message should move to, or null to keep the current one. */
export function nextMessageStatus(current: string, incoming: string): string | null {
  const from = STATUS_RANK[current];
  const to = STATUS_RANK[incoming];
  if (from === undefined || to === undefined) return null;
  return to > from ? incoming : null;
}

export type BounceKind = "permanent" | "transient" | "undetermined";

/**
 * Resend sends hard bounces as email.bounced with bounce.type "Permanent";
 * soft ones come as email.delivery_delayed, but "Transient" and "Undetermined"
 * may also appear on email.bounced. Only a permanent bounce suppresses.
 */
export function bounceKind(bounce: { type?: string } | undefined): BounceKind {
  const type = bounce?.type ?? "";
  if (/permanent|hard/i.test(type)) return "permanent";
  if (/transient|soft/i.test(type)) return "transient";
  return "undetermined";
}

function detailOf(...parts: (string | undefined)[]): string {
  return parts.filter(Boolean).join(": ").slice(0, 300) || "unknown";
}

export function classifyEvent(evt: ResendEventLike): WebhookAction {
  const d = evt.data ?? {};
  switch (evt.type) {
    case "email.delivered":
      return { kind: "delivered" };
    case "email.bounced": {
      const kind = bounceKind(d.bounce);
      return { kind: "bounced", permanent: kind === "permanent", detail: detailOf(d.bounce?.type, d.bounce?.subType) };
    }
    case "email.complained":
      return { kind: "complained" };
    case "email.failed":
      return { kind: "failed", detail: detailOf("provider_failed", d.failed?.reason) };
    case "email.suppressed":
      return { kind: "suppressed", detail: detailOf("provider_suppressed", d.suppressed?.type) };
    default:
      return { kind: "ignore" };
  }
}

/** A tag's value on the event (Resend sends tags as an object or as a name/value array). */
export function eventTag(evt: ResendEventLike, name: string): string | null {
  const tags = evt.data?.tags;
  if (Array.isArray(tags)) {
    const value = tags.find((t) => t?.name === name)?.value;
    return typeof value === "string" ? value : null;
  }
  if (tags && typeof tags === "object") return typeof tags[name] === "string" ? tags[name] : null;
  return null;
}

/** Our message id from the "m" tag (object or array form), and Resend's id as the fallback key. */
export function messageRef(evt: ResendEventLike): { messageId: string | null; resendId: string | null; to: string | null } {
  const d = evt.data ?? {};
  let messageId = eventTag(evt, "m");
  if (messageId && !/^[A-Za-z0-9_-]{1,64}$/.test(messageId)) messageId = null;
  const to = Array.isArray(d.to) ? (d.to[0] ?? null) : typeof d.to === "string" ? d.to : null;
  return { messageId, resendId: typeof d.email_id === "string" ? d.email_id : null, to };
}

/** When the event happened (falls back to now for a malformed timestamp). */
export function eventTime(evt: ResendEventLike, now: Date = new Date()): Date {
  const raw = evt.created_at ?? evt.data?.created_at;
  const at = raw ? new Date(raw) : null;
  return at && !Number.isNaN(at.getTime()) ? at : now;
}

export type ContactEffect = {
  emailStatus: "bounced" | "complained" | null;
  suppression: { scope: "all" | "nonessential"; reason: "bounce" | "complaint" | "provider" } | null;
  withdrawTopics: boolean;
  exitSequences: boolean;
};

/** What an event does to the contact and the suppression list. */
export function contactEffect(action: WebhookAction): ContactEffect {
  const none: ContactEffect = { emailStatus: null, suppression: null, withdrawTopics: false, exitSequences: false };
  switch (action.kind) {
    case "bounced":
      return action.permanent ? { emailStatus: "bounced", suppression: { scope: "all", reason: "bounce" }, withdrawTopics: false, exitSequences: true } : none;
    case "complained":
      return { emailStatus: "complained", suppression: { scope: "nonessential", reason: "complaint" }, withdrawTopics: true, exitSequences: true };
    case "suppressed":
      return { emailStatus: null, suppression: { scope: "all", reason: "provider" }, withdrawTopics: false, exitSequences: false };
    default:
      return none;
  }
}

/** A complaint outranks a bounce on the contact too. */
export function nextContactStatus(current: string, incoming: "bounced" | "complained"): string | null {
  if (current === "complained") return null;
  if (current === incoming) return null;
  return incoming;
}
