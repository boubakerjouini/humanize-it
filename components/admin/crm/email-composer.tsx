"use client";

// ===========================================================
// components/admin/crm/email-composer.tsx — The 1:1 email composer on the
// contact page. Sends through POST /api/admin/email/personal (stream B), which
// applies the kill switch, the allowlist, suppressions and the daily cap; this
// form never talks to Resend. A script can be inserted with the contact's data
// filled in, and a send is refused while {placeholders} are left in the text.
// ===========================================================

import { useId, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";
import { THEME } from "@/lib/theme";
import type { SendOutcome } from "@/lib/email/send";
import { composableScripts, fillScript, unfilledPlaceholders, type ScriptVars } from "@/lib/crm/scripts";
import { Pill } from "@/components/admin/crm-ui";
import { FormDialog, FormField, inputStyle, selectStyle } from "./form-dialog";

const MODE_COPY: Record<string, { label: string; color: string; detail: string }> = {
  off: { label: "Email off", color: THEME.textMuted, detail: "The kill switch is off: nothing will be delivered." },
  allowlist: { label: "Allowlist only", color: THEME.warn, detail: "Only allowlisted inboxes receive email in this environment." },
  live: { label: "Live", color: THEME.human, detail: "This sends a real email." },
};

function describeOutcome(r: SendOutcome): { ok: boolean; text: string } {
  switch (r.status) {
    case "sent":
      return { ok: true, text: "Email sent." };
    case "duplicate":
      return { ok: true, text: "This exact email was already sent to this contact." };
    case "skipped":
      return { ok: false, text: `Not sent: ${r.reason.replace(/_/g, " ")}.` };
    case "deferred":
      return { ok: false, text: `Not sent: ${r.reason === "allowlist" ? "the address isn't on the allowlist" : r.reason.replace(/_/g, " ")}.` };
    case "failed":
      return { ok: false, text: `Sending failed: ${r.error}` };
  }
}

type ComposerProps = {
  open: boolean;
  contactId: string;
  to: string | null;
  hasMarketingConsent: boolean;
  emailMode: string;
  vars: ScriptVars;
  onClose: () => void;
  onSent: () => void;
};

export function EmailComposer(props: ComposerProps) {
  return props.open ? <ComposerForm {...props} /> : null;
}

function ComposerForm({ open, contactId, to, hasMarketingConsent, emailMode, vars, onClose, onSent }: ComposerProps) {
  const id = useId();
  const [scriptId, setScriptId] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const scripts = composableScripts();
  const mode = MODE_COPY[emailMode] ?? MODE_COPY.off;
  const leftovers = unfilledPlaceholders(`${subject}\n${body}`);

  const insert = (sid: string) => {
    setScriptId(sid);
    const script = scripts.find((s) => s.id === sid);
    if (!script) return;
    setSubject(fillScript(script.subject ?? "", vars).text);
    setBody(fillScript(script.body, vars).text);
  };

  const notes = scripts.find((s) => s.id === scriptId)?.notes;

  return (
    <FormDialog
      open={open}
      width={620}
      title="Personal email"
      description={
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          To {to ?? "no address"} <Pill color={mode.color}>{mode.label}</Pill>
          <span style={{ fontSize: 12, color: THEME.textMuted }}>{mode.detail}</span>
        </span>
      }
      submitLabel="Send"
      submitDisabled={!to || !subject.trim() || !body.trim() || leftovers.length > 0}
      onClose={onClose}
      onSubmit={async () => {
        try {
          const res = await fetch("/api/admin/email/personal", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ contactId, subject: subject.trim(), bodyMd: body.trim() }),
          });
          const data = (await res.json().catch(() => ({}))) as { result?: SendOutcome; error?: { message?: string } };
          if (!res.ok || !data.result) {
            toast.error(res.status === 404 ? "Personal email isn't available yet." : (data.error?.message ?? "Sending failed."));
            return;
          }
          const outcome = describeOutcome(data.result);
          if (outcome.ok) {
            toast.success(outcome.text);
            onSent();
          } else {
            toast.error(outcome.text);
          }
        } catch {
          toast.error("Network error.");
        }
      }}
    >
      {!hasMarketingConsent ? (
        <div role="note" style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: "9px 12px", borderRadius: 9, background: THEME.warnDim, color: "#92400e", fontSize: 12, lineHeight: 1.5 }}>
          <AlertTriangle size={14} aria-hidden="true" style={{ flexShrink: 0, marginTop: 2 }} />
          No marketing consent: keep it personal, no offers.
        </div>
      ) : null}
      <FormField label="Start from a script" htmlFor={`${id}-script`} hint={notes}>
        <select id={`${id}-script`} value={scriptId} onChange={(e) => insert(e.target.value)} style={{ ...selectStyle, width: "100%" }}>
          <option value="">Blank email</option>
          {scripts.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </FormField>
      <FormField label="Subject" htmlFor={`${id}-subject`}>
        <input id={`${id}-subject`} value={subject} maxLength={200} onChange={(e) => setSubject(e.target.value)} style={inputStyle} />
      </FormField>
      <FormField label="Message" htmlFor={`${id}-body`} hint="Plain text or Markdown. It goes out as a personal note signed by you.">
        <textarea id={`${id}-body`} value={body} onChange={(e) => setBody(e.target.value)} rows={12} maxLength={10_000} style={{ ...inputStyle, resize: "vertical", lineHeight: 1.5 }} />
      </FormField>
      {leftovers.length > 0 ? (
        <div role="alert" style={{ fontSize: 12, color: THEME.ai }}>
          Fill in before sending: {leftovers.map((p) => `{${p}}`).join(", ")}
        </div>
      ) : null}
    </FormDialog>
  );
}
