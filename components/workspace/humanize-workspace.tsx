"use client";

import { useMemo, useState, useEffect } from "react";
import { toast } from "sonner";
import {
  Wand2, Copy, Download, RotateCcw, ChevronDown, FileText, ClipboardPaste,
  Upload, Check, Sparkles, ArrowRight,
} from "lucide-react";
import { analyzeText } from "@/lib/algorithms/analyzeText";
import type { ToneOption, IntensityLevel } from "@/lib/algorithms/humanizeText";
import { UploadZone } from "@/components/ui/upload-zone";
import { ScoreRing } from "@/components/ui/score-ring";
import { THEME, glow, humanScore, humanScoreColor, humanScoreLabel } from "@/lib/theme";

type LanguageOption = "English" | "French" | "Spanish" | "Arabic" | "German" | "Italian";

const TONES: { value: ToneOption; label: string }[] = [
  { value: "standard", label: "Standard" },
  { value: "formal", label: "Formal" },
  { value: "casual", label: "Casual" },
  { value: "academic", label: "Academic" },
  { value: "professional", label: "Professional" },
];
const INTENSITIES: { value: IntensityLevel; label: string }[] = [
  { value: "light", label: "Light" },
  { value: "medium", label: "Medium" },
  { value: "heavy", label: "Heavy" },
];
const LANGUAGES: LanguageOption[] = ["English", "French", "Spanish", "Arabic", "German", "Italian"];

function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[] }) {
  return (
    <div style={{ display: "inline-flex", background: THEME.surface3, borderRadius: 9, padding: 3, gap: 2, flexWrap: "wrap" }}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button key={o.value} onClick={() => onChange(o.value)}
            style={{ border: "none", cursor: "pointer", borderRadius: 7, padding: "6px 12px", fontSize: 13, fontWeight: active ? 600 : 500, fontFamily: THEME.fontSans, background: active ? THEME.surface2 : "transparent", color: active ? THEME.text : THEME.textDim, boxShadow: active ? `0 1px 2px ${THEME.border}` : "none" }}>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function ScoreChip({ score, label }: { score: number; label: string }) {
  const h = humanScore(score);
  const color = humanScoreColor(h);
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      <span style={{ fontSize: 11, color: THEME.textMuted, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</span>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700, color }}>
        <span style={{ width: 8, height: 8, borderRadius: 999, background: color }} />
        {h}<span style={{ color: THEME.textMuted, fontWeight: 500 }}>/100 · {humanScoreLabel(h)}</span>
      </span>
    </div>
  );
}

export function HumanizeWorkspace() {
  const [plan, setPlan] = useState<string>("FREE");
  const [mode, setMode] = useState<"paste" | "upload">("paste");
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [humanized, setHumanized] = useState<string | null>(null);
  const [afterScore, setAfterScore] = useState<number | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showInsights, setShowInsights] = useState(false);
  const [tone, setTone] = useState<ToneOption>("standard");
  const [intensity, setIntensity] = useState<IntensityLevel>("medium");
  const [language, setLanguage] = useState<LanguageOption>("English");
  const [quotaHit, setQuotaHit] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch("/api/user-plan").then((r) => r.json()).then((d) => setPlan(d.plan ?? "FREE")).catch(() => {});
  }, []);

  const words = text.trim() ? text.trim().split(/\s+/).filter(Boolean).length : 0;
  const before = useMemo(() => (text.trim().length > 30 ? analyzeText(text) : null), [text]);
  const triggered = before?.patterns.filter((p) => p.hits > 0).sort((a, b) => b.weight - a.weight) ?? [];
  const canRun = words >= 5 && !busy;

  async function checkout() {
    try {
      const res = await fetch("/api/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ plan: "PRO" }) });
      const d = (await res.json()) as { url?: string };
      if (d.url) window.location.href = d.url;
    } catch { /* ignore */ }
  }

  async function run() {
    if (!canRun) return;
    setBusy(true); setQuotaHit(false); setHumanized(null); setAfterScore(null); setCopied(false);
    try {
      // 1. Server analyze creates the document the humanizer needs (this is the
      //    metered step). Client-side scoring above is free/instant for preview.
      const aRes = await fetch("/api/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) });
      if (!aRes.ok) return handleError(aRes.status, await safeJson(aRes));
      const aData = (await aRes.json()) as { documentId: string | null };
      if (!aData.documentId) { toast.error("Could not start — please try again."); return; }

      // 2. Humanize.
      const hRes = await fetch("/api/humanize", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId: aData.documentId, tone, intensity, language: language !== "English" ? language : undefined }),
      });
      if (!hRes.ok) return handleError(hRes.status, await safeJson(hRes));
      const hData = (await hRes.json()) as { humanizedText?: string };
      if (!hData.humanizedText) { toast.error("The rewrite returned no text. Your original is unchanged."); return; }

      setHumanized(hData.humanizedText);
      setAfterScore(analyzeText(hData.humanizedText).score);
      toast.success("Humanized ✓");
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  function handleError(status: number, body: { error?: { code?: string; message?: string } } | null) {
    const msg = body?.error?.message ?? "Something went wrong.";
    if (status === 402 || body?.error?.code === "QUOTA_EXCEEDED") { setQuotaHit(true); return; }
    toast.error(msg);
  }

  function reset() {
    setText(""); setFileName(null); setHumanized(null); setAfterScore(null); setQuotaHit(false); setShowInsights(false);
  }
  function copy() {
    navigator.clipboard?.writeText(humanized ?? "");
    setCopied(true); toast.success("Copied");
  }
  function download() {
    if (!humanized) return;
    const blob = new Blob([humanized], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `humanized-${(fileName?.replace(/\.[^.]+$/, "") || "text")}.txt`; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div style={{ maxWidth: 1140, margin: "0 auto", padding: "28px 24px 64px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: THEME.text, fontFamily: THEME.fontHeading, letterSpacing: "-0.02em", margin: 0 }}>Humanize</h1>
          <p style={{ fontSize: 14, color: THEME.textDim, margin: "4px 0 0" }}>Paste or upload your text, then rewrite it to read naturally and pass AI detectors.</p>
        </div>
        {(text || humanized) && (
          <button onClick={reset} style={{ display: "inline-flex", alignItems: "center", gap: 7, background: THEME.surface2, border: `1px solid ${THEME.border}`, color: THEME.textDim, borderRadius: 9, padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: THEME.fontSans }}>
            <RotateCcw size={14} aria-hidden="true" /> New
          </button>
        )}
      </div>

      {quotaHit && (
        <div style={{ display: "flex", alignItems: "center", gap: 12, background: THEME.brandDim, border: `1px solid ${THEME.brand}44`, borderRadius: THEME.radius, padding: "14px 18px", marginBottom: 18, flexWrap: "wrap" }}>
          <Sparkles size={18} color={THEME.brandHi} aria-hidden="true" />
          <span style={{ fontSize: 14, color: THEME.text, flex: 1, minWidth: 200 }}>You&apos;ve hit your plan&apos;s limit. Upgrade to Pro for 50,000 words/month and unlimited rewrites.</span>
          <button onClick={checkout} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: THEME.gradient, color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Upgrade <ArrowRight size={14} aria-hidden="true" /></button>
        </div>
      )}

      {/* Two-panel workspace */}
      <div style={{ display: "grid", gap: 16 }} className="grid-cols-1 md:grid-cols-2">
        {/* INPUT */}
        <div style={{ background: THEME.surface2, border: `1px solid ${THEME.border}`, borderRadius: THEME.radiusLg, display: "flex", flexDirection: "column", minHeight: 360 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", borderBottom: `1px solid ${THEME.border}` }}>
            <div style={{ display: "inline-flex", background: THEME.surface3, borderRadius: 8, padding: 3, gap: 2 }}>
              <Tab active={mode === "paste"} onClick={() => setMode("paste")} icon={ClipboardPaste} label="Paste" />
              <Tab active={mode === "upload"} onClick={() => setMode("upload")} icon={Upload} label="Upload" />
            </div>
            <span style={{ fontSize: 12, color: THEME.textMuted }}>{words.toLocaleString()} words</span>
          </div>

          <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: 14 }}>
            {mode === "paste" ? (
              <textarea value={text} onChange={(e) => { setText(e.target.value); setFileName(null); }}
                placeholder="Paste your AI-generated text here…"
                aria-label="Text to humanize"
                style={{ flex: 1, width: "100%", minHeight: 220, resize: "vertical", border: "none", outline: "none", background: "transparent", fontSize: 15, lineHeight: 1.7, color: THEME.text, fontFamily: THEME.fontSans }} />
            ) : (
              <UploadZone plan={plan} uploadEnabled={plan !== "FREE"} onExtracted={(r) => { setText(r.text); setFileName(r.fileName); setMode("paste"); toast.success(`Loaded ${r.fileName}`); }} />
            )}
          </div>

          <div style={{ padding: "12px 14px", borderTop: `1px solid ${THEME.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
            {before ? <ScoreChip score={before.score} label="Before" /> : <span style={{ fontSize: 12, color: THEME.textMuted }}>{fileName ?? "We score your text instantly as you type"}</span>}
          </div>
        </div>

        {/* OUTPUT */}
        <div style={{ background: THEME.surface2, border: `1px solid ${THEME.border}`, borderRadius: THEME.radiusLg, display: "flex", flexDirection: "column", minHeight: 360 }}>
          <div style={{ padding: "12px 14px", borderBottom: `1px solid ${THEME.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: THEME.text, fontFamily: THEME.fontHeading }}>Humanized</span>
            {afterScore !== null && <ScoreChip score={afterScore} label="After" />}
          </div>
          <div style={{ flex: 1, padding: 14, display: "flex", flexDirection: "column" }}>
            {busy ? (
              <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, color: THEME.textDim }}>
                <div className="spin" style={{ width: 28, height: 28, borderRadius: 999, border: `3px solid ${THEME.surface3}`, borderTopColor: THEME.brand }} />
                <span style={{ fontSize: 14 }}>Humanizing your text…</span>
              </div>
            ) : humanized ? (
              <div style={{ flex: 1, fontSize: 15, lineHeight: 1.7, color: THEME.text, whiteSpace: "pre-wrap", overflowY: "auto" }}>{humanized}</div>
            ) : (
              <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, color: THEME.textMuted, textAlign: "center" }}>
                <FileText size={26} aria-hidden="true" />
                <span style={{ fontSize: 14 }}>Your humanized text will appear here.</span>
              </div>
            )}
          </div>
          {humanized && (
            <div style={{ padding: "12px 14px", borderTop: `1px solid ${THEME.border}`, display: "flex", gap: 10 }}>
              <button onClick={copy} style={btnGhost}>{copied ? <><Check size={14} aria-hidden="true" /> Copied</> : <><Copy size={14} aria-hidden="true" /> Copy</>}</button>
              <button onClick={download} style={btnGhost}><Download size={14} aria-hidden="true" /> Download</button>
            </div>
          )}
        </div>
      </div>

      {/* Action bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 18, gap: 14, flexWrap: "wrap" }}>
        <button onClick={() => setShowAdvanced((s) => !s)} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "transparent", border: "none", color: THEME.textDim, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: THEME.fontSans }}>
          Advanced options <ChevronDown size={15} style={{ transform: showAdvanced ? "rotate(180deg)" : "none", transition: "transform .2s" }} aria-hidden="true" />
        </button>
        <button onClick={run} disabled={!canRun}
          style={{ display: "inline-flex", alignItems: "center", gap: 8, background: canRun ? THEME.gradient : THEME.surface3, color: canRun ? "#fff" : THEME.textMuted, border: "none", borderRadius: 11, padding: "13px 30px", fontSize: 15, fontWeight: 700, cursor: canRun ? "pointer" : "not-allowed", boxShadow: canRun ? glow(THEME.brand, 0.32) : "none", fontFamily: THEME.fontSans }}>
          <Wand2 size={17} aria-hidden="true" /> {busy ? "Humanizing…" : humanized ? "Humanize again" : "Humanize"}
        </button>
      </div>

      {/* Advanced */}
      {showAdvanced && (
        <div style={{ marginTop: 14, background: THEME.surface1, border: `1px solid ${THEME.border}`, borderRadius: THEME.radiusLg, padding: 18, display: "flex", flexDirection: "column", gap: 16 }}>
          <Field label="Tone"><Segmented value={tone} onChange={setTone} options={TONES} /></Field>
          <Field label="Strength"><Segmented value={intensity} onChange={setIntensity} options={INTENSITIES} /></Field>
          <Field label="Language">
            <select value={language} onChange={(e) => setLanguage(e.target.value as LanguageOption)} aria-label="Language"
              style={{ fontSize: 13, color: THEME.text, background: THEME.surface2, border: `1px solid ${THEME.border}`, borderRadius: 8, padding: "8px 12px", fontFamily: THEME.fontSans }}>
              {LANGUAGES.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </Field>
        </div>
      )}

      {/* Insights */}
      {before && (
        <div style={{ marginTop: 14 }}>
          <button onClick={() => setShowInsights((s) => !s)} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "transparent", border: "none", color: THEME.textDim, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: THEME.fontSans }}>
            {triggered.length} AI {triggered.length === 1 ? "pattern" : "patterns"} detected <ChevronDown size={15} style={{ transform: showInsights ? "rotate(180deg)" : "none", transition: "transform .2s" }} aria-hidden="true" />
          </button>
          {showInsights && (
            <div style={{ marginTop: 12, display: "flex", gap: 18, flexWrap: "wrap", alignItems: "center" }}>
              {afterScore !== null && (
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <ScoreRing score={before.score} size={86} />
                  <ArrowRight size={18} color={THEME.textMuted} aria-hidden="true" />
                  <ScoreRing score={afterScore} size={86} />
                </div>
              )}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, flex: 1, minWidth: 220 }}>
                {triggered.length === 0 ? <span style={{ fontSize: 13, color: THEME.textDim }}>No strong AI patterns — this already reads human.</span> :
                  triggered.slice(0, 12).map((p) => (
                    <span key={p.id} style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12, color: THEME.textDim, background: THEME.surface2, border: `1px solid ${THEME.border}`, padding: "5px 11px", borderRadius: 999 }}>
                      {p.label}<span style={{ color: THEME.textMuted }}>×{p.hits}</span>
                    </span>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}.spin{animation:spin .8s linear infinite}`}</style>
    </div>
  );
}

async function safeJson(res: Response): Promise<{ error?: { code?: string; message?: string } } | null> {
  try { return await res.json(); } catch { return null; }
}

const btnGhost: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 6, background: THEME.surface3, color: THEME.text,
  border: `1px solid ${THEME.border}`, borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: THEME.fontSans,
};

function Tab({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: typeof Upload; label: string }) {
  return (
    <button onClick={onClick} style={{ display: "inline-flex", alignItems: "center", gap: 6, border: "none", cursor: "pointer", borderRadius: 6, padding: "6px 11px", fontSize: 13, fontWeight: active ? 600 : 500, background: active ? THEME.surface2 : "transparent", color: active ? THEME.text : THEME.textDim, fontFamily: THEME.fontSans }}>
      <Icon size={14} aria-hidden="true" /> {label}
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
      <span style={{ fontSize: 13, fontWeight: 600, color: THEME.textDim, width: 80 }}>{label}</span>
      {children}
    </div>
  );
}
