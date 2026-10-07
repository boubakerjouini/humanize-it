// ===========================================================
// lib/email/resend-client.ts — Lazy Resend client and error classification.
// The SDK returns { data, error } instead of throwing, so callers inspect
// `error.name`. The client is built on first use, never at import, so a
// missing RESEND_API_KEY can't break a module that merely imports this file.
// ===========================================================

import { Resend } from "resend";

let client: Resend | null = null;
let clientKey: string | null = null;

export function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) return null;
  if (!client || clientKey !== key) {
    client = new Resend(key);
    clientKey = key;
  }
  return client;
}

export type ResendErrorLike = { name?: string | null; message?: string | null; statusCode?: number | null } | null | undefined;

export type ResendErrorClass = {
  /** Worth retrying on a later run. */
  retryable: boolean;
  /** Daily or monthly quota used up: stop sending for this run. */
  quotaExceeded: boolean;
  /** Resend rejected the request outright, so nothing was sent (safe to resend per item). */
  definitelyNotSent: boolean;
  /** Same idempotency key, different payload: an earlier request with this key was accepted. */
  alreadyAccepted: boolean;
};

/** Payload problems: resending the same request can't succeed. */
const NOT_RETRYABLE = new Set([
  "validation_error",
  "invalid_parameter",
  "missing_required_field",
  "invalid_attachment",
  "invalid_idempotency_key",
]);

/** Rejections that happen before anything is queued (4xx other than idempotency conflicts). */
const REJECTED_UPFRONT = new Set([
  ...NOT_RETRYABLE,
  "invalid_from_address",
  "invalid_region",
  "missing_api_key",
  "invalid_api_key",
  "restricted_api_key",
  "invalid_access",
  "security_error",
  "not_found",
  "method_not_allowed",
  "daily_quota_exceeded",
  "monthly_quota_exceeded",
  "rate_limit_exceeded",
]);

export function classifyResendError(error: ResendErrorLike): ResendErrorClass {
  const name = error?.name ?? "";
  const quotaExceeded = name === "daily_quota_exceeded" || name === "monthly_quota_exceeded";
  return {
    retryable: !NOT_RETRYABLE.has(name),
    quotaExceeded,
    definitelyNotSent: REJECTED_UPFRONT.has(name),
    alreadyAccepted: name === "invalid_idempotent_request",
  };
}

export function describeResendError(error: ResendErrorLike): string {
  const name = error?.name || "unknown_error";
  const message = error?.message ? `: ${error.message}` : "";
  return `${name}${message}`.slice(0, 500);
}
