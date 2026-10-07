// ===========================================================
// lib/email/eligibility.ts — May this contact receive this kind of email? (pure)
//
// The stream decides the rule:
//   transactional  something they asked for (magnet, report, DOI, account notice)
//   lifecycle      service email to an account holder; can be turned off
//   marketing      needs a confirmed topic, a verified inbox and a postal address
//   personal       founder 1:1 note; respects every opt-out except topics
// Checks run in a fixed order so the reported reason is stable.
// ===========================================================

import type { EmailStream, Topic } from "@/lib/growth/constants";

export type SuppressionScope = "all" | "nonessential" | "marketing";

export type SkipReason =
  | "no_email"
  | "no_consent"
  | "unverified"
  | "suppressed"
  | "bad_status"
  | "lifecycle_off"
  | "not_user"
  | "no_postal_address"
  | "late"
  | "condition"
  | "trial_cap"
  | "contact_missing";

export type EligibilityContact = {
  email: string | null;
  userId: string | null;
  lifecycleEmails: boolean;
  subscribedTopics: readonly string[];
  emailVerifiedAt: Date | null;
  emailStatus: string;
};

export type EligibilityInput = {
  contact: EligibilityContact;
  stream: EmailStream;
  /** Required for marketing. */
  topic?: Topic | null;
  /** Scopes of the suppressions on file for this address. */
  suppressions: readonly SuppressionScope[];
  now: Date;
  postalAddressConfigured: boolean;
  /**
   * Admin test send (send.ts only delivers it to an allowlisted inbox): skips
   * the consent, verification, lifecycle and postal-address rules, never
   * suppressions or a bad status.
   */
  isTest?: boolean;
};

export type EligibilityResult = { ok: true } | { ok: false; reason: SkipReason };

const BLOCKING_SCOPES: Record<EmailStream, readonly SuppressionScope[]> = {
  transactional: ["all"],
  lifecycle: ["all", "nonessential"],
  marketing: ["all", "nonessential", "marketing"],
  personal: ["all", "nonessential"],
};

/** Statuses that block a stream (anything other than "ok" blocks lifecycle and marketing). */
function statusBlocks(stream: EmailStream, status: string): boolean {
  if (stream === "transactional") return status === "bounced" || status === "invalid";
  if (stream === "personal") return status === "bounced" || status === "invalid" || status === "complained";
  return status !== "ok";
}

export function checkEligibility(input: EligibilityInput): EligibilityResult {
  const { contact, stream } = input;
  if (!contact.email) return { ok: false, reason: "no_email" };

  if (input.suppressions.some((scope) => BLOCKING_SCOPES[stream].includes(scope))) {
    return { ok: false, reason: "suppressed" };
  }
  if (statusBlocks(stream, contact.emailStatus)) return { ok: false, reason: "bad_status" };
  if (input.isTest) return { ok: true };

  switch (stream) {
    case "transactional":
      return { ok: true };
    case "lifecycle":
      if (!contact.userId) return { ok: false, reason: "not_user" };
      if (!contact.lifecycleEmails) return { ok: false, reason: "lifecycle_off" };
      return { ok: true };
    case "personal":
      if (!contact.lifecycleEmails) return { ok: false, reason: "lifecycle_off" };
      return { ok: true };
    case "marketing":
      if (!input.topic || !contact.subscribedTopics.includes(input.topic)) return { ok: false, reason: "no_consent" };
      if (!contact.emailVerifiedAt) return { ok: false, reason: "unverified" };
      if (!input.postalAddressConfigured) return { ok: false, reason: "no_postal_address" };
      return { ok: true };
  }
}

/** One-click unsubscribe (RFC 8058 headers) applies to these streams only. */
export function usesOneClickUnsubscribe(stream: EmailStream): stream is "lifecycle" | "marketing" {
  return stream === "lifecycle" || stream === "marketing";
}
