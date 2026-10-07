"use client";

// ===========================================================
// components/growth/service-request-card.tsx — Request a founder service
// (Pro: First-Document Review, Team: 30-minute Workflow Setup). Shows the
// real "{n} left this month" from /api/services and refuses politely when the
// cap is reached or the bonus was already used. Renders nothing for plans the
// service isn't part of.
// ===========================================================

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Send, CheckCircle2 } from "lucide-react";
import { THEME, glow } from "@/lib/theme";
import type { FounderService } from "@/lib/plans";

type ServiceState = {
  kind: FounderService;
  name: string;
  eligible: boolean;
  cap: number;
  left: number;
  requested: { at: string; status: string } | null;
};

const COPY: Record<FounderService, { pitch: string; placeholder: string; done: string }> = {
  founder_review: {
    pitch: "Send me one document and I'll reply by email with short written notes on what reads as AI and why. Boubaker, founder.",
    placeholder: "Anything I should know? (optional: what it's for, what worries you)",
    done: "Request received. I'll reply by email with my notes, usually within a few days.",
  },
  team_setup: {
    pitch: "A 30-minute call with me to set up your voice profiles, seats and an upload or API workflow. Boubaker, founder.",
    placeholder: "Your team size, time zone and two or three times that suit you",
    done: "Request received. I'll email you to book the call.",
  },
};

export function ServiceRequestCard({ kind, documentId }: { kind: FounderService; documentId?: string }) {
  const [state, setState] = useState<ServiceState | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch("/api/services")
      .then((r) => (r.ok ? (r.json() as Promise<{ services: ServiceState[] }>) : null))
      .then((d) => { if (alive) setState(d?.services.find((s) => s.kind === kind) ?? null); })
      .catch(() => {});
    return () => { alive = false; };
  }, [kind]);

  if (!state || !state.eligible) return null;
  const copy = COPY[kind];

  async function request() {
    setBusy(true);
    try {
      const res = await fetch("/api/services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, note: note.trim() || undefined, documentId }),
      });
      const d = (await res.json().catch(() => ({}))) as { left?: number; error?: { code?: string; message?: string } };
      if (!res.ok) {
        toast.error(d.error?.message ?? "Couldn't send the request.");
        if (d.error?.code === "CAP_REACHED") setState((s) => (s ? { ...s, left: 0 } : s));
        return;
      }
      setState((s) => (s ? { ...s, left: d.left ?? s.left, requested: { at: new Date().toISOString(), status: "open" } } : s));
      toast.success("Request sent");
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <p style={{ margin: "0 0 10px", fontSize: 13, color: THEME.textDim, lineHeight: 1.6 }}>{copy.pitch}</p>
      {state.requested ? (
        <div style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 13, color: THEME.text }}>
          <CheckCircle2 size={16} color={THEME.human} aria-hidden="true" style={{ flexShrink: 0, marginTop: 2 }} />
          <span>{state.requested.status === "open" ? copy.done : "You've used this bonus. Thank you!"}</span>
        </div>
      ) : state.left <= 0 ? (
        <p style={{ margin: 0, fontSize: 13, color: THEME.textMuted }}>{`All ${state.cap} slots for this month are taken. New slots open on the 1st.`}</p>
      ) : (
        <>
          <textarea value={note} onChange={(e) => setNote(e.target.value.slice(0, 1000))} placeholder={copy.placeholder} rows={3} aria-label="Note for the founder"
            style={{ width: "100%", boxSizing: "border-box", border: `1px solid ${THEME.border}`, borderRadius: 8, padding: "9px 12px", fontSize: 13, color: THEME.text, background: THEME.surface1, outline: "none", fontFamily: THEME.fontSans, resize: "vertical", lineHeight: 1.5 }} />
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 10, flexWrap: "wrap" }}>
            <button onClick={request} disabled={busy}
              style={{ display: "inline-flex", alignItems: "center", gap: 6, background: THEME.gradient, color: "#fff", border: "none", borderRadius: 9, padding: "9px 16px", fontSize: 13, fontWeight: 700, cursor: busy ? "wait" : "pointer", boxShadow: glow(THEME.brand, 0.28), fontFamily: THEME.fontSans }}>
              <Send size={14} aria-hidden="true" /> {busy ? "Sending…" : kind === "founder_review" ? "Request my review" : "Request the setup call"}
            </button>
            <span className="tnum" style={{ fontSize: 12, color: THEME.textMuted }}>{`${state.left} of ${state.cap} left this month`}</span>
          </div>
        </>
      )}
    </div>
  );
}
