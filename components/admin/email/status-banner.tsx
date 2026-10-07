"use client";

// ===========================================================
// components/admin/email/status-banner.tsx — The email status banner on every
// email admin page: sending mode (OFF / ALLOWLIST / LIVE), sending domain,
// configuration checks (present or missing, never values), today's sends
// against the cap, the last daily-job run, the circuit breaker, and "Run now"
// (which starts the job in the background and polls until it finishes).
// ===========================================================

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Loader2, Play, ShieldAlert, X } from "lucide-react";
import { toast } from "sonner";
import { THEME } from "@/lib/theme";
import { Card, Pill, Row, disabledStyle, fmtDateTime, fmtRelative, ghostBtn } from "@/components/admin/crm-ui";
import { api } from "@/components/admin/email/api";

type Run = { id: string; trigger: string; status: string; startedAt: string; finishedAt: string | null; actorEmail: string | null; error: string | null };
export type EmailStatus = {
  mode: "off" | "allowlist" | "live";
  production: boolean;
  allowlistCount: number;
  config: Record<"resendKey" | "from" | "replyTo" | "webhookSecret" | "tokenSecret" | "postalAddress" | "cronSecret", boolean>;
  domain: string | null;
  sentToday: number;
  cap: number;
  bulkCap: number;
  running: boolean;
  runs: Run[];
  breaker: { tripped: boolean; sent: number; bounceRate: number; complaintRate: number; lastTripAt: string | null };
};

const CONFIG_LABELS: [keyof EmailStatus["config"], string][] = [
  ["resendKey", "Resend key"],
  ["from", "From address"],
  ["replyTo", "Reply-to"],
  ["tokenSecret", "Token secret"],
  ["webhookSecret", "Webhook secret"],
  ["cronSecret", "Cron secret"],
  ["postalAddress", "Postal address"],
];

const POLL_MS = 3000;
const POLL_LIMIT_MS = 6 * 60_000;

function ModePill({ status }: { status: EmailStatus }) {
  if (status.mode === "live") return <Pill color={THEME.human} variant="solid">LIVE</Pill>;
  if (status.mode === "allowlist") {
    return (
      <Pill color={THEME.warn} variant="solid" title="Only allowlisted and admin inboxes receive email">
        ALLOWLIST · {status.allowlistCount}
      </Pill>
    );
  }
  return (
    <Pill color={THEME.ai} variant="solid" title="EMAIL_SENDING_ENABLED is off or Resend isn't configured">
      OFF
    </Pill>
  );
}

const label = { fontSize: 11, fontWeight: 600, color: THEME.textMuted, textTransform: "uppercase", letterSpacing: "0.04em" } as const;

/** `onStatus` lets a page react to the mode (e.g. disable sending while OFF). */
export function EmailStatusBanner({ onStatus }: { onStatus?: (s: EmailStatus) => void }) {
  const [status, setStatus] = useState<EmailStatus | null>(null);
  const [starting, setStarting] = useState(false);
  const [polling, setPolling] = useState(false);
  const pollStarted = useRef(0);
  const lastRunBefore = useRef<string | null>(null);
  const onStatusRef = useRef(onStatus);
  useEffect(() => {
    onStatusRef.current = onStatus;
  }, [onStatus]);

  const load = useCallback(
    () =>
      api<EmailStatus>("/api/admin/email/status").then((res) => {
        if (!res.ok) return null;
        setStatus(res.data);
        onStatusRef.current?.(res.data);
        return res.data;
      }),
    []
  );

  useEffect(() => {
    let live = true;
    api<EmailStatus>("/api/admin/email/status").then((res) => {
      if (!live || !res.ok) return;
      setStatus(res.data);
      onStatusRef.current?.(res.data);
    });
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    if (!polling) return;
    const timer = setInterval(async () => {
      const s = await load();
      const latest = s?.runs[0];
      const finished = latest && latest.id !== lastRunBefore.current && latest.status !== "running";
      if (finished || Date.now() - pollStarted.current > POLL_LIMIT_MS) {
        setPolling(false);
        if (finished) {
          if (latest.status === "ok") toast.success("Daily job finished.");
          else if (latest.status === "locked") toast.info("A run was already in progress; this one was skipped.");
          else toast.error("Daily job finished with errors. See the last run.");
        }
      }
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [polling, load]);

  const runNow = async () => {
    setStarting(true);
    lastRunBefore.current = status?.runs[0]?.id ?? null;
    const res = await api<{ started: boolean }>("/api/admin/email/run", { method: "POST" });
    setStarting(false);
    if (!res.ok) {
      toast.error(res.message);
      return;
    }
    toast.success("Daily job started.");
    pollStarted.current = Date.now();
    setPolling(true);
  };

  if (!status) {
    return (
      <Card style={{ padding: "14px 18px", marginBottom: 20 }}>
        <span style={{ fontSize: 13, color: THEME.textMuted }}>Loading email status…</span>
      </Card>
    );
  }

  const last = status.runs[0];
  const busy = starting || polling || status.running;
  const usage = status.cap ? Math.min(1, status.sentToday / status.cap) : 0;

  return (
    <Card style={{ padding: "14px 18px", marginBottom: 20 }}>
      <Row justify="space-between" align="flex-start" gap={16}>
        <Row gap={18} align="flex-start">
          <div>
            <div style={label}>Sending</div>
            <div style={{ marginTop: 4 }}>
              <ModePill status={status} />
            </div>
          </div>
          <div>
            <div style={label}>Domain</div>
            <div style={{ fontSize: 13, color: THEME.text, marginTop: 4 }}>{status.domain ?? <span style={{ color: THEME.ai }}>not set</span>}</div>
          </div>
          <div style={{ minWidth: 140 }}>
            <div style={label}>Sent today (UTC)</div>
            <div className="tnum" style={{ fontSize: 13, color: THEME.text, marginTop: 4 }}>
              {status.sentToday} / {status.cap}
              <span style={{ color: THEME.textMuted }}> · bulk {status.bulkCap}</span>
            </div>
            <div
              role="progressbar"
              aria-label="Daily send cap used"
              aria-valuenow={status.sentToday}
              aria-valuemin={0}
              aria-valuemax={status.cap}
              style={{ height: 4, background: THEME.surface3, borderRadius: 4, marginTop: 6 }}
            >
              <div style={{ width: `${usage * 100}%`, height: 4, borderRadius: 4, background: usage > 0.9 ? THEME.ai : THEME.brand }} />
            </div>
          </div>
          <div>
            <div style={label}>Last run</div>
            <div style={{ fontSize: 13, color: THEME.text, marginTop: 4 }} title={last ? fmtDateTime(last.startedAt) : undefined}>
              {last ? (
                <>
                  <Pill color={last.status === "ok" ? THEME.human : last.status === "error" ? THEME.ai : THEME.textMuted}>{last.status}</Pill>{" "}
                  {fmtRelative(last.startedAt)} · {last.trigger}
                </>
              ) : (
                <span style={{ color: THEME.textMuted }}>never</span>
              )}
            </div>
          </div>
          <div>
            <div style={label}>Circuit breaker</div>
            <div style={{ fontSize: 13, marginTop: 4 }}>
              {status.breaker.tripped ? (
                <Pill color={THEME.ai} variant="solid">
                  <ShieldAlert size={11} aria-hidden="true" /> Tripped
                </Pill>
              ) : (
                <Pill color={THEME.human} title={`${status.breaker.sent} marketing sends in 7 days`}>
                  Closed
                </Pill>
              )}
            </div>
          </div>
        </Row>
        <button type="button" onClick={() => void runNow()} disabled={busy} style={disabledStyle(ghostBtn, busy)}>
          {busy ? <Loader2 size={14} style={{ animation: "spin 0.8s linear infinite" }} aria-hidden="true" /> : <Play size={14} aria-hidden="true" />}
          {busy ? "Running…" : "Run now"}
        </button>
      </Row>
      <Row gap={6} style={{ marginTop: 12 }}>
        {CONFIG_LABELS.map(([key, text]) => {
          const ok = status.config[key];
          return (
            <Pill key={key} color={ok ? THEME.human : THEME.warn} title={ok ? "Configured" : "Missing"}>
              {ok ? <Check size={11} aria-label="Configured" /> : <X size={11} aria-label="Missing" />} {text}
            </Pill>
          );
        })}
      </Row>
      {status.mode === "off" ? (
        <p style={{ fontSize: 12, color: THEME.textDim, margin: "10px 0 0" }}>
          Sending is off: the daily job still recomputes contacts, runs sweeps and creates tasks, but no email leaves and no sequence advances.
        </p>
      ) : null}
      {last?.error ? (
        <p style={{ fontSize: 12, color: THEME.ai, margin: "8px 0 0", whiteSpace: "pre-wrap" }}>{last.error.slice(0, 400)}</p>
      ) : null}
    </Card>
  );
}
