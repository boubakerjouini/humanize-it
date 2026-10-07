// ===========================================================
// /admin/segments — the built-in audience definitions with live counts.
// Counts use the same compileSegment path as the contacts list, so "View
// contacts" lands on exactly that many people. Campaigns target these, or the
// current contacts filter. (A custom segment builder was cut: at this size the
// contacts filters cover it.)
// ===========================================================

import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Megaphone } from "lucide-react";
import { getAdminUser } from "@/lib/admin";
import { THEME } from "@/lib/theme";
import type { SegmentRule } from "@/lib/crm/segments";
import { STAGE_LABELS, isStage } from "@/lib/crm/lifecycle";
import { TOPIC_LABELS, isTopic } from "@/lib/growth/constants";
import { Card, PageHeader, Pill } from "@/components/admin/crm-ui";
import { listSegmentsWithCounts } from "@/app/api/admin/segments/counts";

export const dynamic = "force-dynamic";

const days = (n: number) => `${n} day${n === 1 ? "" : "s"}`;
const words = (s: string) => s.replace(/_/g, " ");

/** One rule in plain words, e.g. "inactive for 14 days". */
function describeRule(rule: SegmentRule): string {
  switch (rule.field) {
    case "type":
      return rule.value === "user" ? "has an account" : rule.value === "lead" ? "lead without an account" : "prospect without an email";
    case "stage":
      return `${rule.op === "in" ? "stage is" : "stage is not"} ${rule.value.map((s) => (isStage(s) ? STAGE_LABELS[s] : s)).join(" or ")}`;
    case "pipelineStage":
      if (!("value" in rule)) return rule.op === "is_null" ? "not on the pipeline" : "on the pipeline";
      return `${rule.op === "in" ? "pipeline is" : "pipeline is not"} ${rule.value.map(words).join(" or ")}`;
    case "plan":
      return `plan is ${rule.value.join(" or ")}`;
    case "billing":
      return rule.value;
    case "score":
      return `score ${rule.op === "gte" ? "at least" : "at most"} ${rule.value}`;
    case "topic":
      return `${rule.op === "has" ? "subscribed to" : "not subscribed to"} ${isTopic(rule.value) ? TOPIC_LABELS[rule.value] : rule.value}`;
    case "tag":
      return `${rule.op === "has" ? "tagged" : "not tagged"}`;
    case "emailStatus":
      return `email status ${rule.value.join(" or ")}`;
    case "planExpiresAt":
      return `plan ends within ${days(rule.value)}`;
    case "event":
      return `${rule.op === "has" ? "had" : "never had"} ${words(rule.value.type)}${rule.value.withinDays ? ` in ${days(rule.value.withinDays)}` : ""}`;
    case "search":
      return `matches "${rule.value}"`;
    case "lastActiveAt":
    case "lastEmailedAt":
    case "firstDocumentAt":
    case "createdAt":
    case "signedUpAt": {
      const label = { lastActiveAt: "active", lastEmailedAt: "emailed", firstDocumentAt: "first document", createdAt: "added", signedUpAt: "signed up" }[rule.field];
      if (!("value" in rule)) return rule.op === "not_null" ? label : rule.field === "firstDocumentAt" ? "no first document" : `never ${label}`;
      return rule.op === "within_days" ? `${label} in the last ${days(rule.value)}` : rule.field === "lastActiveAt" ? `inactive for ${days(rule.value)}` : `${label} more than ${days(rule.value)} ago`;
    }
    default:
      return `${words(rule.field)} ${rule.op} ${rule.value.join(", ")}`;
  }
}

export default async function SegmentsPage() {
  if (!(await getAdminUser())) redirect("/dashboard");
  const segments = await listSegmentsWithCounts();

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 28px", fontFamily: THEME.fontSans }}>
      <PageHeader title="Segments" description="Built-in audiences with live counts. Open one to work the list, or use it as a campaign audience." />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 12 }}>
        {segments.map((s) => (
          <Card key={s.id} style={{ padding: 18, display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
              <div style={{ minWidth: 0 }}>
                <h2 style={{ fontSize: 15, fontWeight: 700, color: THEME.text, fontFamily: THEME.fontHeading, margin: 0 }}>{s.name}</h2>
                <p style={{ fontSize: 12, color: THEME.textDim, margin: "4px 0 0", lineHeight: 1.5 }}>{s.description}</p>
              </div>
              <span className="tnum" style={{ fontSize: 24, fontWeight: 700, color: s.count ? THEME.text : THEME.textMuted, lineHeight: 1 }} title={s.count === null ? "Count unavailable" : undefined}>
                {s.count ?? "—"}
              </span>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {s.filter.rules.map((r, i) => (
                <Pill key={i} color={THEME.textDim}>
                  {describeRule(r)}
                </Pill>
              ))}
              {!s.system ? <Pill color={THEME.accent}>saved</Pill> : null}
            </div>
            <div style={{ display: "flex", gap: 14, marginTop: "auto", paddingTop: 4, fontSize: 13, fontWeight: 600 }}>
              <Link href={`/admin/contacts?segment=${encodeURIComponent(s.id)}`} style={{ display: "inline-flex", alignItems: "center", gap: 5, color: THEME.brandHi, textDecoration: "none" }}>
                View contacts <ArrowRight size={13} aria-hidden="true" />
              </Link>
              <Link href={`/admin/campaigns?segmentRef=${encodeURIComponent(s.id)}`} style={{ display: "inline-flex", alignItems: "center", gap: 5, color: THEME.textDim, textDecoration: "none" }}>
                <Megaphone size={13} aria-hidden="true" /> Use in a campaign
              </Link>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
