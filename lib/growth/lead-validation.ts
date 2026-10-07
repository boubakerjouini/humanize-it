// ===========================================================
// lib/growth/lead-validation.ts — Input rules for the public lead form
// (POST /api/public/leads): the request schema, the bot check, address quality
// (role inboxes, throwaway domains, a domain that can't receive mail) and which
// email flow a capture triggers. Everything except checkMailDomain() is pure.
//
// The schema is strict on purpose: a detector report carries scores and
// pattern labels only, so a request that tries to send the user's text (or any
// unknown field) is rejected rather than silently dropped.
// ===========================================================

import { promises as dns } from "node:dns";
import { z } from "zod";
import { isRoleAddress, normalizeEmail, emailDomain } from "@/lib/email/address";
import type { FlowKey } from "@/lib/email/catalog";
import {
  MAGNET_SLUGS,
  PUBLIC_LEAD_SOURCES,
  TOPICS,
  type ConsentWordingId,
  type MagnetSlug,
  type PublicLeadSource,
  type Topic,
} from "@/lib/growth/constants";
import { isDisposableDomain } from "@/lib/growth/disposable-domains";

export const LEAD_MAX_BODY_BYTES = 8 * 1024;
/** A human needs longer than this to read the form and type an address. */
export const MIN_FILL_MS = 1500;
export const MX_TIMEOUT_MS = 1500;

/** Sources whose capture is about a lead magnet (they must name one). */
const MAGNET_SOURCES: ReadonlySet<PublicLeadSource> = new Set(["magnet_page", "exit_intent", "blog_inline"]);

export const reportContextSchema = z
  .object({
    instantScore: z.number().min(0).max(100),
    deepScore: z.number().min(0).max(100).optional(),
    verdict: z.string().trim().max(80).optional(),
    confidence: z.string().trim().max(20).optional(),
    patterns: z
      .array(
        z
          .object({
            id: z.string().trim().min(1).max(60),
            label: z.string().trim().min(1).max(80),
            hits: z.number().int().min(0).max(999),
          })
          .strict()
      )
      .max(12)
      .default([]),
    wordCount: z.number().int().min(0).max(20000).optional(),
  })
  .strict();

export type ReportContext = z.infer<typeof reportContextSchema>;

export const leadRequestSchema = z
  .object({
    email: z.string().trim().min(3).max(254),
    source: z.enum(PUBLIC_LEAD_SOURCES),
    magnet: z.enum(MAGNET_SLUGS).optional(),
    topics: z.array(z.enum(TOPICS)).max(2).default([]),
    /** Accepted for logging only; the wording stored is derived from the topic server-side. */
    wording: z.string().max(40).optional(),
    hp: z.string().max(200).optional(),
    elapsedMs: z.number().int().min(0).optional(),
    path: z.string().max(200).optional(),
    context: reportContextSchema.optional(),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (MAGNET_SOURCES.has(v.source) && !v.magnet) {
      ctx.addIssue({ code: "custom", path: ["magnet"], message: "Choose a guide to download." });
    }
    if (v.source === "detector_report" && !v.context) {
      ctx.addIssue({ code: "custom", path: ["context"], message: "Run the detector first." });
    }
    if (v.source === "extension_waitlist" && !v.topics.includes("extension_launch")) {
      ctx.addIssue({ code: "custom", path: ["topics"], message: "The waitlist needs the launch-updates opt-in." });
    }
    // The Founding 100 list is an offer announcement: joining it is the tips opt-in.
    if (v.source === "founding_waitlist" && !v.topics.includes("tips")) {
      ctx.addIssue({ code: "custom", path: ["topics"], message: "The founding list needs the tips opt-in." });
    }
    if (v.topics.includes("extension_launch") && v.source !== "extension_waitlist") {
      ctx.addIssue({ code: "custom", path: ["topics"], message: "Launch updates are only offered on the waitlist." });
    }
  });

export type LeadRequest = z.infer<typeof leadRequestSchema>;

/** Honeypot filled, or the form was submitted faster than a person can type. */
export function isLikelyBot(input: { hp?: string; elapsedMs?: number }): boolean {
  if (input.hp && input.hp.trim().length > 0) return true;
  if (input.elapsedMs === undefined || input.elapsedMs < MIN_FILL_MS) return true;
  return false;
}

export type EmailQuality =
  | { ok: true; email: string; domain: string }
  | { ok: false; code: "INVALID_EMAIL" | "DISPOSABLE_EMAIL"; message: string };

/** Shape, role inbox and throwaway-domain checks (no network). */
export function checkEmailQuality(raw: string): EmailQuality {
  const email = normalizeEmail(raw);
  const domain = emailDomain(email);
  if (!email || !domain) return { ok: false, code: "INVALID_EMAIL", message: "Please enter a valid email address." };
  if (isRoleAddress(email)) {
    return { ok: false, code: "INVALID_EMAIL", message: "Please use a personal address, not a no-reply or system inbox." };
  }
  if (isDisposableDomain(domain)) {
    return { ok: false, code: "DISPOSABLE_EMAIL", message: "Please use a permanent email address so the download reaches you." };
  }
  return { ok: true, email, domain };
}

export type MailResolver = {
  resolveMx: (domain: string) => Promise<{ exchange: string; priority: number }[]>;
  resolve4: (domain: string) => Promise<string[]>;
  resolve6: (domain: string) => Promise<string[]>;
};

const NO_RECORD_CODES = new Set(["ENOTFOUND", "ENODATA", "NXDOMAIN"]);

function dnsCode(err: unknown): string | undefined {
  return err && typeof err === "object" && "code" in err ? String((err as { code?: unknown }).code) : undefined;
}

async function hasAddressRecord(domain: string, resolver: MailResolver): Promise<"yes" | "no" | "unknown"> {
  const attempts = await Promise.allSettled([resolver.resolve4(domain), resolver.resolve6(domain)]);
  if (attempts.some((a) => a.status === "fulfilled" && a.value.length > 0)) return "yes";
  const allMissing = attempts.every((a) => a.status === "rejected" && NO_RECORD_CODES.has(dnsCode(a.reason) ?? ""));
  return allMissing ? "no" : "unknown";
}

/**
 * Can this domain receive mail? MX first, then A/AAAA (RFC 5321 implicit MX).
 * Only a definite "no such record" answer, or a null MX (RFC 7505), rejects.
 * Timeouts and resolver errors fail open: a slow DNS server must never cost a
 * real person their download.
 */
export async function checkMailDomain(
  domain: string,
  opts: { timeoutMs?: number; resolver?: MailResolver } = {}
): Promise<"ok" | "invalid"> {
  const resolver = opts.resolver ?? dns;
  const lookup = async (): Promise<"ok" | "invalid"> => {
    try {
      const mx = await resolver.resolveMx(domain);
      if (mx.length === 0) return (await hasAddressRecord(domain, resolver)) === "no" ? "invalid" : "ok";
      const nullMx = mx.length === 1 && (mx[0].exchange === "" || mx[0].exchange === ".");
      return nullMx ? "invalid" : "ok";
    } catch (err) {
      if (!NO_RECORD_CODES.has(dnsCode(err) ?? "")) return "ok";
      return (await hasAddressRecord(domain, resolver)) === "no" ? "invalid" : "ok";
    }
  };
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<"ok">((resolve) => {
    timer = setTimeout(() => resolve("ok"), opts.timeoutMs ?? MX_TIMEOUT_MS);
  });
  try {
    return await Promise.race([lookup().catch(() => "ok" as const), timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** The consent wording shown next to each topic's opt-in (stored on the ConsentRecord). */
export const TOPIC_WORDING: Record<Topic, ConsentWordingId> = {
  tips: "tips-v1",
  extension_launch: "ext-v1",
};

export type LeadKind = "magnet" | "report" | "waitlist" | "founding";

export function leadKind(source: PublicLeadSource): LeadKind {
  if (source === "detector_report") return "report";
  if (source === "extension_waitlist") return "waitlist";
  if (source === "founding_waitlist") return "founding";
  return "magnet";
}

/** The transactional flow whose toggle gates the email a capture sends. */
export function deliveryFlow(kind: LeadKind): FlowKey {
  switch (kind) {
    case "magnet":
      return "magnet_delivery";
    case "report":
      return "detector_report";
    case "waitlist":
      return "waitlist_confirm";
    case "founding":
      return "doi_confirm";
  }
}

/** Rate-limit bucket for "one email per inbox per thing per day". */
export function recipientLimitKey(canonicalHash: string, source: PublicLeadSource, magnet?: MagnetSlug): string {
  return `lead:to:${canonicalHash}:${magnet ?? source}`;
}

/** First zod issue as a user-facing message. */
export function firstIssueMessage(error: z.ZodError): string {
  const issue = error.issues[0];
  if (!issue) return "Invalid request.";
  if (issue.path[0] === "email") return "Please enter a valid email address.";
  return issue.message || "Invalid request.";
}
