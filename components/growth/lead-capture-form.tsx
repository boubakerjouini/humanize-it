"use client";

// ===========================================================
// components/growth/lead-capture-form.tsx — The one public email form, used
// by magnet pages, the blog box, exit intent, the detector report, the
// extension waitlist and the Founding 100 list (POST /api/public/leads).
//
// Consent rules: the tips box starts unticked and is never required for a
// download. Where the form's whole purpose is an opt-in (waitlists), the
// consent wording sits next to the button instead, and the topic is sent as
// `requiredTopic`. Magnets download right away; email is a copy.
// No zod here on purpose (bundle size): the server validates everything.
// ===========================================================

import { useEffect, useId, useRef, useState, type CSSProperties, type FormEvent } from "react";
import Link from "next/link";
import { THEME, glow } from "@/lib/theme";
import { CONSENT_WORDING, type MagnetSlug, type PublicLeadSource, type Topic } from "@/lib/growth/constants";

export type ReportContext = {
  instantScore: number;
  deepScore?: number;
  confidence?: "low" | "medium" | "high";
  /** Ids only: the server looks up each label itself. */
  patterns: { id: string; hits: number }[];
  wordCount?: number;
};

export type LeadResult = { ok: true; delivery: "email" | "link" | "unavailable" | "pending"; downloadUrl?: string };

type Props = {
  source: PublicLeadSource;
  magnet?: MagnetSlug;
  /** The topic the button itself opts into (waitlists). Its wording is shown beside the button. */
  requiredTopic?: Topic;
  /** Detector scores and pattern labels for the emailed report. Never the text. */
  context?: ReportContext;
  variant?: "card" | "inline" | "compact";
  ctaLabel?: string;
  /** What the email brings, for the fine print ("the kit", "your report"). */
  thing?: string;
  onSuccess?: (result: LeadResult) => void;
};

type Status =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "error"; message: string; field?: "email" }
  | { kind: "success"; result: LeadResult; tips: boolean };

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const LEAD_FLAG = "hz_lead";

export function markLeadCaptured(): void {
  try {
    localStorage.setItem(LEAD_FLAG, "1");
  } catch {
    // Private mode or blocked storage: the flag only hides future popups.
  }
}

export function hasCapturedLead(): boolean {
  try {
    return localStorage.getItem(LEAD_FLAG) === "1";
  } catch {
    return false;
  }
}

const offscreen: CSSProperties = { position: "absolute", left: "-10000px", top: "auto", width: 1, height: 1, overflow: "hidden" };

export function LeadCaptureForm({
  source,
  magnet,
  requiredTopic,
  context,
  variant = "card",
  ctaLabel,
  thing,
  onSuccess,
}: Props) {
  const id = useId();
  const mountedAt = useRef<number>(0);
  const [email, setEmail] = useState("");
  const [tips, setTips] = useState(false);
  const [website, setWebsite] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  useEffect(() => {
    mountedAt.current = Date.now();
  }, []);

  const isReport = source === "detector_report";
  const offerTips = requiredTopic !== "tips";
  const compact = variant === "compact";
  const label = ctaLabel ?? (magnet ? "Get the free PDF" : isReport ? "Email me this report" : "Notify me");

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (status.kind === "submitting") return;
    const value = email.trim();
    if (!EMAIL_SHAPE.test(value)) {
      setStatus({ kind: "error", message: "Please enter a valid email address.", field: "email" });
      return;
    }
    const topics: Topic[] = [];
    if (requiredTopic) topics.push(requiredTopic);
    if (offerTips && tips) topics.push("tips");
    setStatus({ kind: "submitting" });
    try {
      const res = await fetch("/api/public/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: value,
          source,
          magnet,
          topics,
          hp: website,
          elapsedMs: mountedAt.current ? Date.now() - mountedAt.current : 0,
          path: window.location.pathname.slice(0, 200),
          context,
        }),
      });
      const data = (await res.json().catch(() => null)) as (LeadResult & { error?: { code?: string; message?: string } }) | null;
      if (!res.ok || !data?.ok) {
        const code = data?.error?.code;
        const emailProblem = code === "INVALID_EMAIL" || code === "DISPOSABLE_EMAIL" || code === "EMAIL_DOMAIN_INVALID";
        setStatus({
          kind: "error",
          message: data?.error?.message ?? "Something went wrong. Please try again.",
          field: emailProblem ? "email" : undefined,
        });
        return;
      }
      markLeadCaptured();
      setStatus({ kind: "success", result: data, tips: topics.includes("tips") });
      onSuccess?.(data);
    } catch {
      setStatus({ kind: "error", message: "We couldn't reach the server. Check your connection and try again." });
    }
  }

  const wrapper: CSSProperties =
    variant === "card"
      ? {
          background: THEME.surface2,
          border: `1px solid ${THEME.border}`,
          borderRadius: THEME.radiusLg,
          padding: "22px",
          boxShadow: glow(THEME.brand, 0.12),
        }
      : {};

  if (status.kind === "success") {
    return (
      <div style={wrapper} role="status" aria-live="polite">
        <SuccessView
          result={status.result}
          tips={status.tips}
          isReport={isReport}
          source={source}
          onEdit={() => setStatus({ kind: "idle" })}
        />
      </div>
    );
  }

  const emailError = status.kind === "error" && status.field === "email";
  const errorId = `${id}-error`;
  const busy = status.kind === "submitting";

  return (
    <form onSubmit={submit} noValidate style={{ ...wrapper, position: "relative" }} aria-busy={busy}>
      <div style={offscreen} aria-hidden="true">
        <label htmlFor={`${id}-website`}>Leave this field empty</label>
        <input
          id={`${id}-website`}
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
        />
      </div>

      <label
        htmlFor={`${id}-email`}
        style={{ display: "block", fontSize: "13px", fontWeight: 600, color: THEME.text, marginBottom: "6px" }}
      >
        Your email
      </label>
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
        <input
          id={`${id}-email`}
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-invalid={emailError || undefined}
          aria-describedby={status.kind === "error" ? errorId : undefined}
          style={{
            flex: "1 1 220px",
            minWidth: 0,
            fontSize: "15px",
            padding: compact ? "9px 12px" : "11px 14px",
            borderRadius: THEME.radius,
            border: `1px solid ${emailError ? THEME.ai : THEME.borderStrong}`,
            background: THEME.surface2,
            color: THEME.text,
            fontFamily: THEME.fontSans,
          }}
        />
        <button
          type="submit"
          disabled={busy}
          style={{
            flex: "0 0 auto",
            background: busy ? THEME.borderStrong : THEME.brand,
            color: "#fff",
            fontSize: "14px",
            fontWeight: 700,
            padding: compact ? "9px 18px" : "11px 22px",
            borderRadius: THEME.radius,
            border: "none",
            cursor: busy ? "wait" : "pointer",
            fontFamily: THEME.fontSans,
          }}
        >
          {busy ? "Sending…" : label}
        </button>
      </div>

      {requiredTopic ? (
        <p style={{ fontSize: "12.5px", color: THEME.textDim, lineHeight: 1.5, margin: "10px 0 0" }}>
          {CONSENT_WORDING[requiredTopic === "tips" ? "tips-v1" : "ext-v1"]}
        </p>
      ) : null}

      {offerTips ? (
        <label
          htmlFor={`${id}-tips`}
          style={{ display: "flex", gap: "8px", alignItems: "flex-start", marginTop: "12px", fontSize: "13px", color: THEME.textDim, lineHeight: 1.5, cursor: "pointer" }}
        >
          <input
            id={`${id}-tips`}
            type="checkbox"
            checked={tips}
            onChange={(e) => setTips(e.target.checked)}
            style={{ marginTop: "3px", accentColor: THEME.brand, flex: "0 0 auto" }}
          />
          <span>
            {CONSENT_WORDING["tips-v1"]} <span style={{ color: THEME.textMuted }}>(optional)</span>
          </span>
        </label>
      ) : null}

      <p style={{ fontSize: "12px", color: THEME.textMuted, lineHeight: 1.5, margin: "10px 0 0" }}>
        {isReport
          ? "We'll email your scores and fix list, never your text. "
          : magnet
            ? `You'll get the PDF right away${thing ? ` and a copy of ${thing} by email` : " and a copy by email"}. We never share your email. `
            : "No spam, and we never share your email. "}
        <Link href="/privacy" style={{ color: THEME.textDim }}>
          Privacy Policy
        </Link>
      </p>

      <div id={errorId} role="alert" aria-live="assertive" style={{ minHeight: status.kind === "error" ? undefined : 0 }}>
        {status.kind === "error" ? (
          <p style={{ fontSize: "13px", color: THEME.ai, margin: "10px 0 0" }}>{status.message}</p>
        ) : null}
      </div>
    </form>
  );
}

function SuccessView({
  result,
  tips,
  isReport,
  source,
  onEdit,
}: {
  result: LeadResult;
  tips: boolean;
  isReport: boolean;
  source: PublicLeadSource;
  onEdit: () => void;
}) {
  const title: CSSProperties = { fontSize: "15px", fontWeight: 700, color: THEME.text, margin: "0 0 6px" };
  const body: CSSProperties = { fontSize: "14px", color: THEME.textDim, lineHeight: 1.6, margin: 0 };
  const editLink = (
    <button
      type="button"
      onClick={onEdit}
      style={{ background: "none", border: "none", padding: 0, color: THEME.brandHi, textDecoration: "underline", cursor: "pointer", fontSize: "13px", fontFamily: THEME.fontSans }}
    >
      Use a different email
    </button>
  );

  if (result.downloadUrl) {
    return (
      <div>
        <p style={title}>Your download is ready</p>
        <a
          href={result.downloadUrl}
          target="_blank"
          rel="noopener"
          style={{ display: "inline-block", background: THEME.gradient, color: "#fff", fontWeight: 700, fontSize: "14px", padding: "10px 22px", borderRadius: THEME.radius, textDecoration: "none", margin: "4px 0 10px", boxShadow: glow(THEME.brand, 0.3) }}
        >
          Download the PDF &rarr;
        </a>
        {result.delivery === "email" ? (
          <p style={body}>
            {tips
              ? "We've also emailed you a copy. To get the tips, open that email and click \"Yes, send me tips\" on the download page. Nothing is sent until you do."
              : "We've also emailed you a copy from HumanizeIt."}{" "}
            {editLink}
          </p>
        ) : null}
      </div>
    );
  }

  if (isReport) {
    return result.delivery === "email" ? (
      <div>
        <p style={title}>Report on its way</p>
        <p style={body}>
          Check your inbox for an email from HumanizeIt with your scores and fix list. {editLink}
        </p>
      </div>
    ) : (
      <div>
        <p style={title}>We can&apos;t email reports right now</p>
        <p style={body}>Your scores and patterns stay on this page. Please try again later.</p>
      </div>
    );
  }

  const founding = source === "founding_waitlist";
  return result.delivery === "email" ? (
    <div>
      <p style={title}>Almost done: check your inbox</p>
      <p style={body}>
        {founding
          ? "Click the confirm button in the email from HumanizeIt so the Founding 100 email reaches you."
          : "Click \"Confirm my spot\" in the email from HumanizeIt so the launch email reaches you."}{" "}
        {editLink}
      </p>
    </div>
  ) : (
    <div>
      <p style={title}>{founding ? "Thanks, you're on the list" : "Thanks, you're on the waitlist"}</p>
      <p style={body}>We&apos;ll email you once to confirm. Nothing else is sent until you do.</p>
    </div>
  );
}
