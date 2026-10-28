"use client";

// ===========================================================
// components/admin/digest-test-button.tsx — "Send test digest to me" on the
// admin home. The daily digest only goes out for real once the founder read a
// test and set FOUNDER_DIGEST_ENABLED (lib/growth/founder-digest.ts).
// ===========================================================

import { useState } from "react";
import { Send } from "lucide-react";
import { toast } from "sonner";
import { THEME } from "@/lib/theme";
import { disabledStyle, ghostBtn } from "@/components/admin/crm-ui";
import { api } from "@/components/admin/email/api";

export function DigestTestButton({ enabled }: { enabled: boolean }) {
  const [busy, setBusy] = useState(false);

  const send = async () => {
    setBusy(true);
    const res = await api<{ message: string }>("/api/admin/digest/test", { method: "POST" });
    setBusy(false);
    if (!res.ok) return void toast.error(res.message);
    toast.success(res.data.message);
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginTop: 12 }}>
      <button type="button" onClick={() => void send()} disabled={busy} style={disabledStyle(ghostBtn, busy)}>
        <Send size={14} aria-hidden="true" /> {busy ? "Sending…" : "Send test digest to me"}
      </button>
      <span style={{ fontSize: 12, color: THEME.textMuted }}>
        Daily digest email: {enabled ? "on, sent after the 08:00 UTC job" : "off until FOUNDER_DIGEST_ENABLED is set"}
      </span>
    </div>
  );
}
