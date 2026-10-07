"use client";

// ===========================================================
// components/admin/email/email-preview.tsx — A rendered email shown safely:
// the HTML goes into an iframe with srcDoc and an empty sandbox (no scripts,
// no same-origin access, no navigation), with desktop, mobile and plain-text
// views.
// ===========================================================

import { useState } from "react";
import { THEME } from "@/lib/theme";
import { Tabs, tabId, tabPanelId } from "@/components/admin/crm-dialogs";

export type RenderedEmail = { subject: string; html: string; text: string };

const VIEWS = [
  { id: "desktop", label: "Desktop" },
  { id: "mobile", label: "Mobile" },
  { id: "text", label: "Plain text" },
];

export function EmailPreview({ email, idPrefix = "email-preview" }: { email: RenderedEmail; idPrefix?: string }) {
  const [view, setView] = useState("desktop");
  return (
    <div>
      <div style={{ fontSize: 13, color: THEME.textDim, marginBottom: 10 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: THEME.textMuted, textTransform: "uppercase", letterSpacing: "0.04em", marginRight: 8 }}>Subject</span>
        <span style={{ color: THEME.text, fontWeight: 600 }}>{email.subject}</span>
      </div>
      <Tabs tabs={VIEWS} value={view} onChange={setView} idPrefix={idPrefix} label="Preview format" />
      <div
        role="tabpanel"
        id={tabPanelId(idPrefix, view)}
        aria-labelledby={tabId(idPrefix, view)}
        style={{ marginTop: 12, display: "flex", justifyContent: "center", background: THEME.surface1, borderRadius: THEME.radius, padding: 12 }}
      >
        {view === "text" ? (
          <pre
            style={{
              width: "100%",
              maxHeight: 640,
              overflow: "auto",
              margin: 0,
              whiteSpace: "pre-wrap",
              fontFamily: THEME.fontMono,
              fontSize: 12,
              color: THEME.text,
              background: THEME.surface2,
              border: `1px solid ${THEME.border}`,
              borderRadius: 8,
              padding: 14,
            }}
          >
            {email.text}
          </pre>
        ) : (
          <iframe
            title={`Email preview (${view})`}
            sandbox=""
            srcDoc={email.html}
            style={{
              width: view === "mobile" ? 375 : "100%",
              maxWidth: "100%",
              height: 640,
              border: `1px solid ${THEME.border}`,
              borderRadius: 8,
              background: "#fff",
            }}
          />
        )}
      </div>
    </div>
  );
}
