"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Wand2, Copy, Download, Upload, Check, RotateCcw, Sparkles, ArrowRight,
  Pencil, MoreHorizontal, Globe, ScanSearch, History as HistoryIcon,
} from "lucide-react";
import { analyzeText, type AnalysisResult } from "@/lib/algorithms/analyzeText";
import { PATTERN_COUNT } from "@/lib/algorithms/patterns";
import type { ToneOption, IntensityLevel } from "@/lib/algorithms/humanizeText";
import { UploadZone } from "@/components/ui/upload-zone";
import { highlightChanges, sentenceDiff } from "@/lib/sentence-diff";
import { AnalysisPanel } from "@/components/workspace/analysis-panel";
import { HistoryDrawer } from "@/components/workspace/history-drawer";
import { THEME, glow, humanScore, humanScoreColor, humanScoreLabel } from "@/lib/theme";

type Lang = "English" | "French" | "Spanish" | "Arabic" | "German" | "Italian";
const TONES: ToneOption[] = ["standard", "formal", "casual", "academic", "professional"];
const INTENSITIES: IntensityLevel[] = ["light", "medium", "heavy"];
const LANGS: Lang[] = ["English", "French", "Spanish", "Arabic", "German", "Italian"];
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

type View = "humanized" | "original" | "diff";
type Screen = "edit" | "analyzing" | "analysis" | "result";
const ANALYZE_MS = 1500;

export function DocumentEditor() {
  const [plan, setPlan] = useState("FREE");
  const [text, setText] = useState("");
  const [original, setOriginal] = useState<string | null>(null);
  const [humanized, setHumanized] = useState<string | null>(null);
  const [screen, setScreen] = useState<Screen>("edit");
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [view, setView] = useState<View>("humanized");
  const [busy, setBusy] = useState(false);
  const [tone, setTone] = useState<ToneOption>("standard");
  const [intensity, setIntensity] = useState<IntensityLevel>("medium");
  const [language, setLanguage] = useState<Lang>("English");
  const [menu, setMenu] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [quotaHit, setQuotaHit] = useState(false);
  const [copied, setCopied] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const analyzeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { fetch("/api/user-plan").then((r) => r.json()).then((d) => setPlan(d.plan ?? "FREE")).catch(() => {}); }, []);
  useEffect(() => { if (screen === "edit") taRef.current?.focus(); }, [screen]);
  useEffect(() => () => { if (analyzeTimer.current) clearTimeout(analyzeTimer.current); }, []);

  const words = text.trim() ? text.trim().split(/\s+/).filter(Boolean).length : 0;
  const beforeScore = useMemo(() => (text.trim().length > 30 ? analyzeText(text).score : null), [text]);
  const afterScore = useMemo(() => (humanized ? analyzeText(humanized).score : null), [humanized]);
  const canRun = words >= 5 && !busy;
  const canDetect = words >= 15 && !busy;

  async function checkout() {
    try {
      const res = await fetch("/api/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ plan: "PRO" }) });
      const d = (await res.json()) as { url?: string };
      if (d.url) window.location.href = d.url;
    } catch { /* ignore */ }
  }

  // The instant engine is synchronous; we stage the reveal over ~1.5s so the
  // detection reads as deliberate work (scan animation), then show the panel.
  function detectAI() {
    if (!canDetect) return;
    setMenu(false);
    setAnalysis(analyzeText(text));
    setScreen("analyzing");
    if (analyzeTimer.current) clearTimeout(analyzeTimer.current);
    analyzeTimer.current = setTimeout(() => setScreen("analysis"), ANALYZE_MS);
  }

  async function run() {
    if (!canRun) return;
    setBusy(true); setQuotaHit(false); setMenu(false);
    try {
      const aRes = await fetch("/api/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) });
      if (!aRes.ok) return fail(aRes.status, await aRes.json().catch(() => null));
      const aData = (await aRes.json()) as { documentId: string | null };
      if (!aData.documentId) { toast.error("Could not start — please try again."); return; }
      const hRes = await fetch("/api/humanize", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ documentId: aData.documentId, tone, intensity, language: language !== "English" ? language : undefined }) });
      if (!hRes.ok) return fail(hRes.status, await hRes.json().catch(() => null));
      const hData = (await hRes.json()) as { humanizedText?: string };
      if (!hData.humanizedText) { toast.error("The rewrite returned no text. Your original is unchanged."); return; }
      setOriginal(text); setHumanized(hData.humanizedText); setScreen("result"); setView("humanized");
      toast.success("Humanized ✓");
    } catch { toast.error("Something went wrong. Please try again."); } finally { setBusy(false); }
  }
  function fail(status: number, body: { error?: { code?: string; message?: string } } | null) {
    if (status === 402 || body?.error?.code === "QUOTA_EXCEEDED") { setQuotaHit(true); return; }
    toast.error(body?.error?.message ?? "Something went wrong.");
  }

  function backToEdit() { if (analyzeTimer.current) clearTimeout(analyzeTimer.current); setScreen("edit"); }
  function edit() { if (humanized) setText(humanized); setScreen("edit"); }
  function reset() { setText(""); setOriginal(null); setHumanized(null); setAnalysis(null); setScreen("edit"); setQuotaHit(false); }
  function loadFromHistory(t: string) { setText(t); setOriginal(null); setHumanized(null); setAnalysis(null); setScreen("edit"); }
  function copy() { navigator.clipboard?.writeText(humanized ?? text); setCopied(true); toast.success("Copied"); }
  function download() {
    const blob = new Blob([humanized ?? text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "humanized.txt"; a.click(); URL.revokeObjectURL(url);
  }

  const score = screen === "result" ? afterScore : beforeScore;

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100dvh" }}>
      {/* Sticky toolbar */}
      <div style={{ position: "sticky", top: 0, zIndex: 20, background: "rgba(255,255,255,0.85)", backdropFilter: "blur(14px) saturate(180%)", borderBottom: `1px solid ${THEME.border}` }}>
        <div style={{ maxWidth: 980, margin: "0 auto", padding: "10px 20px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <button onClick={run} disabled={!canRun}
            style={{ display: "inline-flex", alignItems: "center", gap: 8, background: canRun ? THEME.gradient : THEME.surface3, color: canRun ? "#fff" : THEME.textMuted, border: "none", borderRadius: 10, padding: "10px 20px", fontSize: 14, fontWeight: 700, cursor: canRun ? "pointer" : "not-allowed", boxShadow: canRun ? glow(THEME.brand, 0.3) : "none", fontFamily: THEME.fontSans }}>
            <Wand2 size={16} aria-hidden="true" /> {busy ? "Humanizing…" : screen === "result" ? "Re-humanize" : "Humanize"}
          </button>

          {screen !== "result" && (
            <button onClick={detectAI} disabled={!canDetect} title={words < 15 ? "Write at least 15 words to detect AI" : undefined}
              style={{ display: "inline-flex", alignItems: "center", gap: 7, background: THEME.surface2, color: canDetect ? THEME.text : THEME.textMuted, border: `1px solid ${THEME.border}`, borderRadius: 10, padding: "10px 16px", fontSize: 14, fontWeight: 600, cursor: canDetect ? "pointer" : "not-allowed", fontFamily: THEME.fontSans }}>
              <ScanSearch size={16} aria-hidden="true" /> Detect AI
            </button>
          )}

          <Pick label="Tone" value={tone} options={TONES} onChange={(v) => setTone(v as ToneOption)} />
          <Pick label="Strength" value={intensity} options={INTENSITIES} onChange={(v) => setIntensity(v as IntensityLevel)} />

          <div style={{ flex: 1 }} />

          {screen === "result" && (
            <div style={{ display: "inline-flex", background: THEME.surface3, borderRadius: 9, padding: 3, gap: 2 }}>
              {(["original", "humanized", "diff"] as View[]).map((v) => (
                <button key={v} onClick={() => setView(v)} style={{ border: "none", cursor: "pointer", borderRadius: 7, padding: "5px 11px", fontSize: 12, fontWeight: view === v ? 700 : 500, background: view === v ? THEME.surface2 : "transparent", color: view === v ? THEME.text : THEME.textDim, fontFamily: THEME.fontSans, textTransform: "capitalize" }}>{v}</button>
              ))}
            </div>
          )}

          {score !== null && <ScorePill score={score} />}

          {screen === "result" && <>
            <IconBtn onClick={copy} title="Copy">{copied ? <Check size={15} aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />}</IconBtn>
            <IconBtn onClick={download} title="Download"><Download size={15} aria-hidden="true" /></IconBtn>
            <button onClick={edit} style={ghostBtn}><Pencil size={14} aria-hidden="true" /> Edit</button>
          </>}

          <IconBtn onClick={() => setHistoryOpen(true)} title="History"><HistoryIcon size={16} aria-hidden="true" /></IconBtn>

          {/* Overflow menu */}
          <div style={{ position: "relative" }}>
            <IconBtn onClick={() => setMenu((m) => !m)} title="More"><MoreHorizontal size={16} aria-hidden="true" /></IconBtn>
            {menu && (
              <>
                <div onClick={() => setMenu(false)} style={{ position: "fixed", inset: 0, zIndex: 30 }} />
                <div style={{ position: "absolute", right: 0, top: 40, zIndex: 31, width: 230, background: THEME.surface2, border: `1px solid ${THEME.border}`, borderRadius: 12, boxShadow: "0 12px 32px rgba(0,0,0,0.12)", padding: 8, display: "flex", flexDirection: "column", gap: 4 }}>
                  <button onClick={() => { setUploadOpen(true); setMenu(false); }} style={menuItem}><Upload size={15} aria-hidden="true" /> Upload a file</button>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px" }}>
                    <Globe size={15} color={THEME.textMuted} aria-hidden="true" />
                    <select value={language} onChange={(e) => setLanguage(e.target.value as Lang)} aria-label="Language" style={{ flex: 1, fontSize: 13, color: THEME.text, background: THEME.surface1, border: `1px solid ${THEME.border}`, borderRadius: 7, padding: "6px 8px", fontFamily: THEME.fontSans }}>
                      {LANGS.map((l) => <option key={l} value={l}>{l}</option>)}
                    </select>
                  </div>
                  {(text || humanized) && <button onClick={() => { reset(); setMenu(false); }} style={menuItem}><RotateCcw size={15} aria-hidden="true" /> New document</button>}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {quotaHit && (
        <div style={{ maxWidth: 980, margin: "14px auto 0", width: "100%", padding: "0 20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, background: THEME.brandDim, border: `1px solid ${THEME.brand}44`, borderRadius: THEME.radius, padding: "12px 16px", flexWrap: "wrap" }}>
            <Sparkles size={18} color={THEME.brandHi} aria-hidden="true" />
            <span style={{ fontSize: 14, color: THEME.text, flex: 1, minWidth: 200 }}>You&apos;ve hit your plan&apos;s limit. Upgrade to Pro for 50,000 words/month and unlimited rewrites.</span>
            <button onClick={checkout} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: THEME.gradient, color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Upgrade <ArrowRight size={14} aria-hidden="true" /></button>
          </div>
        </div>
      )}

      {/* Canvas */}
      <div style={{ flex: 1, width: "100%", maxWidth: 820, margin: "0 auto", padding: "28px 24px 80px" }}>
        {uploadOpen && (
          <div style={{ marginBottom: 18, background: THEME.surface2, border: `1px solid ${THEME.border}`, borderRadius: THEME.radiusLg, padding: 16 }}>
            <UploadZone plan={plan} uploadEnabled={plan !== "FREE"} onExtracted={(r) => { setText(r.text); setScreen("edit"); setHumanized(null); setOriginal(null); setAnalysis(null); setUploadOpen(false); toast.success(`Loaded ${r.fileName}`); }} />
            <button onClick={() => setUploadOpen(false)} style={{ marginTop: 10, background: "transparent", border: "none", color: THEME.textDim, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
          </div>
        )}

        {screen === "edit" && (
          <textarea ref={taRef} value={text} onChange={(e) => setText(e.target.value)}
            placeholder="Write or paste your text here, then Detect AI or Humanize…"
            aria-label="Document"
            style={{ width: "100%", minHeight: "62vh", resize: "none", border: "none", outline: "none", background: "transparent", fontSize: 17, lineHeight: 1.85, color: THEME.text, fontFamily: THEME.fontSans }} />
        )}

        {screen === "analyzing" && (
          <div style={{ position: "relative", overflow: "hidden", borderRadius: THEME.radiusLg }}>
            <div aria-hidden="true" style={{ fontSize: 17, lineHeight: 1.85, color: THEME.text, whiteSpace: "pre-wrap", minHeight: "48vh", opacity: 0.4, userSelect: "none" }}>{text}</div>
            <div className="detect-scan-beam" />
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 12, background: THEME.surface2, border: `1px solid ${THEME.border}`, borderRadius: 999, padding: "12px 20px", boxShadow: glow(THEME.brand, 0.18), fontSize: 14, fontWeight: 600, color: THEME.text }}>
              <ScanSearch size={18} color={THEME.brand} aria-hidden="true" />
                Analyzing… checking {PATTERN_COUNT} signals
                <span style={{ display: "inline-flex", gap: 3 }}>
                  <Dot delay="0s" /><Dot delay="0.2s" /><Dot delay="0.4s" />
                </span>
              </div>
            </div>
          </div>
        )}

        {screen === "analysis" && analysis && (
          <AnalysisPanel text={text} result={analysis} busy={busy} onHumanize={run} onBack={backToEdit} />
        )}

        {screen === "result" && (
          <div style={{ fontSize: 17, lineHeight: 1.85, color: THEME.text, whiteSpace: "pre-wrap", minHeight: "62vh" }}>
            {view === "original" && original}
            {view === "humanized" && highlightChanges(original ?? "", humanized ?? "").map((seg, i) => (
              <span key={i} style={seg.changed ? { background: THEME.brandDim, borderRadius: 4, padding: "1px 2px", boxShadow: `inset 0 -2px 0 ${THEME.brand}55` } : undefined}>{seg.text}{" "}</span>
            ))}
            {view === "diff" && sentenceDiff(original ?? "", humanized ?? "").map((p, i) => (
              <span key={i} style={
                p.type === "del" ? { background: THEME.aiDim, color: THEME.ai, textDecoration: "line-through", borderRadius: 4, padding: "1px 2px" }
                : p.type === "add" ? { background: THEME.humanDim, color: THEME.human, borderRadius: 4, padding: "1px 2px" }
                : undefined
              }>{p.text}{" "}</span>
            ))}
          </div>
        )}
      </div>

      {/* Footer status */}
      <div style={{ position: "sticky", bottom: 0, background: "rgba(255,255,255,0.85)", backdropFilter: "blur(10px)", borderTop: `1px solid ${THEME.border}` }} className="ws-editor-footer">
        <div style={{ maxWidth: 980, margin: "0 auto", padding: "8px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12, color: THEME.textMuted }}>
          <span>{words.toLocaleString()} words</span>
          <span>{footerStatus(screen)}</span>
        </div>
      </div>

      <HistoryDrawer open={historyOpen} onClose={() => setHistoryOpen(false)} onOpen={loadFromHistory} />
    </div>
  );
}

function footerStatus(screen: Screen): string {
  switch (screen) {
    case "result": return "Highlighted sentences were rewritten";
    case "analyzing": return "Analyzing…";
    case "analysis": return "Highlighted spans are the AI tells we located";
    default: return "Scored instantly as you type · never stored";
  }
}

function Dot({ delay }: { delay: string }) {
  return <span className="pulse-dot" style={{ width: 5, height: 5, borderRadius: 999, background: THEME.brand, animationDelay: delay }} />;
}

function Pick({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: THEME.textMuted }}>
      <span className="ws-pick-label">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} aria-label={label}
        style={{ fontSize: 13, color: THEME.text, background: THEME.surface2, border: `1px solid ${THEME.border}`, borderRadius: 8, padding: "7px 10px", fontFamily: THEME.fontSans, cursor: "pointer" }}>
        {options.map((o) => <option key={o} value={o}>{cap(o)}</option>)}
      </select>
    </label>
  );
}

function ScorePill({ score }: { score: number }) {
  const h = humanScore(score);
  const color = humanScoreColor(h);
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700, color, background: THEME.surface2, border: `1px solid ${THEME.border}`, borderRadius: 999, padding: "5px 11px" }} title={humanScoreLabel(h)}>
      <span style={{ width: 7, height: 7, borderRadius: 999, background: color }} />{h}<span style={{ color: THEME.textMuted, fontWeight: 500 }}>/100</span>
    </span>
  );
}

const ghostBtn: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 6, background: THEME.surface2, color: THEME.text, border: `1px solid ${THEME.border}`, borderRadius: 8, padding: "8px 12px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: THEME.fontSans };
const menuItem: React.CSSProperties = { display: "flex", alignItems: "center", gap: 9, background: "transparent", border: "none", borderRadius: 8, padding: "9px 10px", fontSize: 13, fontWeight: 500, color: THEME.text, cursor: "pointer", textAlign: "left", fontFamily: THEME.fontSans };

function IconBtn({ onClick, title, children }: { onClick: () => void; title: string; children: React.ReactNode }) {
  return (
    <button onClick={onClick} title={title} aria-label={title}
      style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 36, height: 36, background: THEME.surface2, color: THEME.textDim, border: `1px solid ${THEME.border}`, borderRadius: 9, cursor: "pointer" }}>
      {children}
    </button>
  );
}
