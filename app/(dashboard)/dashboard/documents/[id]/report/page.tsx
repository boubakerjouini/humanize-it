// ===========================================================
// /dashboard/documents/:id/report — The Before/After Report (Pro and Team)
//
// A dated, printable record of what HumanizeIt's own pattern check found in a
// document before and after its rewrite. "Save as PDF" is window.print() with
// the print CSS below (the workspace chrome is hidden on paper). The page says
// plainly what the report is NOT: proof of who wrote the text, or a
// prediction of any other detector's score.
// ===========================================================

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { Lock } from "lucide-react";
import { db } from "@/lib/db";
import { ensureUser } from "@/lib/user";
import { planConfigFor } from "@/lib/quota";
import { analyzeText, type AnalysisResult, type PatternHit } from "@/lib/algorithms/analyzeText";
import { THEME, humanScore, humanScoreColor, humanScoreLabel } from "@/lib/theme";
import { ReportActions } from "@/components/growth/report-actions";
import { ServiceRequestCard } from "@/components/growth/service-request-card";

export const dynamic = "force-dynamic";
export const metadata = { title: "Before/After Report — HumanizeIt", robots: { index: false } };

type PageProps = { params: Promise<{ id: string }> };

const fmtDate = (d: Date) =>
  d.toLocaleString("en-US", { timeZone: "UTC", year: "numeric", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" }) + " UTC";

const CATEGORY_LABELS: Record<PatternHit["category"], string> = {
  vocabulary: "Vocabulary",
  phrase: "Phrasing",
  structural: "Structure",
  semantic: "Meaning",
  statistical: "Rhythm",
};

/** Stored analysis is Json; accept it only when it has the fields the report reads. */
function asAnalysis(value: unknown): AnalysisResult | null {
  if (typeof value !== "object" || value === null) return null;
  const v = value as Partial<AnalysisResult>;
  return typeof v.score === "number" && Array.isArray(v.patterns) && typeof v.stats === "object" ? (v as AnalysisResult) : null;
}

export default async function BeforeAfterReportPage({ params }: PageProps) {
  const { userId: clerkId } = await auth();
  if (!clerkId) redirect("/sign-in");
  const { id } = await params;

  const user = await ensureUser(clerkId);
  const doc = await db.document.findFirst({
    where: { id, userId: user.id },
    select: {
      id: true, title: true, originalText: true, rewrittenText: true, analysisResult: true,
      overallScore: true, tone: true, wordCount: true, createdAt: true, status: true, sourceType: true,
    },
  });
  if (!doc) notFound();

  const plan = planConfigFor(user);
  if (plan.id === "FREE") return <LockedReport />;

  const before = asAnalysis(doc.analysisResult) ?? analyzeText(doc.originalText);
  const after = doc.rewrittenText ? analyzeText(doc.rewrittenText) : null;
  const generatedAt = new Date();

  // One row per pattern found on either side, the biggest "before" problems first.
  const afterHits = new Map((after?.patterns ?? []).map((p) => [p.id, p.hits]));
  const rows = new Map<string, { id: string; label: string; category: PatternHit["category"]; before: number; after: number }>();
  for (const p of before.patterns) rows.set(p.id, { id: p.id, label: p.label, category: p.category, before: p.hits, after: afterHits.get(p.id) ?? 0 });
  for (const p of after?.patterns ?? []) if (!rows.has(p.id)) rows.set(p.id, { id: p.id, label: p.label, category: p.category, before: 0, after: p.hits });
  const patternRows = [...rows.values()].sort((a, b) => b.before - a.before || b.after - a.after);

  return (
    <div className="report-page" style={{ maxWidth: 820, margin: "0 auto", padding: "28px 24px 64px", fontFamily: THEME.fontSans, color: THEME.text }}>
      <style>{`
        @media print {
          @page { margin: 16mm; }
          .ws-sidebar, .ws-topbar, .ws-bottomnav, .no-print { display: none !important; }
          .ws-main-pad { padding: 0 !important; }
          .report-page { max-width: none !important; padding: 0 !important; }
          .report-card { break-inside: avoid; box-shadow: none !important; }
          .report-text { break-inside: auto; }
          body { background: #fff !important; }
        }
      `}</style>

      <ReportActions />

      <header style={{ margin: "22px 0 18px" }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: THEME.brand, fontFamily: THEME.fontHeading }}>HumanizeIt</div>
        <h1 style={{ fontSize: 26, fontWeight: 800, fontFamily: THEME.fontHeading, letterSpacing: "-0.02em", margin: "4px 0 6px" }}>Before/After Report</h1>
        <div style={{ fontSize: 14, color: THEME.textDim }}>{doc.title || "Untitled document"}</div>
        <dl style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: "6px 18px", margin: "14px 0 0", fontSize: 12 }}>
          <Meta label="Checked" value={fmtDate(doc.createdAt)} />
          <Meta label="Report created" value={fmtDate(generatedAt)} />
          <Meta label="Length" value={`${doc.wordCount.toLocaleString("en-US")} words${doc.sourceType && doc.sourceType !== "paste" ? ` (${doc.sourceType.toUpperCase()})` : ""}`} />
          <Meta label="Tone" value={doc.tone ? doc.tone[0].toUpperCase() + doc.tone.slice(1) : "Not rewritten"} />
        </dl>
      </header>

      <section className="report-card" style={card}>
        <h2 style={h2}>Scores</h2>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
          <ScoreBox title="Before" analysis={before} />
          {after ? <ScoreBox title="After rewrite" analysis={after} /> : (
            <div style={{ flex: "1 1 220px", fontSize: 13, color: THEME.textMuted, alignSelf: "center" }}>
              {doc.status === "processing" ? "The rewrite is still running. Reopen this report when it's done." : "This document wasn't rewritten, so there is only a \"before\" check."}
            </div>
          )}
        </div>
        <p style={{ fontSize: 12, color: THEME.textMuted, margin: "12px 0 0" }}>
          Human score: higher means fewer of the AI patterns and statistical signals we check for. It is an estimate, not proof.
        </p>
      </section>

      <section className="report-card" style={card}>
        <h2 style={h2}>Pattern breakdown</h2>
        {patternRows.length === 0 ? (
          <p style={{ fontSize: 13, color: THEME.textDim, margin: 0 }}>None of the patterns we check for were found.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ textAlign: "left", color: THEME.textMuted, fontSize: 12 }}>
                  <th style={th}>Pattern</th>
                  <th style={th}>Kind</th>
                  <th style={{ ...th, textAlign: "right" }}>Before</th>
                  {after && <th style={{ ...th, textAlign: "right" }}>After</th>}
                </tr>
              </thead>
              <tbody>
                {patternRows.map((r) => (
                  <tr key={r.id} style={{ borderTop: `1px solid ${THEME.border}` }}>
                    <td style={td}>{r.label}</td>
                    <td style={{ ...td, color: THEME.textDim }}>{CATEGORY_LABELS[r.category] ?? r.category}</td>
                    <td className="tnum" style={{ ...td, textAlign: "right" }}>{r.before}</td>
                    {after && <td className="tnum" style={{ ...td, textAlign: "right", color: r.after < r.before ? THEME.human : r.after > r.before ? THEME.ai : THEME.text }}>{r.after}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <dl style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: "6px 18px", margin: "14px 0 0", fontSize: 12 }}>
          <Meta label="Average sentence length" value={pair(before.stats.avgSentenceLength, after?.stats.avgSentenceLength, " words")} />
          <Meta label="Sentence variety (burstiness)" value={pair(before.stats.burstiness, after?.stats.burstiness)} />
          <Meta label="Readability (Flesch)" value={pair(before.stats.fleschReadingEase, after?.stats.fleschReadingEase)} />
        </dl>
      </section>

      <section className="report-card" style={{ ...card, background: THEME.warnDim, borderColor: `${THEME.warn}55` }}>
        <h2 style={h2}>What this report is, and what it isn&apos;t</h2>
        <p style={note}>
          It shows what HumanizeIt&apos;s own pattern check found in this text on the dates above. It is not proof of who wrote the text, and it doesn&apos;t predict what Turnitin, GPTZero or any other detector will say: they all work differently and change often.
        </p>
        <p style={{ ...note, marginBottom: 0 }}>
          If you ever need to show that writing is yours, your best evidence is your drafts, notes and the version history in Google Docs or Word.
        </p>
      </section>

      <section className="report-card report-text" style={card}>
        <h2 style={h2}>Original text</h2>
        <div style={textBlock}>{doc.originalText}</div>
      </section>
      {doc.rewrittenText && (
        <section className="report-card report-text" style={card}>
          <h2 style={h2}>Rewritten text</h2>
          <div style={textBlock}>{doc.rewrittenText}</div>
        </section>
      )}

      {plan.id === "PRO" && (
        <section className="report-card no-print" style={card}>
          <h2 style={h2}>Want a second pair of eyes on this one?</h2>
          <ServiceRequestCard kind="founder_review" documentId={doc.id} />
        </section>
      )}
    </div>
  );
}

function pair(before: number, after: number | undefined, unit = ""): string {
  const f = (n: number) => (Number.isFinite(n) ? (Math.round(n * 10) / 10).toString() : "–");
  return after === undefined ? `${f(before)}${unit}` : `${f(before)} → ${f(after)}${unit}`;
}

function ScoreBox({ title, analysis }: { title: string; analysis: AnalysisResult }) {
  const h = humanScore(analysis.score);
  const color = humanScoreColor(h);
  const found = analysis.patterns.length;
  return (
    <div style={{ flex: "1 1 220px", border: `1px solid ${THEME.border}`, borderRadius: THEME.radius, padding: "14px 16px", background: THEME.surface1 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: THEME.textMuted }}>{title}</div>
      <div className="tnum" style={{ fontSize: 30, fontWeight: 800, color, fontFamily: THEME.fontHeading, lineHeight: 1.2 }}>
        {h}<span style={{ fontSize: 14, fontWeight: 500, color: THEME.textMuted }}>/100 human</span>
      </div>
      <div style={{ fontSize: 13, color: THEME.textDim }}>{`${humanScoreLabel(h)} · ${found} ${found === 1 ? "pattern" : "patterns"} found`}</div>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt style={{ color: THEME.textMuted }}>{label}</dt>
      <dd className="tnum" style={{ margin: 0, color: THEME.text, fontWeight: 600 }}>{value}</dd>
    </div>
  );
}

function LockedReport() {
  return (
    <div style={{ maxWidth: 560, margin: "0 auto", padding: "64px 24px", fontFamily: THEME.fontSans, textAlign: "center" }}>
      <span style={{ display: "inline-flex", width: 44, height: 44, borderRadius: 12, background: THEME.brandDim, alignItems: "center", justifyContent: "center" }}>
        <Lock size={20} color={THEME.brandHi} aria-hidden="true" />
      </span>
      <h1 style={{ fontSize: 22, fontWeight: 800, color: THEME.text, fontFamily: THEME.fontHeading, margin: "14px 0 6px" }}>Before/After Reports are part of Pro</h1>
      <p style={{ fontSize: 14, color: THEME.textDim, lineHeight: 1.6, margin: "0 0 18px" }}>
        A dated, printable record of the patterns found in a document before and after its rewrite, for any document in your history.
      </p>
      <Link href="/dashboard/settings" style={{ display: "inline-block", background: THEME.gradient, color: "#fff", borderRadius: 9, padding: "10px 18px", fontSize: 13, fontWeight: 700, textDecoration: "none" }}>
        See plans
      </Link>
    </div>
  );
}

const card: React.CSSProperties = { background: THEME.surface2, border: `1px solid ${THEME.border}`, borderRadius: THEME.radiusLg, padding: 18, marginBottom: 14 };
const h2: React.CSSProperties = { fontSize: 15, fontWeight: 700, fontFamily: THEME.fontHeading, margin: "0 0 12px", color: THEME.text };
const th: React.CSSProperties = { padding: "6px 8px", fontWeight: 600 };
const td: React.CSSProperties = { padding: "7px 8px" };
const note: React.CSSProperties = { fontSize: 13, color: THEME.text, lineHeight: 1.65, margin: "0 0 8px" };
const textBlock: React.CSSProperties = { fontSize: 14, lineHeight: 1.75, whiteSpace: "pre-wrap", color: THEME.text };
