"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useAuth } from "@clerk/nextjs";
import { usePostHog } from "posthog-js/react";
import { PatternCard } from "@/components/ui/pattern-card";
import { AuthModal } from "@/components/ui/auth-modal";
import { UpgradeModal } from "@/components/ui/upgrade-modal";
import type { PatternHit } from "@/lib/algorithms/analyzeText";
import { computeReadability, type ReadabilityMetrics } from "@/lib/readability";
import { exportDocx, exportPdf } from "@/lib/export";
import { Copy, RotateCcw, Zap, CheckCircle2, Sparkles, ArrowRight, ChevronDown, ChevronUp, SlidersHorizontal, GitCompareArrows, Rows3, FileText, FileDown, Layers, BookOpen } from "lucide-react";
import { toast } from "sonner";
import { computeWordDiff, type DiffSegment } from "@/lib/utils/wordDiff";

type ToneOption = "standard" | "formal" | "casual" | "academic" | "storytelling" | "professional";
type IntensityLevel = "light" | "medium" | "heavy";
type EditorMode = "single" | "bulk";

const INTENSITIES: { value: IntensityLevel; label: string; desc: string }[] = [
  { value: "light", label: "Light", desc: "Subtle tweaks, keep original voice" },
  { value: "medium", label: "Medium", desc: "Balanced rewrite" },
  { value: "heavy", label: "Heavy", desc: "Complete overhaul" },
];

interface AnalyzeResponse {
  score: number;
  confidenceBand: string;
  patterns: PatternHit[];
  stats: { burstiness: number; typeTokenRatio: number; avgSentenceLength: number; fleschReadingEase: number };
  wordCount: number;
  documentId: string;
}

interface BulkItem {
  id: number;
  text: string;
  result: AnalyzeResponse | null;
  humanizedText: string | null;
  humanizedScore: number | null;
  status: "pending" | "analyzing" | "analyzed" | "humanizing" | "done" | "error";
  error?: string;
}

const TONES: { value: ToneOption; label: string; icon: string }[] = [
  { value: "standard", label: "Standard", icon: "\u2696\uFE0F" },
  { value: "formal", label: "Formal", icon: "\uD83C\uDFA9" },
  { value: "casual", label: "Casual", icon: "\u2615" },
  { value: "academic", label: "Academic", icon: "\uD83C\uDF93" },
  { value: "storytelling", label: "Story", icon: "\uD83D\uDCD6" },
  { value: "professional", label: "Pro", icon: "\uD83D\uDCBC" },
];

function getScoreConfig(score: number) {
  if (score >= 75) return { label: "FLAGGED AS AI", desc: "Will be caught by GPTZero, Turnitin & Originality.ai", color: "#ef4444", dimColor: "rgba(239,68,68,0.08)", border: "rgba(239,68,68,0.2)", ctaLabel: "Fix it — Humanize now" };
  if (score >= 50) return { label: "LIKELY AI", desc: "Most detectors will flag this text", color: "#f97316", dimColor: "rgba(249,115,22,0.08)", border: "rgba(249,115,22,0.2)", ctaLabel: "Humanize to reduce risk" };
  if (score >= 30) return { label: "BORDERLINE", desc: "Some detectors may flag this", color: "#eab308", dimColor: "rgba(234,179,8,0.06)", border: "rgba(234,179,8,0.18)", ctaLabel: "Polish to pass safely" };
  return { label: "LOOKS HUMAN", desc: "Should pass most AI detectors", color: "#22c55e", dimColor: "rgba(34,197,94,0.06)", border: "rgba(34,197,94,0.18)", ctaLabel: "Polish it further" };
}

// Animated score ring with count-up
function ScoreRing({ score, size = 140 }: { score: number; size?: number }) {
  const [displayed, setDisplayed] = useState(0);
  const [drawn, setDrawn] = useState(false);
  const cfg = getScoreConfig(score);
  const strokeWidth = 9;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  useEffect(() => {
    const t1 = setTimeout(() => setDrawn(true), 80);
    let start = 0;
    const target = Math.round(score);
    const duration = 900;
    const step = 16;
    const increment = (target / duration) * step;
    const t2 = setInterval(() => {
      start = Math.min(start + increment, target);
      setDisplayed(Math.round(start));
      if (start >= target) clearInterval(t2);
    }, step);
    return () => { clearTimeout(t1); clearInterval(t2); };
  }, [score]);

  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={strokeWidth} />
        <circle
          cx={size / 2} cy={size / 2} r={radius} fill="none"
          stroke={cfg.color} strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={drawn ? offset : circumference}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 1s cubic-bezier(0.4,0,0.2,1), stroke 0.4s ease" }}
        />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontSize: "36px", fontWeight: 900, color: cfg.color, lineHeight: 1, letterSpacing: "-2px", fontVariantNumeric: "tabular-nums" }}>
          {displayed}
        </div>
        <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.3)", marginTop: "2px" }}>/100</div>
      </div>
    </div>
  );
}

// Skeleton shimmer block
function Skeleton({ width = "100%", height = 16, radius = 6, style = {} }: { width?: string | number; height?: number; radius?: number; style?: React.CSSProperties }) {
  return (
    <div style={{
      width, height, borderRadius: radius,
      background: "linear-gradient(90deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.04) 100%)",
      backgroundSize: "200% 100%",
      animation: "shimmer 1.5s infinite",
      ...style,
    }} />
  );
}

// Humanizing orb animation
function HumanizingState() {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      padding: "40px 24px", gap: "20px",
      animation: "fadeInUp 0.3s ease",
    }}>
      <div style={{ position: "relative", width: "64px", height: "64px" }}>
        {[
          { size: 32, top: "16px", left: "16px", delay: "0s", color: "rgba(139,92,246,0.9)" },
          { size: 22, top: "4px", left: "6px", delay: "0.3s", color: "rgba(99,102,241,0.7)" },
          { size: 18, top: "auto", left: "auto", delay: "0.6s", color: "rgba(167,139,250,0.6)" },
        ].map((orb, i) => (
          <div key={i} style={{
            position: "absolute",
            width: orb.size, height: orb.size,
            top: orb.top, left: orb.left,
            ...(i === 2 ? { bottom: "4px", right: "4px" } : {}),
            borderRadius: "50%",
            background: `radial-gradient(circle, ${orb.color}, transparent)`,
            filter: "blur(3px)",
            animation: `orb${i + 1} ${1.8 + i * 0.4}s ease-in-out infinite`,
            animationDelay: orb.delay,
          }} />
        ))}
      </div>
      <div>
        <p style={{ fontSize: "14px", fontWeight: 600, color: "rgba(255,255,255,0.8)", textAlign: "center", marginBottom: "6px" }}>
          AI is rewriting your text
          <span className="dots"><span>.</span><span>.</span><span>.</span></span>
        </p>
        <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.3)", textAlign: "center" }}>
          Multi-pass engine · up to 3 attempts · picking the best
        </p>
      </div>
      <div style={{ display: "flex", gap: "6px" }}>
        {["Pass 1", "Pass 2", "Pass 3"].map((p, i) => (
          <div key={p} style={{
            fontSize: "10px", color: "rgba(255,255,255,0.3)",
            padding: "3px 8px", borderRadius: "4px",
            background: "rgba(139,92,246,0.08)", border: "1px solid rgba(139,92,246,0.15)",
            animation: `passGlow 1.8s ease-in-out infinite`,
            animationDelay: `${i * 0.6}s`,
          }}>{p}</div>
        ))}
      </div>
    </div>
  );
}

// ── Readability Panel ──
function ReadabilityPanel({ originalText, humanizedText }: { originalText: string; humanizedText: string | null }) {
  const [expanded, setExpanded] = useState(false);
  const original = useMemo(() => computeReadability(originalText), [originalText]);
  const humanized = useMemo(() => humanizedText ? computeReadability(humanizedText) : null, [humanizedText]);

  const MetricRow = ({ label, originalVal, originalColor, humanizedVal, humanizedColor }: {
    label: string; originalVal: string; originalColor: string; humanizedVal?: string; humanizedColor?: string;
  }) => (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
      <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)", flex: 1 }}>{label}</span>
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <span style={{ fontSize: "12px", fontWeight: 700, color: originalColor, minWidth: "50px", textAlign: "right" }}>{originalVal}</span>
        {humanizedVal !== undefined && (
          <>
            <ArrowRight size={9} color="rgba(255,255,255,0.15)" />
            <span style={{ fontSize: "12px", fontWeight: 700, color: humanizedColor ?? originalColor, minWidth: "50px", textAlign: "right" }}>{humanizedVal}</span>
          </>
        )}
      </div>
    </div>
  );

  return (
    <div style={{
      background: "#0f0f12", borderRadius: "12px",
      border: "1px solid rgba(255,255,255,0.06)", overflow: "hidden",
      animation: "fadeInUp 0.4s ease 0.15s both",
    }}>
      <button
        onClick={() => setExpanded(e => !e)}
        style={{
          width: "100%", padding: "12px 16px",
          background: "transparent", border: "none",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          cursor: "pointer", color: "rgba(255,255,255,0.65)",
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: "7px", fontSize: "12px", fontWeight: 600 }}>
          <BookOpen size={13} color="#8b5cf6" /> Readability Analysis
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{
            fontSize: "11px", padding: "2px 8px", borderRadius: "4px",
            background: `${original.fleschColor}15`, color: original.fleschColor,
            fontWeight: 700,
          }}>
            {original.fleschLabel}
          </span>
          {expanded ? <ChevronUp size={13} color="rgba(255,255,255,0.3)" /> : <ChevronDown size={13} color="rgba(255,255,255,0.3)" />}
        </div>
      </button>
      {expanded && (
        <div style={{ padding: "4px 16px 14px", animation: "fadeInUp 0.2s ease" }}>
          {humanized && (
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "24px", marginBottom: "4px", paddingBottom: "6px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              <span style={{ fontSize: "9px", color: "rgba(255,255,255,0.25)", textTransform: "uppercase", letterSpacing: "0.5px" }}>Original</span>
              <span style={{ fontSize: "9px", color: "rgba(255,255,255,0.25)", textTransform: "uppercase", letterSpacing: "0.5px", marginRight: "4px" }}>Humanized</span>
            </div>
          )}
          <MetricRow
            label="Flesch Reading Ease"
            originalVal={`${original.fleschScore}`}
            originalColor={original.fleschColor}
            humanizedVal={humanized ? `${humanized.fleschScore}` : undefined}
            humanizedColor={humanized?.fleschColor}
          />
          <MetricRow
            label="Reading Time"
            originalVal={`${original.readingTimeMinutes} min`}
            originalColor="rgba(255,255,255,0.7)"
            humanizedVal={humanized ? `${humanized.readingTimeMinutes} min` : undefined}
            humanizedColor="rgba(255,255,255,0.7)"
          />
          <MetricRow
            label="Avg Sentence Length"
            originalVal={`${original.avgSentenceLength}w`}
            originalColor={original.avgSentenceLength >= 18 && original.avgSentenceLength <= 25 ? "#f97316" : "#22c55e"}
            humanizedVal={humanized ? `${humanized.avgSentenceLength}w` : undefined}
            humanizedColor={humanized ? (humanized.avgSentenceLength >= 18 && humanized.avgSentenceLength <= 25 ? "#f97316" : "#22c55e") : undefined}
          />
          <MetricRow
            label="Vocabulary Richness"
            originalVal={`${original.vocabularyRichness}%`}
            originalColor={original.vocabularyRichness < 40 ? "#f97316" : "#22c55e"}
            humanizedVal={humanized ? `${humanized.vocabularyRichness}%` : undefined}
            humanizedColor={humanized ? (humanized.vocabularyRichness < 40 ? "#f97316" : "#22c55e") : undefined}
          />
          <MetricRow
            label="Grade Level"
            originalVal={`${original.gradeLevel}`}
            originalColor={original.gradeLevel > 12 ? "#f97316" : "#22c55e"}
            humanizedVal={humanized ? `${humanized.gradeLevel}` : undefined}
            humanizedColor={humanized ? (humanized.gradeLevel > 12 ? "#f97316" : "#22c55e") : undefined}
          />
          <div style={{ marginTop: "6px", display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.2)" }}>
              Grade: {original.gradeLevelLabel}
            </span>
            {humanized && (
              <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.2)" }}>
                Grade: {humanized.gradeLevelLabel}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function EditorPage() {
  const { isSignedIn } = useAuth();
  const posthog = usePostHog();
  const [text, setText] = useState("");
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const [humanizedText, setHumanizedText] = useState<string | null>(null);
  const [humanizedScore, setHumanizedScore] = useState<number | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [humanizing, setHumanizing] = useState(false);
  const [tone, setTone] = useState<ToneOption>("standard");
  const [intensity, setIntensity] = useState<IntensityLevel>("medium");
  const [showAllPatterns, setShowAllPatterns] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showDiff, setShowDiff] = useState(false);
  const [paragraphMode, setParagraphMode] = useState(false);
  const [paraScores, setParaScores] = useState<Record<number, number | null>>({});
  const [paraHumanized, setParaHumanized] = useState<Record<number, string | null>>({});
  const [paraHumanizing, setParaHumanizing] = useState<Record<number, boolean>>({});
  const [visiblePatterns, setVisiblePatterns] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Bulk mode state
  const [editorMode, setEditorMode] = useState<EditorMode>("single");
  const [bulkText, setBulkText] = useState("");
  const [bulkItems, setBulkItems] = useState<BulkItem[]>([]);
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0 });
  const [userPlan, setUserPlan] = useState<string>("FREE");
  const bulkAbortRef = useRef(false);

  // Fetch user plan
  useEffect(() => {
    fetch("/api/user-plan").then(r => r.ok ? r.json() : null).then((d: { plan?: string } | null) => {
      if (d?.plan) setUserPlan(d.plan);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const prefill = sessionStorage.getItem("prefill-text");
    if (prefill) { setText(prefill); sessionStorage.removeItem("prefill-text"); }
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setShowAuthModal(false); setShowUpgradeModal(false); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Stagger patterns reveal
  useEffect(() => {
    if (!result) { setVisiblePatterns(0); return; }
    setVisiblePatterns(0);
    const patterns = result.patterns.slice(0, showAllPatterns ? undefined : 3);
    patterns.forEach((_, i) => {
      setTimeout(() => setVisiblePatterns(i + 1), 120 + i * 80);
    });
  }, [result, showAllPatterns]);

  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
  const canAnalyze = text.trim().length >= 10 && !analyzing && !humanizing;
  const scoreConfig = result ? getScoreConfig(result.score) : null;
  const isDone = !humanizing && humanizedText !== null;

  const handleAnalyze = useCallback(async () => {
    if (!canAnalyze) return;
    posthog?.capture("analyze_clicked", { word_count: wordCount });
    setAnalyzing(true);
    setResult(null);
    setHumanizedText(null);
    setHumanizedScore(null);
    setShowAllPatterns(false);

    try {
      const res = await fetch("/api/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) });
      const data = await res.json() as AnalyzeResponse & { error?: { message: string } };
      if (res.status === 402) { setShowUpgradeModal(true); return; }
      if (!res.ok) { toast.error(data.error?.message ?? "Analysis failed."); return; }
      setResult(data);
      posthog?.capture("analysis_completed", { score: data.score, pattern_count: data.patterns.length });
    } catch { toast.error("Network error. Please try again."); }
    finally { setAnalyzing(false); }
  }, [text, canAnalyze, wordCount, posthog]);

  const handleHumanize = useCallback(async (overrideTone?: ToneOption) => {
    if (!result) return;
    if (!isSignedIn) { setShowAuthModal(true); return; }
    const useTone = overrideTone ?? tone;
    posthog?.capture("humanize_clicked", { tone: useTone, score: result.score });
    setHumanizing(true);
    setHumanizedText(null);
    setHumanizedScore(null);

    try {
      const res = await fetch("/api/humanize", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ documentId: result.documentId, tone: useTone, intensity }) });
      const data = await res.json() as { humanizedText?: string; error?: { message: string } };
      if (res.status === 402) { setShowUpgradeModal(true); return; }
      if (!res.ok) { toast.error(data.error?.message ?? "Humanization failed."); return; }

      setHumanizedText(data.humanizedText ?? null);
      if (data.humanizedText) {
        try {
          const reRes = await fetch("/api/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: data.humanizedText }) });
          if (reRes.ok) { const reData = await reRes.json() as AnalyzeResponse; setHumanizedScore(reData.score); }
        } catch { /* ignore */ }
      }
      posthog?.capture("humanize_completed", { tone: useTone, original_score: result.score });
    } catch { toast.error("Network error. Please try again."); }
    finally { setHumanizing(false); }
  }, [result, tone, isSignedIn, posthog]);

  const handleCopy = useCallback(async () => {
    if (!humanizedText) return;
    await navigator.clipboard.writeText(humanizedText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    posthog?.capture("text_copied");
  }, [humanizedText, posthog]);

  const handleReset = () => {
    setResult(null);
    setHumanizedText(null);
    setHumanizedScore(null);
    setShowAllPatterns(false);
    setParaScores({});
    setParaHumanized({});
    setParaHumanizing({});
    setTimeout(() => textareaRef.current?.focus(), 100);
  };

  // Paragraph mode helpers
  const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0);

  const handleAnalyzeParagraph = useCallback(async (paraText: string, idx: number) => {
    if (!paraText || paraText.trim().length < 10) return;
    try {
      const res = await fetch("/api/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: paraText }) });
      if (res.ok) {
        const data = await res.json() as AnalyzeResponse;
        setParaScores(prev => ({ ...prev, [idx]: data.score }));
      }
    } catch { /* ignore */ }
  }, []);

  const handleHumanizeParagraph = useCallback(async (idx: number) => {
    const para = paragraphs[idx];
    if (!para || para.trim().length < 10) return;
    if (!isSignedIn) { setShowAuthModal(true); return; }

    setParaHumanizing(prev => ({ ...prev, [idx]: true }));
    try {
      const analyzeRes = await fetch("/api/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: para }) });
      if (!analyzeRes.ok) { toast.error("Analysis failed."); return; }
      const analyzeData = await analyzeRes.json() as AnalyzeResponse;

      const res = await fetch("/api/humanize", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ documentId: analyzeData.documentId, tone, intensity }) });
      const data = await res.json() as { humanizedText?: string; error?: { message: string } };
      if (res.status === 402) { setShowUpgradeModal(true); return; }
      if (!res.ok) { toast.error(data.error?.message ?? "Humanization failed."); return; }

      setParaHumanized(prev => ({ ...prev, [idx]: data.humanizedText ?? null }));

      if (data.humanizedText) {
        try {
          const reRes = await fetch("/api/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: data.humanizedText }) });
          if (reRes.ok) {
            const reData = await reRes.json() as AnalyzeResponse;
            setParaScores(prev => ({ ...prev, [idx]: reData.score }));
          }
        } catch { /* ignore */ }
      }
    } catch { toast.error("Network error."); }
    finally { setParaHumanizing(prev => ({ ...prev, [idx]: false })); }
  }, [paragraphs, tone, intensity, isSignedIn]);

  useEffect(() => {
    if (!paragraphMode || !result) return;
    paragraphs.forEach((p, i) => {
      if (p.trim().length >= 10 && paraScores[i] === undefined) {
        void handleAnalyzeParagraph(p, i);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paragraphMode, result]);

  // ── Export handlers ──
  const handleExportDocx = useCallback(async () => {
    if (!humanizedText || !result) return;
    try {
      await exportDocx({
        originalText: text,
        humanizedText,
        aiScore: result.score,
        humanizedScore,
        date: new Date(),
      });
      posthog?.capture("export_docx");
      toast.success("Downloaded .docx");
    } catch { toast.error("Export failed."); }
  }, [humanizedText, result, text, humanizedScore, posthog]);

  const handleExportPdf = useCallback(() => {
    if (!humanizedText || !result) return;
    try {
      exportPdf({
        originalText: text,
        humanizedText,
        aiScore: result.score,
        humanizedScore,
        date: new Date(),
      });
      posthog?.capture("export_pdf");
      toast.success("Downloaded PDF");
    } catch { toast.error("Export failed."); }
  }, [humanizedText, result, text, humanizedScore, posthog]);

  // ── Bulk mode handlers ──
  const parseBulkTexts = useCallback(() => {
    const texts = bulkText.split("---").map(t => t.trim()).filter(t => t.length >= 10);
    return texts.map((t, i) => ({
      id: i,
      text: t,
      result: null,
      humanizedText: null,
      humanizedScore: null,
      status: "pending" as const,
    }));
  }, [bulkText]);

  const handleBulkAnalyze = useCallback(async () => {
    if (!isSignedIn) { setShowAuthModal(true); return; }
    if (userPlan === "FREE") { setShowUpgradeModal(true); return; }

    const items = parseBulkTexts();
    if (items.length === 0) { toast.error("No valid texts found. Separate with ---"); return; }
    setBulkItems(items);
    setBulkProcessing(true);
    setBulkProgress({ current: 0, total: items.length });
    bulkAbortRef.current = false;

    for (let i = 0; i < items.length; i++) {
      if (bulkAbortRef.current) break;
      setBulkProgress({ current: i + 1, total: items.length });
      setBulkItems(prev => prev.map(item => item.id === i ? { ...item, status: "analyzing" } : item));

      try {
        const res = await fetch("/api/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: items[i].text }) });
        if (res.status === 402) { setShowUpgradeModal(true); setBulkProcessing(false); return; }
        const data = await res.json() as AnalyzeResponse & { error?: { message: string } };
        if (!res.ok) {
          setBulkItems(prev => prev.map(item => item.id === i ? { ...item, status: "error", error: data.error?.message ?? "Failed" } : item));
          continue;
        }
        setBulkItems(prev => prev.map(item => item.id === i ? { ...item, result: data, status: "analyzed" } : item));
      } catch {
        setBulkItems(prev => prev.map(item => item.id === i ? { ...item, status: "error", error: "Network error" } : item));
      }
    }
    setBulkProcessing(false);
  }, [isSignedIn, userPlan, parseBulkTexts]);

  const handleBulkHumanize = useCallback(async () => {
    if (!isSignedIn) { setShowAuthModal(true); return; }
    if (userPlan === "FREE") { setShowUpgradeModal(true); return; }

    const analyzed = bulkItems.filter(item => item.result && item.status === "analyzed");
    if (analyzed.length === 0) { toast.error("Analyze texts first."); return; }
    setBulkProcessing(true);
    bulkAbortRef.current = false;

    for (let i = 0; i < analyzed.length; i++) {
      if (bulkAbortRef.current) break;
      const item = analyzed[i];
      setBulkProgress({ current: i + 1, total: analyzed.length });
      setBulkItems(prev => prev.map(b => b.id === item.id ? { ...b, status: "humanizing" } : b));

      try {
        const res = await fetch("/api/humanize", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ documentId: item.result!.documentId, tone }) });
        if (res.status === 402) { setShowUpgradeModal(true); setBulkProcessing(false); return; }
        const data = await res.json() as { humanizedText?: string; error?: { message: string } };
        if (!res.ok) {
          setBulkItems(prev => prev.map(b => b.id === item.id ? { ...b, status: "error", error: data.error?.message ?? "Failed" } : b));
          continue;
        }

        let hScore: number | null = null;
        if (data.humanizedText) {
          try {
            const reRes = await fetch("/api/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: data.humanizedText }) });
            if (reRes.ok) { const reData = await reRes.json() as AnalyzeResponse; hScore = reData.score; }
          } catch { /* ignore */ }
        }
        setBulkItems(prev => prev.map(b => b.id === item.id ? { ...b, humanizedText: data.humanizedText ?? null, humanizedScore: hScore, status: "done" } : b));
      } catch {
        setBulkItems(prev => prev.map(b => b.id === item.id ? { ...b, status: "error", error: "Network error" } : b));
      }
    }
    setBulkProcessing(false);
  }, [bulkItems, isSignedIn, userPlan, tone]);

  // Word count color
  const wordCountColor = wordCount === 0 ? "rgba(255,255,255,0.2)"
    : wordCount > 1800 ? "#ef4444"
    : wordCount > 1500 ? "#eab308"
    : "#22c55e";

  const showRightPanel = result || analyzing;

  return (
    <div style={{ minHeight: "100%", background: "#09090b", display: "flex", flexDirection: "column" }}>

      {/* ── Header ── */}
      <div style={{
        padding: "12px 24px",
        borderBottom: "1px solid rgba(255,255,255,0.05)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        flexShrink: 0, gap: "12px", flexWrap: "wrap",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <Sparkles size={15} color="#8b5cf6" />
          <h1 style={{ fontSize: "14px", fontWeight: 700, color: "#fafafa", margin: 0 }}>Editor</h1>

          {/* Mode toggle */}
          <div style={{ display: "flex", gap: "2px", background: "rgba(255,255,255,0.04)", borderRadius: "6px", padding: "2px" }}>
            <button onClick={() => setEditorMode("single")} style={{
              padding: "4px 10px", borderRadius: "4px", fontSize: "11px", fontWeight: 500, cursor: "pointer",
              border: "none",
              background: editorMode === "single" ? "rgba(139,92,246,0.15)" : "transparent",
              color: editorMode === "single" ? "#a78bfa" : "rgba(255,255,255,0.3)",
              transition: "all 0.15s",
            }}>Single</button>
            <button onClick={() => {
              if (userPlan === "FREE" && !isSignedIn) { setShowAuthModal(true); return; }
              if (userPlan === "FREE") { setShowUpgradeModal(true); return; }
              setEditorMode("bulk");
            }} style={{
              padding: "4px 10px", borderRadius: "4px", fontSize: "11px", fontWeight: 500, cursor: "pointer",
              border: "none",
              background: editorMode === "bulk" ? "rgba(139,92,246,0.15)" : "transparent",
              color: editorMode === "bulk" ? "#a78bfa" : "rgba(255,255,255,0.3)",
              display: "flex", alignItems: "center", gap: "4px",
              transition: "all 0.15s",
            }}>
              <Layers size={10} /> Bulk
              {userPlan === "FREE" && <span style={{ fontSize: "8px", background: "#8b5cf6", color: "#fff", padding: "1px 4px", borderRadius: "3px", fontWeight: 700 }}>PRO</span>}
            </button>
          </div>

          {/* Step breadcrumb (single mode only) */}
          {editorMode === "single" && (
            <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
              {[
                { label: "Write", done: !!result || analyzing },
                { label: "Analyze", done: !!result, active: analyzing },
                { label: "Humanize", done: isDone, active: humanizing },
              ].map(({ label, done, active }, i) => (
                <div key={label} style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                  {i > 0 && <div style={{ width: "14px", height: "1px", background: done || active ? "rgba(139,92,246,0.4)" : "rgba(255,255,255,0.08)" }} />}
                  <span style={{
                    fontSize: "11px", fontWeight: done || active ? 600 : 400,
                    color: done ? "#22c55e" : active ? "#a78bfa" : "rgba(255,255,255,0.25)",
                    display: "flex", alignItems: "center", gap: "3px",
                  }}>
                    {done && <CheckCircle2 size={9} />}
                    {label}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {/* Tone selector */}
          <div style={{ display: "flex", gap: "3px", flexWrap: "wrap" }}>
            {TONES.map(({ value, label, icon }) => (
              <button key={value} onClick={() => setTone(value)} style={{
                padding: "4px 10px", borderRadius: "20px", fontSize: "11px", fontWeight: 500, cursor: "pointer",
                border: `1px solid ${tone === value ? "rgba(139,92,246,0.4)" : "rgba(255,255,255,0.06)"}`,
                background: tone === value ? "rgba(139,92,246,0.12)" : "transparent",
                color: tone === value ? "#8b5cf6" : "rgba(255,255,255,0.3)",
                transition: "all 0.15s",
                display: "flex", alignItems: "center", gap: "4px",
              }}><span style={{ fontSize: "12px" }}>{icon}</span>{label}</button>
            ))}
          </div>
          {editorMode === "single" && (result || humanizedText) && (
            <button onClick={handleReset} style={{
              display: "flex", alignItems: "center", gap: "4px",
              background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: "6px", padding: "4px 10px", color: "rgba(255,255,255,0.35)",
              cursor: "pointer", fontSize: "11px",
            }}>
              <RotateCcw size={10} /> New
            </button>
          )}
        </div>
      </div>

      {/* ── Main Content ── */}
      <div style={{ flex: 1, padding: "20px 24px", overflow: "auto" }}>

        {/* ── SINGLE MODE ── */}
        {editorMode === "single" && (
          <div className="editor-grid" style={{
            display: "grid",
            gridTemplateColumns: showRightPanel ? "1fr 400px" : "1fr",
            gap: "20px",
            maxWidth: showRightPanel ? "1120px" : "720px",
            margin: "0 auto",
            transition: "max-width 0.4s ease",
          }}>

            {/* ── LEFT: Textarea + Humanized ── */}
            <div style={{ display: "flex", flexDirection: "column", gap: "16px", minWidth: 0 }}>

              {/* Textarea card */}
              <div style={{
                background: "#0f0f12", borderRadius: "12px",
                border: `1.5px solid ${analyzing ? "rgba(139,92,246,0.4)" : "rgba(255,255,255,0.07)"}`,
                overflow: "hidden", transition: "border-color 0.3s, box-shadow 0.3s",
                boxShadow: analyzing ? "0 0 30px rgba(139,92,246,0.08)" : "none",
              }}>
                {/* Mac-style toolbar */}
                <div style={{
                  padding: "10px 14px", borderBottom: "1px solid rgba(255,255,255,0.05)",
                  display: "flex", alignItems: "center", gap: "6px",
                  background: analyzing ? "rgba(139,92,246,0.04)" : "transparent",
                  transition: "background 0.3s",
                }}>
                  {["#ef4444", "#eab308", "#22c55e"].map((c, i) => (
                    <div key={i} style={{ width: "8px", height: "8px", borderRadius: "50%", background: c, opacity: analyzing ? 0.8 : 0.4 }} />
                  ))}
                  <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.15)", marginLeft: "8px", fontFamily: "monospace" }}>
                    {analyzing ? "scanning..." : "your text"}
                  </span>
                  {result && !analyzing && (
                    <button onClick={() => setParagraphMode(p => !p)} style={{
                      marginLeft: "auto", display: "flex", alignItems: "center", gap: "4px",
                      padding: "3px 8px", borderRadius: "4px", fontSize: "10px", cursor: "pointer",
                      border: `1px solid ${paragraphMode ? "rgba(139,92,246,0.3)" : "rgba(255,255,255,0.08)"}`,
                      background: paragraphMode ? "rgba(139,92,246,0.1)" : "transparent",
                      color: paragraphMode ? "#a78bfa" : "rgba(255,255,255,0.25)",
                      transition: "all 0.15s",
                    }}>
                      <Rows3 size={10} /> Paragraph Mode
                    </button>
                  )}
                  {analyzing && (
                    <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "6px" }}>
                      <div className="scan-pulse" />
                      <span style={{ fontSize: "10px", color: "#a78bfa" }}>Analyzing</span>
                    </div>
                  )}
                </div>

                {/* Scan progress bar */}
                {analyzing && (
                  <div style={{ height: "2px", background: "rgba(255,255,255,0.04)" }}>
                    <div className="scan-bar" style={{ height: "100%", background: "linear-gradient(90deg, #8b5cf6, #a78bfa, #8b5cf6)", backgroundSize: "200% 100%" }} />
                  </div>
                )}

                <textarea
                  ref={textareaRef}
                  value={text}
                  onChange={e => {
                    setText(e.target.value);
                    if (result) { setResult(null); setHumanizedText(null); setHumanizedScore(null); }
                  }}
                  placeholder={"Paste or type AI-generated text here…\n\nTip: try text that starts with \"In today's rapidly evolving landscape\" or uses words like \"furthermore\", \"pivotal\", \"paradigm\""}
                  style={{
                    width: "100%", minHeight: "280px", padding: "16px",
                    background: "transparent", border: "none", outline: "none",
                    resize: "vertical", color: "#f0f0f8", fontSize: "14px",
                    lineHeight: 1.8, fontFamily: "inherit", boxSizing: "border-box",
                    display: "block", opacity: analyzing ? 0.5 : 1, transition: "opacity 0.3s",
                  }}
                />

                {/* Intensity slider */}
                <div style={{
                  padding: "8px 14px", borderTop: "1px solid rgba(255,255,255,0.05)",
                  display: "flex", alignItems: "center", gap: "10px",
                }}>
                  <SlidersHorizontal size={11} color="rgba(255,255,255,0.25)" />
                  <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.25)", flexShrink: 0 }}>Intensity</span>
                  <div style={{ display: "flex", alignItems: "center", gap: "2px", flex: 1, maxWidth: "220px" }}>
                    {INTENSITIES.map(({ value, label }) => (
                      <button key={value} onClick={() => setIntensity(value)} style={{
                        flex: 1, padding: "4px 0", borderRadius: "4px", fontSize: "10px", fontWeight: 600,
                        cursor: "pointer", border: "none", transition: "all 0.15s",
                        background: intensity === value
                          ? value === "light" ? "rgba(34,197,94,0.15)" : value === "medium" ? "rgba(249,115,22,0.15)" : "rgba(239,68,68,0.15)"
                          : "rgba(255,255,255,0.03)",
                        color: intensity === value
                          ? value === "light" ? "#22c55e" : value === "medium" ? "#f97316" : "#ef4444"
                          : "rgba(255,255,255,0.2)",
                      }}>{label}</button>
                    ))}
                  </div>
                  <span style={{ fontSize: "9px", color: "rgba(255,255,255,0.18)", flexShrink: 0 }}>
                    {INTENSITIES.find(i => i.value === intensity)?.desc}
                  </span>
                </div>

                {/* Toolbar */}
                <div style={{
                  padding: "10px 14px", borderTop: "1px solid rgba(255,255,255,0.05)",
                  display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px",
                }}>
                  <span style={{ fontSize: "11px", color: wordCountColor, fontVariantNumeric: "tabular-nums", transition: "color 0.3s" }}>
                    {wordCount > 0 ? `${wordCount.toLocaleString()} words` : "Paste text to get started"}
                  </span>
                  <button
                    onClick={() => void handleAnalyze()}
                    disabled={!canAnalyze}
                    style={{
                      display: "flex", alignItems: "center", gap: "7px",
                      padding: "10px 22px", borderRadius: "8px", border: "none",
                      background: canAnalyze ? "linear-gradient(135deg, #8b5cf6, #7c3aed)" : "rgba(139,92,246,0.12)",
                      color: canAnalyze ? "#fff" : "rgba(255,255,255,0.2)",
                      fontSize: "13px", fontWeight: 700,
                      cursor: canAnalyze ? "pointer" : "not-allowed",
                      transition: "all 0.2s", flexShrink: 0,
                      boxShadow: canAnalyze ? "0 4px 16px rgba(139,92,246,0.3)" : "none",
                    }}
                  >
                    {analyzing ? (
                      <><div className="spin-sm" /> Scanning…</>
                    ) : (
                      <><Zap size={13} /> {result ? "Re-analyze" : "Analyze"} <ArrowRight size={11} /></>
                    )}
                  </button>
                </div>
              </div>

              {/* Paragraph Mode Cards */}
              {paragraphMode && result && paragraphs.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px", animation: "fadeInUp 0.3s ease" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "2px" }}>
                    <Rows3 size={12} color="#a78bfa" />
                    <span style={{ fontSize: "12px", fontWeight: 600, color: "rgba(255,255,255,0.5)" }}>
                      {paragraphs.length} paragraph{paragraphs.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                  {paragraphs.map((para, idx) => {
                    const score = paraScores[idx];
                    const hText = paraHumanized[idx];
                    const isHumanizing = paraHumanizing[idx] ?? false;
                    const scoreColor = score === null || score === undefined ? "rgba(255,255,255,0.1)"
                      : score >= 75 ? "#ef4444" : score >= 50 ? "#f97316" : score >= 30 ? "#eab308" : "#22c55e";

                    return (
                      <div key={idx} style={{
                        background: "#0f0f12", borderRadius: "10px",
                        border: "1px solid rgba(255,255,255,0.06)",
                        overflow: "hidden",
                      }}>
                        <div style={{
                          height: "3px", background: "rgba(255,255,255,0.03)",
                          borderRadius: "10px 10px 0 0", overflow: "hidden",
                        }}>
                          <div style={{
                            height: "100%", width: score != null ? `${score}%` : "0%",
                            background: scoreColor,
                            transition: "width 0.5s ease, background 0.3s",
                          }} />
                        </div>
                        <div style={{
                          padding: "10px 14px",
                          display: "flex", alignItems: "flex-start", gap: "10px",
                        }}>
                          <div style={{
                            width: "8px", height: "8px", borderRadius: "50%",
                            background: scoreColor, flexShrink: 0, marginTop: "5px",
                            transition: "background 0.3s",
                          }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{
                              fontSize: "13px", lineHeight: 1.7,
                              color: hText ? "#22c55e" : "rgba(255,255,255,0.7)",
                              whiteSpace: "pre-wrap", wordBreak: "break-word",
                            }}>
                              {hText ?? para}
                            </div>
                            {score != null && (
                              <span style={{
                                fontSize: "10px", fontWeight: 600,
                                color: scoreColor, opacity: 0.7, marginTop: "4px", display: "inline-block",
                              }}>
                                {Math.round(score)}% AI
                              </span>
                            )}
                          </div>
                          <button
                            onClick={() => void handleHumanizeParagraph(idx)}
                            disabled={isHumanizing}
                            style={{
                              padding: "5px 10px", borderRadius: "6px", fontSize: "10px", fontWeight: 600,
                              border: "1px solid rgba(139,92,246,0.2)",
                              background: isHumanizing ? "rgba(139,92,246,0.08)" : "rgba(139,92,246,0.1)",
                              color: isHumanizing ? "rgba(255,255,255,0.3)" : "#a78bfa",
                              cursor: isHumanizing ? "not-allowed" : "pointer",
                              flexShrink: 0, transition: "all 0.15s",
                              display: "flex", alignItems: "center", gap: "4px",
                            }}
                          >
                            {isHumanizing ? <><div className="spin-sm" style={{ width: 8, height: 8, borderWidth: 1.5 }} /></> : <><Sparkles size={9} /> Humanize</>}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Humanized output */}
              {/* Humanized output */}
              {(humanizing || isDone) && (
                <div style={{
                  background: "#0f0f12", borderRadius: "12px",
                  border: `1.5px solid ${isDone ? "rgba(34,197,94,0.25)" : "rgba(139,92,246,0.2)"}`,
                  overflow: "hidden", animation: "fadeInUp 0.35s ease",
                }}>
                  {humanizing ? (
                    <HumanizingState />
                  ) : humanizedText && (
                    <>
                      <div style={{
                        padding: "12px 16px", borderBottom: "1px solid rgba(255,255,255,0.05)",
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          <span style={{ fontSize: "12px", fontWeight: 700, color: "#22c55e", display: "flex", alignItems: "center", gap: "5px" }}>
                            <CheckCircle2 size={13} /> Humanized
                          </span>
                          {humanizedScore !== null && result && (
                            <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                              <span style={{ fontSize: "11px", padding: "2px 7px", borderRadius: "4px", fontWeight: 700, background: "rgba(239,68,68,0.1)", color: "#ef4444", textDecoration: "line-through", opacity: 0.6 }}>
                                {Math.round(result.score)}%
                              </span>
                              <ArrowRight size={9} color="rgba(255,255,255,0.2)" />
                              <span style={{
                                fontSize: "11px", padding: "2px 7px", borderRadius: "4px", fontWeight: 700,
                                background: humanizedScore < 30 ? "rgba(34,197,94,0.12)" : "rgba(249,115,22,0.1)",
                                color: humanizedScore < 30 ? "#22c55e" : "#f97316",
                                animation: "popIn 0.4s ease",
                              }}>
                                {Math.round(humanizedScore)}%
                              </span>
                            </div>
                          )}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          {/* Diff view toggle */}
                          <button onClick={() => setShowDiff(d => !d)} style={{
                            display: "flex", alignItems: "center", gap: "4px",
                            background: showDiff ? "rgba(139,92,246,0.1)" : "rgba(255,255,255,0.05)",
                            border: `1px solid ${showDiff ? "rgba(139,92,246,0.25)" : "rgba(255,255,255,0.08)"}`,
                            borderRadius: "5px", padding: "5px 10px", cursor: "pointer",
                            color: showDiff ? "#a78bfa" : "rgba(255,255,255,0.45)", fontSize: "11px",
                            transition: "all 0.2s",
                          }}>
                            <GitCompareArrows size={10} /> {showDiff ? "Clean View" : "Diff View"}
                          </button>
                          {/* Export buttons */}
                          <button onClick={() => void handleExportDocx()} title="Download .docx" style={{
                            display: "flex", alignItems: "center", gap: "4px",
                            background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)",
                            borderRadius: "5px", padding: "5px 8px", cursor: "pointer",
                            color: "rgba(255,255,255,0.45)", fontSize: "11px", transition: "all 0.2s",
                          }}>
                            <FileText size={10} /> .docx
                          </button>
                          <button onClick={handleExportPdf} title="Download PDF" style={{
                            display: "flex", alignItems: "center", gap: "4px",
                            background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)",
                            borderRadius: "5px", padding: "5px 8px", cursor: "pointer",
                            color: "rgba(255,255,255,0.45)", fontSize: "11px", transition: "all 0.2s",
                          }}>
                            <FileDown size={10} /> PDF
                          </button>
                          <button onClick={() => void handleCopy()} style={{
                            display: "flex", alignItems: "center", gap: "5px",
                            background: copied ? "rgba(34,197,94,0.1)" : "rgba(255,255,255,0.05)",
                            border: `1px solid ${copied ? "rgba(34,197,94,0.2)" : "rgba(255,255,255,0.08)"}`,
                            borderRadius: "5px", padding: "5px 10px", cursor: "pointer",
                            color: copied ? "#22c55e" : "rgba(255,255,255,0.45)", fontSize: "11px",
                            transition: "all 0.2s",
                          }}>
                            <Copy size={10} /> {copied ? "Copied!" : "Copy"}
                          </button>
                        </div>
                      </div>
                      <div style={{
                        padding: "16px", fontSize: "14px", lineHeight: 1.8,
                        color: "rgba(255,255,255,0.82)", whiteSpace: "pre-wrap",
                        maxHeight: "380px", overflow: "auto",
                      }}>
                        {showDiff ? (
                          computeWordDiff(text, humanizedText).map((seg: DiffSegment, i: number) => (
                            <span key={i} style={
                              seg.type === "removed" ? { background: "rgba(239,68,68,0.15)", color: "#ef4444", textDecoration: "line-through", borderRadius: "2px", padding: "0 1px" }
                              : seg.type === "added" ? { background: "rgba(34,197,94,0.15)", color: "#22c55e", borderRadius: "2px", padding: "0 1px" }
                              : {}
                            }>{seg.text}</span>
                          ))
                        ) : humanizedText}
                      </div>
                      <div style={{
                        padding: "10px 16px", borderTop: "1px solid rgba(255,255,255,0.05)",
                        display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap",
                      }}>
                        <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.2)", marginRight: "2px" }}>Try tone:</span>
                        {TONES.map(({ value, label, icon }) => (
                          <button key={value} onClick={() => { setTone(value); void handleHumanize(value); }} style={{
                            padding: "4px 10px", borderRadius: "20px", fontSize: "11px",
                            background: tone === value ? "rgba(139,92,246,0.12)" : "rgba(255,255,255,0.04)",
                            border: `1px solid ${tone === value ? "rgba(139,92,246,0.3)" : "rgba(255,255,255,0.07)"}`,
                            color: tone === value ? "#a78bfa" : "rgba(255,255,255,0.35)", cursor: "pointer",
                            transition: "all 0.15s",
                            display: "flex", alignItems: "center", gap: "3px",
                          }}><span style={{ fontSize: "11px" }}>{icon}</span>{label}</button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* ── RIGHT: Score + Patterns + Readability ── */}
            {showRightPanel && (
              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>

                {/* Score card */}
                <div style={{
                  background: analyzing ? "#0f0f12" : (scoreConfig?.dimColor ?? "#0f0f12"),
                  border: `1px solid ${analyzing ? "rgba(255,255,255,0.07)" : (scoreConfig?.border ?? "rgba(255,255,255,0.07)")}`,
                  borderRadius: "14px", padding: "22px",
                  animation: analyzing ? "none" : "fadeInUp 0.35s ease",
                  transition: "background 0.5s, border-color 0.5s",
                }}>
                  {analyzing ? (
                    /* Skeleton */
                    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
                        <div style={{ width: 140, height: 140, borderRadius: "50%", flexShrink: 0 }}>
                          <Skeleton width={140} height={140} radius={70} />
                        </div>
                        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "8px" }}>
                          <Skeleton width="70%" height={12} />
                          <Skeleton width="90%" height={10} />
                          <Skeleton width="55%" height={10} />
                        </div>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                        {[0, 1, 2, 3].map(i => <Skeleton key={i} height={52} radius={8} />)}
                      </div>
                    </div>
                  ) : result && scoreConfig && (
                    <>
                      <div style={{ display: "flex", alignItems: "center", gap: "20px", marginBottom: "18px" }}>
                        <ScoreRing score={result.score} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: "11px", fontWeight: 800, letterSpacing: "1.2px", color: scoreConfig.color, textTransform: "uppercase", marginBottom: "6px" }}>
                            {scoreConfig.label}
                          </div>
                          <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.45)", lineHeight: 1.6, marginBottom: "6px" }}>
                            {scoreConfig.desc}
                          </div>
                          <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.25)", background: "rgba(255,255,255,0.04)", padding: "2px 8px", borderRadius: "4px", display: "inline-block" }}>
                            {result.confidenceBand}
                          </div>
                        </div>
                      </div>
                      {/* Stats */}
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                        {[
                          { label: "Burstiness", val: result.stats.burstiness.toFixed(2), bad: result.stats.burstiness < 0.2, tip: "Sentence variation — low = AI uniform rhythm" },
                          { label: "Vocab Diversity", val: result.stats.typeTokenRatio.toFixed(2), bad: result.stats.typeTokenRatio < 0.4, tip: "Word variety — low = repetitive word reuse" },
                          { label: "Avg Sentence", val: `${result.stats.avgSentenceLength}w`, bad: result.stats.avgSentenceLength >= 18 && result.stats.avgSentenceLength <= 25, tip: "AI clusters around 18-25 words/sentence" },
                          { label: "Readability", val: result.stats.fleschReadingEase.toFixed(0), bad: result.stats.fleschReadingEase >= 40 && result.stats.fleschReadingEase <= 60, tip: "Flesch score — AI typically scores 40-60" },
                        ].map(({ label, val, bad, tip }) => (
                          <div key={label} title={tip} style={{ background: "rgba(0,0,0,0.25)", borderRadius: "8px", padding: "10px 12px", cursor: "help" }}>
                            <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.28)", marginBottom: "4px" }}>{label}</div>
                            <div style={{ fontSize: "18px", fontWeight: 800, color: bad ? "#f97316" : "#22c55e" }}>{val}</div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>

                {/* Readability Panel */}
                {result && (
                  <ReadabilityPanel originalText={text} humanizedText={humanizedText} />
                )}

                {/* Patterns */}
                {analyzing ? (
                  <div style={{ background: "#0f0f12", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "12px", padding: "14px", display: "flex", flexDirection: "column", gap: "8px" }}>
                    <Skeleton width="55%" height={11} />
                    {[0, 1, 2].map(i => <Skeleton key={i} height={36} radius={6} style={{ animationDelay: `${i * 0.15}s` }} />)}
                  </div>
                ) : result && result.patterns.length > 0 && (
                  <div style={{
                    background: "#0f0f12", borderRadius: "12px",
                    border: "1px solid rgba(255,255,255,0.06)", overflow: "hidden",
                    animation: "fadeInUp 0.4s ease 0.1s both",
                  }}>
                    <div style={{
                      padding: "12px 16px", borderBottom: "1px solid rgba(255,255,255,0.05)",
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                    }}>
                      <span style={{ fontSize: "12px", fontWeight: 600, color: "rgba(255,255,255,0.65)" }}>AI Patterns Detected</span>
                      <span style={{ fontSize: "11px", padding: "2px 8px", borderRadius: "4px", background: "rgba(139,92,246,0.1)", color: "#8b5cf6", fontWeight: 700 }}>
                        {result.patterns.length}
                      </span>
                    </div>
                    <div style={{ padding: "6px" }}>
                      {[...result.patterns]
                        .sort((a, b) => ({ critical: 0, high: 1, medium: 2, low: 3 }[a.severity] ?? 4) - ({ critical: 0, high: 1, medium: 2, low: 3 }[b.severity] ?? 4))
                        .slice(0, showAllPatterns ? undefined : 3)
                        .map((p, i) => (
                          <div key={p.id} style={{ opacity: i < visiblePatterns ? 1 : 0, transform: i < visiblePatterns ? "none" : "translateY(6px)", transition: "opacity 0.25s ease, transform 0.25s ease" }}>
                            <PatternCard pattern={p} />
                          </div>
                        ))
                      }
                    </div>
                    {result.patterns.length > 3 && (
                      <button
                        onClick={() => setShowAllPatterns(p => !p)}
                        style={{
                          width: "100%", padding: "9px", background: "rgba(255,255,255,0.02)",
                          border: "none", borderTop: "1px solid rgba(255,255,255,0.05)",
                          color: "rgba(255,255,255,0.3)", cursor: "pointer", fontSize: "11px",
                          display: "flex", alignItems: "center", justifyContent: "center", gap: "4px",
                        }}
                      >
                        {showAllPatterns ? <><ChevronUp size={11} /> Show less</> : <><ChevronDown size={11} /> +{result.patterns.length - 3} more</>}
                      </button>
                    )}
                  </div>
                )}

                {/* Humanize CTA */}
                {result && !humanizing && !isDone && (
                  <div style={{
                    background: "#0f0f12", borderRadius: "12px",
                    border: "1px solid rgba(139,92,246,0.15)", padding: "18px",
                    animation: "fadeInUp 0.4s ease 0.2s both",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "7px", marginBottom: "6px" }}>
                      <Sparkles size={13} color="#8b5cf6" />
                      <span style={{ fontSize: "13px", fontWeight: 600, color: "#fafafa" }}>Humanize with AI</span>
                    </div>
                    <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.3)", lineHeight: 1.6, marginBottom: "14px" }}>
                      Multi-pass rewrite · 3 attempts · picks the best result
                    </p>
                    <button
                      onClick={() => void handleHumanize()}
                      style={{
                        width: "100%", padding: "13px", borderRadius: "10px", border: "none",
                        background: "linear-gradient(135deg, #8b5cf6, #7c3aed)",
                        color: "#fff", fontSize: "14px", fontWeight: 700, cursor: "pointer",
                        display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
                        boxShadow: "0 4px 20px rgba(139,92,246,0.3)", transition: "all 0.2s",
                      }}
                    >
                      <Sparkles size={14} /> {scoreConfig?.ctaLabel ?? "Humanize"} <ArrowRight size={12} />
                    </button>
                  </div>
                )}

                {/* Re-humanize after done */}
                {isDone && result && (
                  <button
                    onClick={() => void handleHumanize()}
                    style={{
                      width: "100%", padding: "11px", borderRadius: "10px", border: "1px solid rgba(139,92,246,0.2)",
                      background: "rgba(139,92,246,0.08)", color: "#a78bfa",
                      fontSize: "13px", fontWeight: 600, cursor: "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
                      animation: "fadeInUp 0.3s ease",
                    }}
                  >
                    <RotateCcw size={12} /> Humanize again
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── BULK MODE ── */}
        {editorMode === "bulk" && (
          <div style={{ maxWidth: "900px", margin: "0 auto" }}>
            {/* Bulk textarea */}
            {bulkItems.length === 0 && (
              <div style={{
                background: "#0f0f12", borderRadius: "12px",
                border: "1.5px solid rgba(255,255,255,0.07)", overflow: "hidden",
              }}>
                <div style={{
                  padding: "10px 14px", borderBottom: "1px solid rgba(255,255,255,0.05)",
                  display: "flex", alignItems: "center", gap: "6px",
                }}>
                  <Layers size={12} color="#8b5cf6" />
                  <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)", fontWeight: 600 }}>Bulk Mode</span>
                  <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.2)", marginLeft: "auto" }}>Separate texts with ---</span>
                </div>
                <textarea
                  value={bulkText}
                  onChange={e => setBulkText(e.target.value)}
                  placeholder={"Paste multiple texts here, separated by --- on its own line.\n\nExample:\n\nFirst text goes here...\n\n---\n\nSecond text goes here...\n\n---\n\nThird text goes here..."}
                  style={{
                    width: "100%", minHeight: "320px", padding: "16px",
                    background: "transparent", border: "none", outline: "none",
                    resize: "vertical", color: "#f0f0f8", fontSize: "14px",
                    lineHeight: 1.8, fontFamily: "inherit", boxSizing: "border-box",
                    display: "block",
                  }}
                />
                <div style={{
                  padding: "10px 14px", borderTop: "1px solid rgba(255,255,255,0.05)",
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                }}>
                  <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.3)" }}>
                    {parseBulkTexts().length} text{parseBulkTexts().length !== 1 ? "s" : ""} detected
                  </span>
                  <button
                    onClick={() => void handleBulkAnalyze()}
                    disabled={parseBulkTexts().length === 0}
                    style={{
                      display: "flex", alignItems: "center", gap: "7px",
                      padding: "10px 22px", borderRadius: "8px", border: "none",
                      background: parseBulkTexts().length > 0 ? "linear-gradient(135deg, #8b5cf6, #7c3aed)" : "rgba(139,92,246,0.12)",
                      color: parseBulkTexts().length > 0 ? "#fff" : "rgba(255,255,255,0.2)",
                      fontSize: "13px", fontWeight: 700,
                      cursor: parseBulkTexts().length > 0 ? "pointer" : "not-allowed",
                      boxShadow: parseBulkTexts().length > 0 ? "0 4px 16px rgba(139,92,246,0.3)" : "none",
                    }}
                  >
                    <Zap size={13} /> Analyze All <ArrowRight size={11} />
                  </button>
                </div>
              </div>
            )}

            {/* Bulk progress */}
            {bulkProcessing && (
              <div style={{
                background: "rgba(139,92,246,0.06)", border: "1px solid rgba(139,92,246,0.2)",
                borderRadius: "10px", padding: "14px 18px", marginBottom: "16px",
                display: "flex", alignItems: "center", gap: "12px",
                animation: "fadeInUp 0.3s ease",
              }}>
                <div className="spin-sm" />
                <span style={{ fontSize: "13px", color: "#a78bfa", fontWeight: 600 }}>
                  Processing {bulkProgress.current}/{bulkProgress.total}...
                </span>
                <button onClick={() => { bulkAbortRef.current = true; }} style={{
                  marginLeft: "auto", padding: "4px 10px", borderRadius: "5px",
                  background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)",
                  color: "#ef4444", fontSize: "11px", cursor: "pointer",
                }}>Stop</button>
              </div>
            )}

            {/* Bulk results */}
            {bulkItems.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {/* Humanize All button */}
                {!bulkProcessing && bulkItems.some(i => i.status === "analyzed") && (
                  <div style={{ display: "flex", gap: "10px", marginBottom: "4px" }}>
                    <button onClick={() => void handleBulkHumanize()} style={{
                      flex: 1, padding: "13px", borderRadius: "10px", border: "none",
                      background: "linear-gradient(135deg, #8b5cf6, #7c3aed)",
                      color: "#fff", fontSize: "14px", fontWeight: 700, cursor: "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
                      boxShadow: "0 4px 20px rgba(139,92,246,0.3)",
                    }}>
                      <Sparkles size={14} /> Humanize All <ArrowRight size={12} />
                    </button>
                    <button onClick={() => { setBulkItems([]); setBulkText(""); }} style={{
                      padding: "13px 18px", borderRadius: "10px",
                      background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)",
                      color: "rgba(255,255,255,0.4)", fontSize: "13px", cursor: "pointer",
                      display: "flex", alignItems: "center", gap: "5px",
                    }}>
                      <RotateCcw size={12} /> Reset
                    </button>
                  </div>
                )}

                {/* Reset when all done */}
                {!bulkProcessing && bulkItems.every(i => i.status === "done" || i.status === "error") && bulkItems.some(i => i.status === "done") && (
                  <button onClick={() => { setBulkItems([]); setBulkText(""); }} style={{
                    padding: "11px", borderRadius: "10px",
                    background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)",
                    color: "rgba(255,255,255,0.4)", fontSize: "13px", cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: "5px",
                    marginBottom: "4px",
                  }}>
                    <RotateCcw size={12} /> Start New Batch
                  </button>
                )}

                {bulkItems.map((item) => {
                  const itemScore = item.result ? getScoreConfig(item.result.score) : null;
                  return (
                    <div key={item.id} style={{
                      background: "#0f0f12", borderRadius: "12px",
                      border: `1px solid ${item.status === "done" ? "rgba(34,197,94,0.2)" : item.status === "error" ? "rgba(239,68,68,0.2)" : "rgba(255,255,255,0.06)"}`,
                      overflow: "hidden", animation: "fadeInUp 0.3s ease",
                    }}>
                      {/* Card header */}
                      <div style={{
                        padding: "10px 14px", borderBottom: "1px solid rgba(255,255,255,0.04)",
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span style={{
                            fontSize: "11px", fontWeight: 700, color: "#8b5cf6",
                            background: "rgba(139,92,246,0.1)", padding: "2px 8px", borderRadius: "4px",
                          }}>#{item.id + 1}</span>
                          <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.3)" }}>
                            {item.text.split(/\s+/).length} words
                          </span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          {item.status === "analyzing" || item.status === "humanizing" ? (
                            <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                              <div className="spin-sm" />
                              <span style={{ fontSize: "10px", color: "#a78bfa" }}>
                                {item.status === "analyzing" ? "Analyzing" : "Humanizing"}
                              </span>
                            </div>
                          ) : item.status === "error" ? (
                            <span style={{ fontSize: "10px", color: "#ef4444" }}>{item.error}</span>
                          ) : item.result && (
                            <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                              <span style={{
                                fontSize: "11px", padding: "2px 8px", borderRadius: "4px", fontWeight: 700,
                                background: `${itemScore!.color}15`, color: itemScore!.color,
                              }}>
                                {Math.round(item.result.score)}%
                              </span>
                              {item.humanizedScore !== null && (
                                <>
                                  <ArrowRight size={9} color="rgba(255,255,255,0.2)" />
                                  <span style={{
                                    fontSize: "11px", padding: "2px 8px", borderRadius: "4px", fontWeight: 700,
                                    background: item.humanizedScore < 30 ? "rgba(34,197,94,0.12)" : "rgba(249,115,22,0.1)",
                                    color: item.humanizedScore < 30 ? "#22c55e" : "#f97316",
                                  }}>
                                    {Math.round(item.humanizedScore)}%
                                  </span>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Card body */}
                      <div style={{ padding: "12px 14px" }}>
                        <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.5)", lineHeight: 1.7, maxHeight: "80px", overflow: "hidden", position: "relative" }}>
                          {item.text.slice(0, 200)}{item.text.length > 200 ? "…" : ""}
                          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "30px", background: "linear-gradient(transparent, #0f0f12)" }} />
                        </div>
                        {item.humanizedText && (
                          <div style={{ marginTop: "10px", padding: "10px", borderRadius: "8px", background: "rgba(34,197,94,0.04)", border: "1px solid rgba(34,197,94,0.1)" }}>
                            <div style={{ fontSize: "10px", color: "#22c55e", fontWeight: 600, marginBottom: "6px", display: "flex", alignItems: "center", gap: "4px" }}>
                              <CheckCircle2 size={10} /> Humanized
                            </div>
                            <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.65)", lineHeight: 1.7, maxHeight: "120px", overflow: "auto" }}>
                              {item.humanizedText}
                            </div>
                            <button onClick={async () => {
                              await navigator.clipboard.writeText(item.humanizedText!);
                              toast.success(`Text #${item.id + 1} copied`);
                            }} style={{
                              marginTop: "6px", display: "flex", alignItems: "center", gap: "4px",
                              background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)",
                              borderRadius: "4px", padding: "3px 8px", cursor: "pointer",
                              color: "rgba(255,255,255,0.4)", fontSize: "10px",
                            }}>
                              <Copy size={9} /> Copy
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
      <UpgradeModal isOpen={showUpgradeModal} onClose={() => setShowUpgradeModal(false)} currentPlan={userPlan} />

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes shimmer { 0%,100% { background-position: 200% center; } 50% { background-position: 0% center; } }
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes popIn { from { opacity:0; transform: scale(0.8); } to { opacity:1; transform: scale(1); } }
        @keyframes scanAnim { 0% { background-position: 200% center; } 100% { background-position: -200% center; } }
        @keyframes pulse { 0%,100% { opacity:0.4; } 50% { opacity:1; } }
        @keyframes orb1 { 0%,100% { transform: translate(0,0); } 50% { transform: translate(8px,-10px); } }
        @keyframes orb2 { 0%,100% { transform: translate(0,0); } 50% { transform: translate(-10px,7px); } }
        @keyframes orb3 { 0%,100% { transform: translate(0,0); } 50% { transform: translate(7px,10px); } }
        @keyframes passGlow { 0%,100% { opacity:0.3; } 50% { opacity:1; border-color: rgba(139,92,246,0.5); } }
        @keyframes dotBlink { 0%,100% { opacity:0; } 50% { opacity:1; } }
        .dots span { animation: dotBlink 1.4s infinite; }
        .dots span:nth-child(2) { animation-delay: 0.2s; }
        .dots span:nth-child(3) { animation-delay: 0.4s; }
        .scan-bar { animation: scanAnim 1.8s linear infinite; }
        .scan-pulse { width: 6px; height: 6px; border-radius: 50%; background: #8b5cf6; animation: pulse 1s ease-in-out infinite; }
        .spin-sm { width: 12px; height: 12px; border-radius: 50%; border: 2px solid rgba(255,255,255,0.2); border-top-color: #fff; animation: spin 0.7s linear infinite; display: inline-block; flex-shrink: 0; }
        @media (max-width: 900px) { .editor-grid { grid-template-columns: 1fr !important; } }
      `}</style>
    </div>
  );
}
