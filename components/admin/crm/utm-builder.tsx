"use client";

// ===========================================================
// components/admin/crm/utm-builder.tsx — Build a tagged link to our own site
// following the attribution conventions (lib/growth/attribution.ts): source
// and medium from the suggested lists, campaign in kebab-case, optional
// content variant. Copies the URL; nothing is stored.
// ===========================================================

import { useId, useState } from "react";
import { toast } from "sonner";
import { Copy } from "lucide-react";
import { THEME } from "@/lib/theme";
import { primaryBtn } from "@/components/admin/crm-ui";
import { FormField, inputStyle } from "./form-dialog";

const SOURCES = ["reddit", "quora", "linkedin", "x", "youtube", "tiktok", "whatsapp", "producthunt", "outreach", "email"];
const MEDIUMS = ["community", "social", "dm", "email", "video", "referral"];
const PATHS = ["/", "/ai-detector", "/free-ai-humanizer", "/free", "/free/false-ai-flag-appeal-kit", "/free/ai-detection-field-guide", "/free/linkedin-humanizer-checklist", "/extension", "/lifetime"];

const kebab = (s: string) =>
  s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);

export function UtmBuilder({ origin }: { origin: string }) {
  const id = useId();
  const [path, setPath] = useState("/ai-detector");
  const [source, setSource] = useState("reddit");
  const [medium, setMedium] = useState("community");
  const [campaign, setCampaign] = useState("");
  const [content, setContent] = useState("");

  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  const url = new URL(cleanPath, origin);
  if (source.trim()) url.searchParams.set("utm_source", kebab(source));
  if (medium.trim()) url.searchParams.set("utm_medium", kebab(medium));
  if (campaign.trim()) url.searchParams.set("utm_campaign", kebab(campaign));
  if (content.trim()) url.searchParams.set("utm_content", kebab(content));
  const href = url.toString();

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(href);
      toast.success("Link copied");
    } catch {
      toast.error("Copy failed: select the link and copy it by hand.");
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12 }}>
        <FormField label="Page" htmlFor={`${id}-path`}>
          <input id={`${id}-path`} list={`${id}-paths`} value={path} onChange={(e) => setPath(e.target.value)} style={inputStyle} />
          <datalist id={`${id}-paths`}>
            {PATHS.map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>
        </FormField>
        <FormField label="Source" htmlFor={`${id}-source`}>
          <input id={`${id}-source`} list={`${id}-sources`} value={source} onChange={(e) => setSource(e.target.value)} style={inputStyle} />
          <datalist id={`${id}-sources`}>
            {SOURCES.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </FormField>
        <FormField label="Medium" htmlFor={`${id}-medium`}>
          <input id={`${id}-medium`} list={`${id}-mediums`} value={medium} onChange={(e) => setMedium(e.target.value)} style={inputStyle} />
          <datalist id={`${id}-mediums`}>
            {MEDIUMS.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
        </FormField>
        <FormField label="Campaign" htmlFor={`${id}-campaign`} hint="A topic, in kebab-case">
          <input id={`${id}-campaign`} value={campaign} onChange={(e) => setCampaign(e.target.value)} placeholder="false-flag-thread" style={inputStyle} />
        </FormField>
        <FormField label="Content (optional)" htmlFor={`${id}-content`} hint="Variant, e.g. a or b">
          <input id={`${id}-content`} value={content} onChange={(e) => setContent(e.target.value)} style={inputStyle} />
        </FormField>
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <output
          htmlFor={`${id}-path ${id}-source ${id}-medium ${id}-campaign ${id}-content`}
          style={{ flex: 1, minWidth: 0, padding: "9px 12px", borderRadius: 9, background: THEME.surface1, border: `1px solid ${THEME.border}`, fontFamily: THEME.fontMono, fontSize: 12, color: THEME.text, overflowWrap: "anywhere" }}
        >
          {href}
        </output>
        <button type="button" onClick={copy} style={primaryBtn}>
          <Copy size={14} aria-hidden="true" /> Copy
        </button>
      </div>
    </div>
  );
}
