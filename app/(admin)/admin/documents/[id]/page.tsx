"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft, FileText, User as UserIcon, Activity, Wand2, Gauge, Clock,
  Cpu, AlertTriangle, Building2, Copy,
} from "lucide-react";
import { THEME, humanScore, humanScoreColor, humanScoreLabel } from "@/lib/theme";
import { highlightChanges, sentenceDiff } from "@/lib/sentence-diff";

interface PatternHit { id: string; label: string; hits: number; severity: string; weight: number; category: string }
interface Analysis {
  score?: number;
  confidenceBand?: string;
  patterns?: PatternHit[];
  stats?: { burstiness: number; typeTokenRatio: number; avgSentenceLength: number; fleschReadingEase: number };
}
interface Detail {
  document: {
    id: string; title: string | null;
    originalText: string; rewrittenText: string | null;
    analysisResult: Analysis | null;
    overallScore: number; humanizedScore: number | null;
    wordCount: number; tone: string | null; rewriteModel: string | null;
    status: string; stage: string | null; runId: string | null;
    sourceType: string | null; pageCount: number | null; errorMessage: string | null;
    createdAt: string;
  };
  author: {
    id: string; email: string; name: string | null;
    plan: "FREE" | "PRO" | "TEAM"; paid: boolean;
    wordsUsed: number; rewriteCount: number; documentCount: number; joinedAt: string;
  };
  organization: { id: string; name: string; slug: string } | null;
}

const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—");
const SEVERITY_COLOR: Record<string, string> = { critical: THEME.ai, high: THEME.ai, medium: THEME.warn, low: THEME.accent };
type View = "original" | "humanized" | "diff";

export default function AdminDocumentDetail() {
  const { id } = useParams<{ id: string }>();
  const [d, setD] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>("humanized");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/documents/${id}`);
      if (!res.ok) { toast.error("Failed to load document."); return; }
      setD(await res.json());
    } catch { toast.error("Network error."); } finally { setLoading(false); }
  }, [id]);
  useEffect(() => { void load(); }, [load]);

  const triggered = useMemo(
    () => (d?.document.analysisResult?.patterns ?? []).filter((p) => p.hits > 0).sort((a, b) => b.weight * b.hits - a.weight * a.hits),
    [d]
  );

  if (loading) return <div style={{ padding: 60, textAlign: "center", color: THEME.textMuted, fontFamily: THEME.fontSans }}>Loading…</div>;
  if (!d) return <div style={{ padding: 60, textAlign: "center", color: THEME.textMuted, fontFamily: THEME.fontSans }}>Document not found.</div>;

  const doc = d.document;
  const a = d.author;
  const humanized = doc.rewrittenText;
  const beforeH = humanScore(doc.overallScore);
  const afterH = doc.humanizedScore !== null ? humanScore(doc.humanizedScore) : null;
  const delta = afterH !== null ? afterH - beforeH : null;
  const st = doc.status === "complete" ? { c: THEME.human, l: "Complete" } : doc.status === "error" ? { c: THEME.ai, l: "Error" } : { c: THEME.warn, l: "Processing" };
  const stats = doc.analysisResult?.stats;
  const copy = (t: string) => { navigator.clipboard?.writeText(t); toast.success("Copied"); };

  return (
    <div style={{ maxWidth: 1040, margin: "0 auto", padding: "28px 28px 64px", fontFamily: THEME.fontSans }}>
      <Link href="/admin/documents" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: THEME.textDim, textDecoration: "none", marginBottom: 18, fontWeight: 600 }}><ArrowLeft size={14} aria-hidden="true" /> All documents</Link>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 22, flexWrap: "wrap" }}>
        <div style={{ width: 52, height: 52, borderRadius: 14, background: THEME.brandDim, color: THEME.brandHi, display: "grid", placeItems: "center", flexShrink: 0 }}><FileText size={24} aria-hidden="true" /></div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: THEME.text, fontFamily: THEME.fontHeading, letterSpacing: "-0.02em", margin: 0, overflow: "hidden", textOverflow: "ellipsis" }}>{doc.title || "Untitled document"}</h1>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 700, color: st.c, background: THEME.surface3, borderRadius: 999, padding: "3px 9px" }}><span style={{ width: 6, height: 6, borderRadius: 999, background: st.c }} />{st.l}</span>
          </div>
          <div style={{ fontSize: 13, color: THEME.textDim, marginTop: 3 }}>
            {fmt(doc.createdAt)}{doc.sourceType ? ` · from ${doc.sourceType}` : ""}{doc.pageCount ? ` · ${doc.pageCount} pages` : ""} · <span style={{ fontFamily: THEME.fontMono, fontSize: 11 }}>{doc.id}</span>
          </div>
        </div>
      </div>

      {/* KPI cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 22 }}>
        <Card icon={Gauge} label="Detection (human score)">
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <Score h={beforeH} /><span style={{ color: THEME.textMuted }}>→</span>{afterH !== null ? <Score h={afterH} /> : <span style={{ color: THEME.textMuted, fontSize: 20 }}>—</span>}
          </div>
          <Sub>{delta !== null ? `${delta >= 0 ? "+" : ""}${delta} improvement · ${humanScoreLabel(afterH ?? beforeH)}` : humanScoreLabel(beforeH)}</Sub>
        </Card>
        <Card icon={Wand2} label="Humanized"><Big>{humanized ? "Yes" : "No"}</Big><Sub>{humanized ? `tone: ${doc.tone ?? "—"}` : "not yet rewritten"}</Sub></Card>
        <Card icon={FileText} label="Words"><Big>{doc.wordCount.toLocaleString()}</Big><Sub>{doc.analysisResult?.confidenceBand ?? "—"}</Sub></Card>
        <Card icon={Cpu} label="Model"><Big style={{ fontSize: 15 }}>{doc.rewriteModel ?? "—"}</Big><Sub>rewrite engine</Sub></Card>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 16 }} className="grid-cols-1 md:grid-cols-[1.4fr_1fr]">
        {/* LEFT: texts + breakdown */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Texts */}
          <Panel title="Texts" icon={FileText} right={
            <div style={{ display: "inline-flex", background: THEME.surface3, borderRadius: 9, padding: 3, gap: 2 }}>
              {(["original", "humanized", "diff"] as View[]).map((v) => (
                <button key={v} onClick={() => setView(v)} disabled={v !== "original" && !humanized}
                  style={{ border: "none", cursor: v !== "original" && !humanized ? "not-allowed" : "pointer", borderRadius: 7, padding: "4px 10px", fontSize: 12, fontWeight: view === v ? 700 : 500, background: view === v ? THEME.surface2 : "transparent", color: v !== "original" && !humanized ? THEME.textMuted : view === v ? THEME.text : THEME.textDim, textTransform: "capitalize", fontFamily: THEME.fontSans }}>{v}</button>
              ))}
            </div>
          }>
            <div style={{ position: "relative" }}>
              <button onClick={() => copy(view === "original" ? doc.originalText : humanized ?? doc.originalText)} title="Copy" style={{ position: "absolute", top: 0, right: 0, background: THEME.surface1, border: `1px solid ${THEME.border}`, borderRadius: 8, padding: "5px 8px", cursor: "pointer", color: THEME.textDim, display: "inline-flex" }}><Copy size={13} aria-hidden="true" /></button>
              <div style={{ fontSize: 14, lineHeight: 1.75, color: THEME.text, whiteSpace: "pre-wrap", background: THEME.surface1, border: `1px solid ${THEME.border}`, borderRadius: THEME.radius, padding: 16, maxHeight: "52vh", overflowY: "auto", marginTop: 4 }}>
                {view === "original" && doc.originalText}
                {view === "humanized" && humanized && highlightChanges(doc.originalText, humanized).map((seg, i) => (
                  <span key={i} style={seg.changed ? { background: THEME.brandDim, borderRadius: 4, padding: "1px 2px", boxShadow: `inset 0 -2px 0 ${THEME.brand}55` } : undefined}>{seg.text}{" "}</span>
                ))}
                {view === "diff" && humanized && sentenceDiff(doc.originalText, humanized).map((p, i) => (
                  <span key={i} style={p.type === "del" ? { background: THEME.aiDim, color: THEME.ai, textDecoration: "line-through", borderRadius: 4, padding: "1px 2px" } : p.type === "add" ? { background: THEME.humanDim, color: THEME.human, borderRadius: 4, padding: "1px 2px" } : undefined}>{p.text}{" "}</span>
                ))}
              </div>
            </div>
          </Panel>

          {/* Detection breakdown */}
          <Panel title="Detection breakdown (original text)" icon={Activity}>
            {stats && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 10, marginBottom: 14 }}>
                <Stat label="Burstiness" value={stats.burstiness?.toFixed(2)} />
                <Stat label="Type-Token" value={stats.typeTokenRatio?.toFixed(2)} />
                <Stat label="Avg sentence" value={`${stats.avgSentenceLength?.toFixed(0)}w`} />
                <Stat label="Flesch" value={stats.fleschReadingEase?.toFixed(0)} />
              </div>
            )}
            {triggered.length === 0 ? <Empty>No AI patterns flagged.</Empty> : (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {triggered.map((p) => (
                  <span key={p.id} style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12, color: THEME.textDim, background: THEME.surface1, border: `1px solid ${THEME.border}`, padding: "5px 10px", borderRadius: 999 }}>
                    <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: "50%", background: SEVERITY_COLOR[p.severity] ?? THEME.brandHi }} />
                    {p.label}<span style={{ color: THEME.textMuted }}>×{p.hits}</span>
                  </span>
                ))}
              </div>
            )}
          </Panel>
        </div>

        {/* RIGHT: author + pipeline */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Panel title="Author" icon={UserIcon}>
            <Link href={`/admin/users/${a.id}`} style={{ display: "block", fontSize: 15, fontWeight: 700, color: THEME.brandHi, textDecoration: "none" }}>{a.name || a.email.split("@")[0]}</Link>
            <div style={{ fontSize: 12, color: THEME.textMuted, marginBottom: 10 }}>{a.email}</div>
            <Row><span style={{ flex: 1 }}>Plan</span><span style={{ color: THEME.text, fontWeight: 600 }}>{a.plan}{a.paid ? " · paid" : a.plan !== "FREE" ? " · comped" : ""}</span></Row>
            <Row><span style={{ flex: 1 }}>Lifetime humanizations</span><span style={{ color: THEME.text, fontWeight: 600 }}>{a.rewriteCount.toLocaleString()}</span></Row>
            <Row><span style={{ flex: 1 }}>Documents</span><span style={{ color: THEME.text, fontWeight: 600 }}>{a.documentCount.toLocaleString()}</span></Row>
            <Row><span style={{ flex: 1 }}>Words used</span><span style={{ color: THEME.text, fontWeight: 600 }}>{a.wordsUsed.toLocaleString()}</span></Row>
            <Row><span style={{ flex: 1 }}>Joined</span><span style={{ color: THEME.textDim }}>{fmt(a.joinedAt)}</span></Row>
          </Panel>

          <Panel title="Pipeline & metadata" icon={Clock}>
            <Row><span style={{ flex: 1 }}>Status</span><span style={{ color: st.c, fontWeight: 700 }}>{st.l}</span></Row>
            {doc.stage && <Row><span style={{ flex: 1 }}>Stage</span><span style={{ color: THEME.text }}>{doc.stage}</span></Row>}
            <Row><span style={{ flex: 1 }}>Source</span><span style={{ color: THEME.text }}>{doc.sourceType ?? "paste"}{doc.pageCount ? ` · ${doc.pageCount}p` : ""}</span></Row>
            <Row><span style={{ flex: 1 }}>Tone</span><span style={{ color: THEME.text, textTransform: "capitalize" }}>{doc.tone ?? "—"}</span></Row>
            <Row><span style={{ flex: 1 }}>Created</span><span style={{ color: THEME.textDim }}>{fmt(doc.createdAt)}</span></Row>
            {doc.runId && <Row><span style={{ flex: 1 }}>Run ID</span><span style={{ color: THEME.textMuted, fontFamily: THEME.fontMono, fontSize: 11, overflow: "hidden", textOverflow: "ellipsis", maxWidth: 130 }}>{doc.runId}</span></Row>}
            {d.organization && <Row><span style={{ flex: 1 }}><Building2 size={12} aria-hidden="true" style={{ verticalAlign: "middle", marginRight: 4 }} />Org</span><span style={{ color: THEME.text }}>{d.organization.name}</span></Row>}
          </Panel>

          {doc.errorMessage && (
            <div style={{ background: THEME.aiDim, border: `1px solid ${THEME.ai}44`, borderRadius: THEME.radiusLg, padding: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7, color: THEME.ai, fontWeight: 700, fontSize: 13, marginBottom: 6 }}><AlertTriangle size={14} aria-hidden="true" /> Error</div>
              <div style={{ fontSize: 13, color: THEME.textDim, lineHeight: 1.5 }}>{doc.errorMessage}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Card({ icon: Icon, label, children }: { icon: React.ComponentType<{ size?: number; color?: string }>; label: string; children: React.ReactNode }) {
  return <div style={{ background: THEME.surface2, border: `1px solid ${THEME.border}`, borderRadius: THEME.radiusLg, padding: 16 }}><div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 10 }}><Icon size={14} color={THEME.brand} /><span style={{ fontSize: 12, color: THEME.textDim, fontWeight: 600 }}>{label}</span></div>{children}</div>;
}
const Big = ({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) => <div style={{ fontSize: 22, fontWeight: 700, color: THEME.text, lineHeight: 1.1, ...style }}>{children}</div>;
const Sub = ({ children }: { children: React.ReactNode }) => <div style={{ fontSize: 11, color: THEME.textMuted, marginTop: 6 }}>{children}</div>;
function Score({ h }: { h: number }) { const c = humanScoreColor(h); return <span style={{ fontSize: 22, fontWeight: 800, color: c }}>{h}</span>; }
function Stat({ label, value }: { label: string; value?: string }) { return <div style={{ background: THEME.surface1, border: `1px solid ${THEME.border}`, borderRadius: THEME.radius, padding: "8px 10px" }}><div style={{ fontSize: 11, color: THEME.textMuted }}>{label}</div><div style={{ fontSize: 15, fontWeight: 700, color: THEME.text, fontVariantNumeric: "tabular-nums" }}>{value ?? "—"}</div></div>; }
function Panel({ title, icon: Icon, right, children }: { title: string; icon: React.ComponentType<{ size?: number; color?: string }>; right?: React.ReactNode; children: React.ReactNode }) {
  return <div style={{ background: THEME.surface2, border: `1px solid ${THEME.border}`, borderRadius: THEME.radiusLg, padding: 18 }}><div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}><Icon size={15} color={THEME.brand} /><h2 style={{ fontSize: 14, fontWeight: 700, color: THEME.text, fontFamily: THEME.fontHeading, margin: 0, flex: 1 }}>{title}</h2>{right}</div>{children}</div>;
}
const Row = ({ children }: { children: React.ReactNode }) => <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", fontSize: 13, color: THEME.textDim, borderTop: `1px solid ${THEME.border}` }}>{children}</div>;
const Empty = ({ children }: { children: React.ReactNode }) => <div style={{ fontSize: 13, color: THEME.textMuted, padding: "6px 0" }}>{children}</div>;
