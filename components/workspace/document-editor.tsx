"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Wand2, Copy, Download, Upload, Check, RotateCcw, Sparkles,
  Pencil, MoreHorizontal, Globe, ScanSearch, History as HistoryIcon, FileText, ClipboardPaste,
} from "lucide-react";
import { analyzeText, type AnalysisResult } from "@/lib/algorithms/analyzeText";
import { PATTERN_COUNT } from "@/lib/algorithms/patterns";
import type { ToneOption, IntensityLevel } from "@/lib/algorithms/humanizeText";
import { UploadZone } from "@/components/ui/upload-zone";
import { highlightChanges, sentenceDiff } from "@/lib/sentence-diff";
import { AnalysisPanel } from "@/components/workspace/analysis-panel";
import { HistoryDrawer } from "@/components/workspace/history-drawer";
import { UpgradeModal, type QuotaReason } from "@/components/ui/upgrade-modal";
import { EmailConsentCard } from "@/components/growth/email-consent-card";
import { ShareSuccessChip } from "@/components/growth/share-success-chip";
import { THEME, glow, humanScore, humanScoreColor, humanScoreLabel } from "@/lib/theme";
import { TONES as PLAN_TONES, isToneAllowed, type PlanId } from "@/lib/plans";
import type { VoiceProfileRow } from "@/components/growth/voice-manager";
import { InlineError } from "@/components/workspace/inline-error";
import { notify, copyText } from "@/components/workspace/notify";
import { humanizeError, USAGE_CHANGED_EVENT, type FriendlyError } from "@/components/workspace/feedback";
import { takePrefill } from "@/lib/prefill";

type Lang = "English" | "French" | "Spanish" | "Arabic" | "German" | "Italian";
const TONES: ToneOption[] = [...PLAN_TONES];
const planIdOf = (plan: string): PlanId => (plan === "PRO" || plan === "TEAM" ? plan : "FREE");
// Voice menu sentinels (never profile ids, which are cuids).
const VOICE_NONE = "";
const VOICE_NEW = "__new";
const VOICE_LOCKED = "__locked";
const INTENSITIES: IntensityLevel[] = ["light", "medium", "heavy"];
const LANGS: Lang[] = ["English", "French", "Spanish", "Arabic", "German", "Italian"];
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

type View = "humanized" | "original" | "diff";
type Screen = "edit" | "analyzing" | "analysis" | "result";
const ANALYZE_MS = 1500;

// The empty editor's "try it" text: deliberately full of AI tells so both
// Detect AI and Humanize have something visible to show on a first run.
const SAMPLE_TEXT = "In today's rapidly evolving digital landscape, it is important to note that effective communication plays a pivotal role in professional success. Furthermore, leveraging the right tools can help streamline workflows and foster meaningful collaboration across teams. Ultimately, by embracing these strategies, individuals can unlock their full potential and navigate the complexities of the modern workplace with confidence and clarity.";

/** Tells the shell's usage meter to refetch after a spend or a quota hit. */
const usageChanged = () => window.dispatchEvent(new Event(USAGE_CHANGED_EVENT));

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
  // Which Free limit it was (402 error.reason), so the plan menu doesn't blame words for the rewrite cap.
  const [quotaReason, setQuotaReason] = useState<QuotaReason>("words");
  // A failed humanize stays on screen with a Retry until the user acts on it.
  const [runError, setRunError] = useState<FriendlyError | null>(null);
  const [copied, setCopied] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  // Opened by a locked tone, voice or report: the modal says "Part of Pro", not "Nice work".
  const [lockedFeature, setLockedFeature] = useState(false);
  const [documentId, setDocumentId] = useState<string | null>(null);
  const [voices, setVoices] = useState<VoiceProfileRow[]>([]);
  const [voiceId, setVoiceId] = useState(VOICE_NONE);
  // Growth asks wait for a finished rewrite (ask after value): the email
  // opt-in first, and the referral chip only when the opt-in isn't showing.
  const [consentVisible, setConsentVisible] = useState<boolean | null>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const analyzeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Text handed over from a public tool (detector, free humanizer, home, compare).
  // Never auto-run: pressing Humanize is what turns it into a stored Document.
  useEffect(() => { const t = takePrefill(); if (t) setText(t); }, []);
  useEffect(() => { fetch("/api/user-plan").then((r) => r.json()).then((d) => setPlan(d.plan ?? "FREE")).catch(() => {}); }, []);
  useEffect(() => {
    fetch("/api/voice-profiles").then((r) => (r.ok ? r.json() : null))
      .then((d: { profiles?: VoiceProfileRow[] } | null) => setVoices((d?.profiles ?? []).filter((v) => v.usable)))
      .catch(() => {});
  }, []);
  // Back from a Word Pack checkout: the webhook credits the words a moment later.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("wordpack") === "1") {
      notify.success("Thanks for your order", "Your word pack shows under the usage meter within a minute.");
      // The Polar webhook credits the words a few seconds later.
      const t = setTimeout(usageChanged, 8000);
      return () => clearTimeout(t);
    }
  }, []);
  useEffect(() => { if (screen === "edit") taRef.current?.focus(); }, [screen]);
  useEffect(() => () => { if (analyzeTimer.current) clearTimeout(analyzeTimer.current); }, []);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(t);
  }, [copied]);

  const words = text.trim() ? text.trim().split(/\s+/).filter(Boolean).length : 0;
  // No live as-you-type score: the score is the payoff of pressing "Detect AI"
  // (otherwise the button just re-shows a number that's already on screen).
  // The pill only returns on the post-Humanize result screen (the after-score).
  const afterScore = useMemo(() => (humanized ? analyzeText(humanized).score : null), [humanized]);
  const canRun = words >= 5 && !busy;
  const canDetect = words >= 15 && !busy;
  const isEmpty = screen === "edit" && !text.trim() && !uploadOpen;

  // The instant engine is synchronous; we stage the reveal over ~1.5s so the
  // detection reads as deliberate work (scan animation), then show the panel.
  // `source` lets the empty-state starter scan the sample before setText lands.
  function detectAI(source: string = text) {
    if (busy || (source === text && !canDetect)) return;
    setMenu(false);
    setAnalysis(analyzeText(source));
    setScreen("analyzing");
    if (analyzeTimer.current) clearTimeout(analyzeTimer.current);
    analyzeTimer.current = setTimeout(() => setScreen("analysis"), ANALYZE_MS);
  }

  async function run() {
    if (!canRun) return;
    setBusy(true); setQuotaHit(false); setMenu(false); setRunError(null);
    try {
      const aRes = await fetch("/api/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) });
      if (!aRes.ok) return fail(aRes.status, await aRes.json().catch(() => null));
      const aData = (await aRes.json()) as { documentId: string | null };
      if (!aData.documentId) { setRunError(humanizeError(500)); return; }
      const hRes = await fetch("/api/humanize", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ documentId: aData.documentId, tone, intensity, voiceProfileId: voiceId || undefined, language: language !== "English" ? language : undefined }) });
      if (!hRes.ok) return fail(hRes.status, await hRes.json().catch(() => null));
      const hData = (await hRes.json()) as { humanizedText?: string };
      if (!hData.humanizedText) { setRunError(humanizeError(502, { error: { code: "EMPTY_RESULT" } })); return; }
      setOriginal(text); setHumanized(hData.humanizedText); setDocumentId(aData.documentId); setScreen("result"); setView("humanized");
      notify.success("Humanized", "Rewritten sentences are highlighted.");
      usageChanged();
    } catch { setRunError(humanizeError(0)); } finally { setBusy(false); }
  }
  function fail(status: number, body: { error?: { code?: string; message?: string; reason?: string } } | null) {
    if (status === 402 || body?.error?.code === "QUOTA_EXCEEDED") {
      setQuotaReason(body?.error?.reason === "rewrites" ? "rewrites" : "words");
      setQuotaHit(true); setUpgradeOpen(true); usageChanged(); return;
    }
    if (body?.error?.code === "TONE_LOCKED" || body?.error?.code === "VOICE_LOCKED") { setTone("standard"); setVoiceId(VOICE_NONE); openLocked(); }
    setRunError(humanizeError(status, body));
  }

  const planId = planIdOf(plan);
  function openLocked() { setLockedFeature(true); setUpgradeOpen(true); }
  function pickTone(v: string) {
    // Locked tones stay visible (that's the upsell) but open the plan menu instead.
    if (!isToneAllowed(planId, v)) { openLocked(); return; }
    setTone(v as ToneOption);
  }
  function pickVoice(v: string) {
    if (v === VOICE_LOCKED) { openLocked(); return; }
    if (v === VOICE_NEW) { window.location.href = "/dashboard/voice"; return; }
    setVoiceId(v);
  }
  const voiceOptions: { value: string; label: string }[] = planId === "FREE"
    ? [{ value: VOICE_NONE, label: "None" }, { value: VOICE_LOCKED, label: "My voice (Pro)" }]
    : [{ value: VOICE_NONE, label: "None" }, ...voices.map((v) => ({ value: v.id, label: v.name })), { value: VOICE_NEW, label: voices.length ? "Manage voices…" : "Create my voice…" }];

  function backToEdit() { if (analyzeTimer.current) clearTimeout(analyzeTimer.current); setScreen("edit"); }
  function edit() { if (humanized) setText(humanized); setScreen("edit"); }
  function reset() { setText(""); setOriginal(null); setHumanized(null); setDocumentId(null); setAnalysis(null); setScreen("edit"); setQuotaHit(false); setRunError(null); }
  function loadFromHistory(t: string) { setText(t); setOriginal(null); setHumanized(null); setAnalysis(null); setScreen("edit"); setRunError(null); }
  function loadSample() { setText(SAMPLE_TEXT); setRunError(null); taRef.current?.focus(); }
  function detectSample() { setText(SAMPLE_TEXT); setRunError(null); detectAI(SAMPLE_TEXT); }
  async function copy() { if (await copyText(humanized ?? text)) setCopied(true); }
  function download() {
    const blob = new Blob([humanized ?? text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "humanized.txt"; a.click(); URL.revokeObjectURL(url);
    notify.downloaded("humanized.txt");
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100dvh" }}>
      {/* Sticky toolbar */}
      <div className="ws-editor-toolbar" style={{ position: "sticky", top: 0, zIndex: 20, background: "rgba(255,255,255,0.85)", backdropFilter: "blur(14px) saturate(180%)", borderBottom: `1px solid ${THEME.border}` }}>
        <div style={{ maxWidth: 980, margin: "0 auto", padding: "10px 20px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <button onClick={run} disabled={!canRun}
            style={{ display: "inline-flex", alignItems: "center", gap: 8, background: canRun ? THEME.gradient : THEME.surface3, color: canRun ? "#fff" : THEME.textMuted, border: "none", borderRadius: 10, padding: "10px 20px", fontSize: 14, fontWeight: 700, cursor: canRun ? "pointer" : "not-allowed", boxShadow: canRun ? glow(THEME.brand, 0.3) : "none", fontFamily: THEME.fontSans }}>
            <Wand2 size={16} aria-hidden="true" /> {busy ? "Humanizing…" : screen === "result" ? "Re-humanize" : "Humanize"}
          </button>

          {screen !== "result" && (
            <button onClick={() => detectAI()} disabled={!canDetect} title={words < 15 ? "Write at least 15 words to detect AI" : undefined}
              style={{ display: "inline-flex", alignItems: "center", gap: 7, background: THEME.surface2, color: canDetect ? THEME.text : THEME.textMuted, border: `1px solid ${THEME.border}`, borderRadius: 10, padding: "10px 16px", fontSize: 14, fontWeight: 600, cursor: canDetect ? "pointer" : "not-allowed", fontFamily: THEME.fontSans }}>
              <ScanSearch size={16} aria-hidden="true" /> Detect AI
            </button>
          )}

          <Pick label="Tone" value={tone} options={TONES.map((t) => ({ value: t, label: isToneAllowed(planId, t) ? cap(t) : `${cap(t)} (Pro)` }))} onChange={pickTone} />
          <Pick label="Voice" value={voiceId} options={voiceOptions} onChange={pickVoice} />
          <Pick label="Strength" value={intensity} options={INTENSITIES.map((i) => ({ value: i, label: cap(i) }))} onChange={(v) => setIntensity(v as IntensityLevel)} />

          <div style={{ flex: 1 }} />

          {screen === "result" && (
            <div style={{ display: "inline-flex", background: THEME.surface3, borderRadius: 9, padding: 3, gap: 2 }}>
              {(["original", "humanized", "diff"] as View[]).map((v) => (
                <button key={v} onClick={() => setView(v)} style={{ border: "none", cursor: "pointer", borderRadius: 7, padding: "5px 11px", fontSize: 12, fontWeight: view === v ? 700 : 500, background: view === v ? THEME.surface2 : "transparent", color: view === v ? THEME.text : THEME.textDim, fontFamily: THEME.fontSans, textTransform: "capitalize" }}>{v}</button>
              ))}
            </div>
          )}

          {screen === "result" && afterScore !== null && <ScorePill score={afterScore} />}

          {screen === "result" && <>
            <IconBtn onClick={copy} title="Copy">{copied ? <Check size={15} aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />}</IconBtn>
            <IconBtn onClick={download} title="Download"><Download size={15} aria-hidden="true" /></IconBtn>
            {documentId && (
              <IconBtn title="Before/After Report" onClick={() => {
                if (planId === "FREE") { openLocked(); return; }
                window.open(`/dashboard/documents/${documentId}/report`, "_blank", "noopener");
              }}><FileText size={15} aria-hidden="true" /></IconBtn>
            )}
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
            <button onClick={() => setUpgradeOpen(true)} style={{ display: "inline-flex", alignItems: "center", background: THEME.gradient, color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>See plans</button>
          </div>
        </div>
      )}

      {runError && (
        <div style={{ maxWidth: 980, margin: "14px auto 0", width: "100%", padding: "0 20px" }}>
          <InlineError error={runError} onRetry={() => void run()} retrying={busy} onDismiss={() => setRunError(null)} />
        </div>
      )}

      {/* Canvas */}
      <div style={{ flex: 1, width: "100%", maxWidth: 820, margin: "0 auto", padding: "28px 24px 80px" }}>
        {uploadOpen && (
          <div style={{ marginBottom: 18, background: THEME.surface2, border: `1px solid ${THEME.border}`, borderRadius: THEME.radiusLg, padding: 16 }}>
            <UploadZone plan={plan} uploadEnabled={plan !== "FREE"} onExtracted={(r) => { setText(r.text); setScreen("edit"); setHumanized(null); setOriginal(null); setAnalysis(null); setUploadOpen(false); setRunError(null); notify.success("File loaded", r.fileName); }} />
            <button onClick={() => setUploadOpen(false)} style={{ marginTop: 10, background: "transparent", border: "none", color: THEME.textDim, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
          </div>
        )}

        {screen === "edit" && (
          <textarea ref={taRef} value={text} onChange={(e) => setText(e.target.value)}
            placeholder="Write or paste your text here, then Detect AI or Humanize…"
            aria-label="Document"
            style={{ width: "100%", minHeight: isEmpty ? "22vh" : "62vh", resize: "none", border: "none", outline: "none", background: "transparent", fontSize: 17, lineHeight: 1.85, color: THEME.text, fontFamily: THEME.fontSans }} />
        )}

        {isEmpty && (
          <div className="animate-fade-up" style={{ marginTop: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: THEME.textMuted, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>
              New here? Start with one of these
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 10 }}>
              <Starter icon={<ClipboardPaste size={18} aria-hidden="true" />} title="Paste a sample text" body="Load an AI-sounding paragraph, then press Humanize." onClick={loadSample} />
              <Starter icon={<ScanSearch size={18} aria-hidden="true" />} title="Try the free AI detector" body="See which sentences read as AI, highlighted inline." onClick={detectSample} />
              <Starter icon={<Upload size={18} aria-hidden="true" />} title="Upload a file" body={plan === "FREE" ? "PDF, Word or text files. Part of Pro." : "PDF, Word or text files."} onClick={() => setUploadOpen(true)} />
            </div>
          </div>
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
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 18 }}>
            <EmailConsentCard onVisibleChange={setConsentVisible} />
            {consentVisible === false && <ShareSuccessChip />}
          </div>
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
      <div style={{ position: "sticky", bottom: 0, zIndex: 20, background: "rgba(255,255,255,0.85)", backdropFilter: "blur(10px)", borderTop: `1px solid ${THEME.border}` }} className="ws-editor-footer">
        <div style={{ maxWidth: 980, margin: "0 auto", padding: "8px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12, color: THEME.textMuted }}>
          <span>{words.toLocaleString()} words</span>
          <span>{footerStatus(screen)}</span>
        </div>
      </div>

      <HistoryDrawer open={historyOpen} onClose={() => setHistoryOpen(false)} onOpen={loadFromHistory} />
      <UpgradeModal isOpen={upgradeOpen} onClose={() => { setUpgradeOpen(false); setLockedFeature(false); }} currentPlan={plan} trigger={quotaHit ? "quota" : lockedFeature ? "feature" : "upgrade"} quotaReason={quotaReason} />
    </div>
  );
}

function footerStatus(screen: Screen): string {
  switch (screen) {
    case "result": return "Highlighted sentences were rewritten";
    case "analyzing": return "Analyzing…";
    case "analysis": return "Highlighted spans are the AI tells we located";
    default: return "Detect AI runs instantly in your browser";
  }
}

function Starter({ icon, title, body, onClick }: { icon: React.ReactNode; title: string; body: string; onClick: () => void }) {
  return (
    <button onClick={onClick}
      style={{ display: "flex", alignItems: "flex-start", gap: 12, textAlign: "left", background: THEME.surface2, border: `1px solid ${THEME.border}`, borderRadius: THEME.radius, padding: 14, cursor: "pointer", fontFamily: THEME.fontSans, boxShadow: "0 1px 2px rgba(29,23,38,0.04)" }}>
      <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 34, height: 34, borderRadius: 9, background: THEME.brandDim, color: THEME.brandHi, flexShrink: 0 }}>{icon}</span>
      <span style={{ minWidth: 0 }}>
        <span style={{ display: "block", fontSize: 14, fontWeight: 700, color: THEME.text }}>{title}</span>
        <span style={{ display: "block", fontSize: 12.5, color: THEME.textDim, lineHeight: 1.45, marginTop: 2 }}>{body}</span>
      </span>
    </button>
  );
}

function Dot({ delay }: { delay: string }) {
  return <span className="pulse-dot" style={{ width: 5, height: 5, borderRadius: 999, background: THEME.brand, animationDelay: delay }} />;
}

function Pick({ label, value, options, onChange }: { label: string; value: string; options: { value: string; label: string }[]; onChange: (v: string) => void }) {
  return (
    <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: THEME.textMuted }}>
      <span className="ws-pick-label">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} aria-label={label}
        style={{ fontSize: 13, color: THEME.text, background: THEME.surface2, border: `1px solid ${THEME.border}`, borderRadius: 8, padding: "7px 10px", fontFamily: THEME.fontSans, cursor: "pointer" }}>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
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
