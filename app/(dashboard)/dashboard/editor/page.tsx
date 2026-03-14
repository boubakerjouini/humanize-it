"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useAuth } from "@clerk/nextjs";
import { usePostHog } from "posthog-js/react";
import { track } from "@vercel/analytics";
import { PatternCard } from "@/components/ui/pattern-card";
import { AuthModal } from "@/components/ui/auth-modal";
import { UpgradeModal } from "@/components/ui/upgrade-modal";
import type { PatternHit } from "@/lib/algorithms/analyzeText";
import { computeReadability, type ReadabilityMetrics } from "@/lib/readability";
import { simulateEngineScores, type EngineScore } from "@/lib/engines";
import { Copy, RotateCcw, Zap, CheckCircle2, Sparkles, ArrowRight, ChevronDown, ChevronUp, SlidersHorizontal, GitCompareArrows, Rows3, Layers, BookOpen, Lock, Shield, Globe, X, Fingerprint, Upload, FileUp, Download } from "lucide-react";
import { ShareScore } from "@/components/ui/share-score";
import { toast } from "sonner";
import { computeWordDiff, type DiffSegment } from "@/lib/utils/wordDiff";
import { UploadZone } from "@/components/ui/upload-zone";
import { PLANS, type PlanId } from "@/lib/plans";
import type { ExtractResult } from "@/lib/extract-document";

type ToneOption = "standard" | "formal" | "casual" | "academic" | "storytelling" | "professional";
type IntensityLevel = "light" | "medium" | "heavy";
type EditorMode = "single" | "bulk";
type LanguageOption = "English" | "French" | "Spanish" | "Arabic" | "German" | "Italian";

const LANGUAGES: { value: LanguageOption; label: string; flag: string }[] = [
  { value: "English", label: "English", flag: "\ud83c\uddec\ud83c\udde7" },
  { value: "French", label: "French", flag: "\ud83c\uddeb\ud83c\uddf7" },
  { value: "Spanish", label: "Spanish", flag: "\ud83c\uddea\ud83c\uddf8" },
  { value: "Arabic", label: "Arabic", flag: "\ud83c\uddf8\ud83c\udde6" },
  { value: "German", label: "German", flag: "\ud83c\udde9\ud83c\uddea" },
  { value: "Italian", label: "Italian", flag: "\ud83c\uddee\ud83c\uddf9" },
];

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
  if (score >= 75) return { label: "FLAGGED AS AI", desc: "Will be caught by GPTZero, Turnitin & Originality.ai", color: "#dc2626", dimColor: "rgba(220,38,38,0.06)", border: "rgba(220,38,38,0.2)", ctaLabel: "Fix it — Humanize now" };
  if (score >= 50) return { label: "LIKELY AI", desc: "Most detectors will flag this text", color: "#f97316", dimColor: "rgba(249,115,22,0.06)", border: "rgba(249,115,22,0.2)", ctaLabel: "Humanize to reduce risk" };
  if (score >= 30) return { label: "BORDERLINE", desc: "Some detectors may flag this", color: "#d97706", dimColor: "rgba(217,119,6,0.06)", border: "rgba(217,119,6,0.18)", ctaLabel: "Polish to pass safely" };
  return { label: "LOOKS HUMAN", desc: "Should pass most AI detectors", color: "#16a34a", dimColor: "rgba(22,163,74,0.06)", border: "rgba(22,163,74,0.18)", ctaLabel: "Polish it further" };
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
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#e5e7eb" strokeWidth={strokeWidth} />
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
        <div style={{ fontSize: "48px", fontWeight: 800, color: "#0a0a0a", lineHeight: 1, letterSpacing: "-2px", fontVariantNumeric: "tabular-nums", fontFamily: "var(--font-heading)" }}>
          {displayed}
        </div>
        <div style={{ fontSize: "11px", color: "#4b5563", marginTop: "2px" }}>Human Score</div>
      </div>
    </div>
  );
}

// Skeleton shimmer block
function Skeleton({ width = "100%", height = 16, radius = 6, style = {} }: { width?: string | number; height?: number; radius?: number; style?: React.CSSProperties }) {
  return (
    <div style={{
      width, height, borderRadius: radius,
      background: "linear-gradient(90deg, rgba(0,0,0,0.04) 0%, rgba(0,0,0,0.08) 50%, rgba(0,0,0,0.04) 100%)",
      backgroundSize: "200% 100%",
      animation: "shimmer 1.5s infinite",
      ...style,
    }} />
  );
}

// Humanizing orb animation
function HumanizingState({ chunkProgress, passInfo }: { chunkProgress?: { current: number; total: number } | null; passInfo?: { current: number; scores: number[] } | null }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      padding: "40px 24px", gap: "20px",
      animation: "fadeInUp 0.3s ease",
    }}>
      <div style={{ position: "relative", width: "64px", height: "64px" }}>
        {[
          { size: 32, top: "16px", left: "16px", delay: "0s", color: "rgba(124,58,237,0.9)" },
          { size: 22, top: "4px", left: "6px", delay: "0.3s", color: "rgba(124,58,237,0.7)" },
          { size: 18, top: "auto", left: "auto", delay: "0.6s", color: "rgba(124,58,237,0.5)" },
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
        <p style={{ fontSize: "14px", fontWeight: 600, color: "#111827", textAlign: "center", marginBottom: "6px" }}>
          {chunkProgress && chunkProgress.total > 1
            ? `Humanizing chunk ${chunkProgress.current} of ${chunkProgress.total}`
            : passInfo && passInfo.current > 1
              ? `Pass ${passInfo.current - 1} complete (score: ${passInfo.scores[passInfo.scores.length - 1]}%) — running pass ${passInfo.current}...`
              : <>AI is rewriting your text<span className="dots"><span>.</span><span>.</span><span>.</span></span></>
          }
        </p>
        <p style={{ fontSize: "12px", color: "#4b5563", textAlign: "center" }}>
          {chunkProgress && chunkProgress.total > 1
            ? "Processing large document in sections"
            : "Multi-pass engine · up to 3 attempts · picking the best"
          }
        </p>
      </div>
      {chunkProgress && chunkProgress.total > 1 ? (
        <div style={{ width: "200px" }}>
          <div style={{ height: "6px", borderRadius: "3px", background: "#f3f4f6", overflow: "hidden" }}>
            <div style={{
              height: "100%", borderRadius: "3px",
              background: "linear-gradient(90deg, #7c3aed, #6d28d9)",
              width: `${(chunkProgress.current / chunkProgress.total) * 100}%`,
              transition: "width 0.4s ease",
            }} />
          </div>
          <p style={{ fontSize: "10px", color: "#4b5563", textAlign: "center", marginTop: "6px" }}>
            {Math.round((chunkProgress.current / chunkProgress.total) * 100)}%
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", gap: "6px" }}>
          {["Pass 1", "Pass 2", "Pass 3"].map((p, i) => {
            const passNum = i + 1;
            const currentPass = passInfo?.current ?? 1;
            const isActive = passNum === currentPass;
            const isDone = passNum < currentPass;
            return (
              <div key={p} style={{
                fontSize: "10px",
                color: isDone ? "#16a34a" : isActive ? "#7c3aed" : "#4b5563",
                padding: "3px 8px", borderRadius: "4px",
                background: isDone ? "#f0fdf4" : isActive ? "#f3e8ff" : "#faf5ff",
                border: `1px solid ${isDone ? "rgba(22,163,74,0.25)" : isActive ? "rgba(124,58,237,0.3)" : "rgba(124,58,237,0.15)"}`,
                fontWeight: isActive ? 700 : 400,
                ...(isActive ? { animation: `passGlow 1.8s ease-in-out infinite` } : {}),
              }}>
                {isDone ? `${p} ✓` : p}
                {isDone && passInfo?.scores[i] !== undefined ? ` ${passInfo.scores[i]}%` : ""}
              </div>
            );
          })}
        </div>
      )}
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
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #f3f4f6" }}>
      <span style={{ fontSize: "11px", color: "#374151", flex: 1 }}>{label}</span>
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <span style={{ fontSize: "12px", fontWeight: 700, color: originalColor, minWidth: "50px", textAlign: "right" }}>{originalVal}</span>
        {humanizedVal !== undefined && (
          <>
            <ArrowRight size={9} color="#d1d5db" />
            <span style={{ fontSize: "12px", fontWeight: 700, color: humanizedColor ?? originalColor, minWidth: "50px", textAlign: "right" }}>{humanizedVal}</span>
          </>
        )}
      </div>
    </div>
  );

  return (
    <div style={{
      background: "#ffffff", borderRadius: "12px",
      border: "1px solid #f0f0f0", overflow: "hidden",
      animation: "fadeInUp 0.4s ease 0.15s both",
    }}>
      <button
        onClick={() => setExpanded(e => !e)}
        style={{
          width: "100%", padding: "12px 16px",
          background: "transparent", border: "none",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          cursor: "pointer", color: "#4b5563",
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: "7px", fontSize: "12px", fontWeight: 600 }}>
          <BookOpen size={13} color="#7c3aed" /> Readability Analysis
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{
            fontSize: "11px", padding: "2px 8px", borderRadius: "4px",
            background: `${original.fleschColor}15`, color: original.fleschColor,
            fontWeight: 700,
          }}>
            {original.fleschLabel}
          </span>
          {expanded ? <ChevronUp size={13} color="#4b5563" /> : <ChevronDown size={13} color="#4b5563" />}
        </div>
      </button>
      {expanded && (
        <div style={{ padding: "4px 16px 14px", animation: "fadeInUp 0.2s ease" }}>
          {humanized && (
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "24px", marginBottom: "4px", paddingBottom: "6px", borderBottom: "1px solid #e5e7eb" }}>
              <span style={{ fontSize: "9px", color: "#4b5563", textTransform: "uppercase", letterSpacing: "0.5px" }}>Original</span>
              <span style={{ fontSize: "9px", color: "#4b5563", textTransform: "uppercase", letterSpacing: "0.5px", marginRight: "4px" }}>Humanized</span>
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
            originalColor="#4b5563"
            humanizedVal={humanized ? `${humanized.readingTimeMinutes} min` : undefined}
            humanizedColor="#4b5563"
          />
          <MetricRow
            label="Avg Sentence Length"
            originalVal={`${original.avgSentenceLength}w`}
            originalColor={original.avgSentenceLength >= 18 && original.avgSentenceLength <= 25 ? "#f97316" : "#16a34a"}
            humanizedVal={humanized ? `${humanized.avgSentenceLength}w` : undefined}
            humanizedColor={humanized ? (humanized.avgSentenceLength >= 18 && humanized.avgSentenceLength <= 25 ? "#f97316" : "#16a34a") : undefined}
          />
          <MetricRow
            label="Vocabulary Richness"
            originalVal={`${original.vocabularyRichness}%`}
            originalColor={original.vocabularyRichness < 40 ? "#f97316" : "#16a34a"}
            humanizedVal={humanized ? `${humanized.vocabularyRichness}%` : undefined}
            humanizedColor={humanized ? (humanized.vocabularyRichness < 40 ? "#f97316" : "#16a34a") : undefined}
          />
          <MetricRow
            label="Grade Level"
            originalVal={`${original.gradeLevel}`}
            originalColor={original.gradeLevel > 12 ? "#f97316" : "#16a34a"}
            humanizedVal={humanized ? `${humanized.gradeLevel}` : undefined}
            humanizedColor={humanized ? (humanized.gradeLevel > 12 ? "#f97316" : "#16a34a") : undefined}
          />
          <div style={{ marginTop: "6px", display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontSize: "10px", color: "#4b5563" }}>
              Grade: {original.gradeLevelLabel}
            </span>
            {humanized && (
              <span style={{ fontSize: "10px", color: "#4b5563" }}>
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
  const [engineScores, setEngineScores] = useState<EngineScore[] | null>(null);
  const [humanizedEngineScores, setHumanizedEngineScores] = useState<EngineScore[] | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Bulk mode state
  const [editorMode, setEditorMode] = useState<EditorMode>("single");
  const [bulkText, setBulkText] = useState("");
  const [bulkItems, setBulkItems] = useState<BulkItem[]>([]);
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0 });
  const [userPlan, setUserPlan] = useState<string>("FREE");
  const bulkAbortRef = useRef(false);

  // Style Clone state
  const [styleOpen, setStyleOpen] = useState(false);
  const [styleSamples, setStyleSamples] = useState<string[]>(["", ""]);
  const [styleFingerprint, setStyleFingerprint] = useState<Record<string, string> | null>(null);
  const [styleLoading, setStyleLoading] = useState(false);

  // Language state
  const [language, setLanguage] = useState<LanguageOption>("English");
  const [langOpen, setLangOpen] = useState(false);

  // Upload state
  const [inputMode, setInputMode] = useState<"paste" | "upload">("paste");
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);

  // Chunked humanization state
  const [chunkProgress, setChunkProgress] = useState<{ current: number; total: number } | null>(null);
  const chunkAbortRef = useRef(false);

  // Multi-pass state
  const [passInfo, setPassInfo] = useState<{ current: number; scores: number[] } | null>(null);
  const [passCount, setPassCount] = useState<number>(1);
  const [scoreHistory, setScoreHistory] = useState<number[]>([]);

  // Fetch user plan
  useEffect(() => {
    fetch("/api/user-plan").then(r => r.ok ? r.json() : null).then((d: { plan?: string } | null) => {
      if (d?.plan) setUserPlan(d.plan);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const prefill = sessionStorage.getItem("prefill-text");
    if (prefill) { setText(prefill); sessionStorage.removeItem("prefill-text"); }
    // Load style fingerprint from localStorage
    try {
      const saved = localStorage.getItem("style-fingerprint");
      if (saved) setStyleFingerprint(JSON.parse(saved));
    } catch { /* ignore */ }
    // Load language preference
    const savedLang = localStorage.getItem("language-preference") as LanguageOption | null;
    if (savedLang && LANGUAGES.some(l => l.value === savedLang)) setLanguage(savedLang);
    // Fetch user plan for style clone gating
    fetch("/api/user-plan").then(r => r.json()).then(d => setUserPlan(d.plan ?? "FREE")).catch(() => setUserPlan("FREE"));
  }, []);

  useEffect(() => {
    fetch("/api/user-plan").then(r => r.json()).then(d => setUserPlan(d.plan ?? "FREE")).catch(() => setUserPlan("FREE"));
  }, []);

  // Welcome toast for first-time visitors
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!localStorage.getItem("humanizeit_first_visit")) {
      localStorage.setItem("humanizeit_first_visit", "true");
      toast("Welcome! Paste your AI text below to get started \u2192", { duration: 5000 });
    }
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
    setEngineScores(null);
    setHumanizedEngineScores(null);

    try {
      const res = await fetch("/api/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) });
      const data = await res.json() as AnalyzeResponse & { error?: { message: string } };
      if (res.status === 402) { setShowUpgradeModal(true); return; }
      if (!res.ok) { toast.error(data.error?.message ?? "Analysis failed."); return; }
      setResult(data);
      if (userPlan === "PRO" || userPlan === "TEAM") {
        setEngineScores(simulateEngineScores(data.score));
      }
      posthog?.capture("analysis_completed", { score: data.score, pattern_count: data.patterns.length });
    } catch { toast.error("Network error. Please try again."); }
    finally { setAnalyzing(false); }
  }, [text, canAnalyze, wordCount, posthog, userPlan]);

  // Split text into chunks at paragraph boundaries
  const splitIntoChunks = useCallback((inputText: string, maxWords: number): string[] => {
    const paragraphs = inputText.split(/\n\n+/);
    const chunks: string[] = [];
    let current: string[] = [];
    let currentWords = 0;

    for (const para of paragraphs) {
      const paraWords = para.split(/\s+/).filter(Boolean).length;
      if (currentWords + paraWords > maxWords && current.length > 0) {
        chunks.push(current.join("\n\n"));
        current = [para];
        currentWords = paraWords;
      } else {
        current.push(para);
        currentWords += paraWords;
      }
    }
    if (current.length > 0) chunks.push(current.join("\n\n"));
    return chunks;
  }, []);

  // Run a single humanization pass (analyze input text, then humanize)
  const runSinglePass = useCallback(async (inputText: string, documentId: string, useTone: ToneOption, passIntensity: IntensityLevel, aggressiveHint?: string): Promise<{ text: string; score: number; docId: string } | null> => {
    // For pass 2+, we need to re-analyze the humanized text to get a new documentId
    let docId = documentId;
    if (inputText !== text) {
      const analyzeRes = await fetch("/api/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: inputText.slice(0, 5000) }) });
      if (!analyzeRes.ok) return null;
      const analyzeData = await analyzeRes.json() as AnalyzeResponse;
      docId = analyzeData.documentId;
    }

    const res = await fetch("/api/humanize", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ documentId: docId, tone: useTone, intensity: passIntensity, styleFingerprint: styleFingerprint ?? undefined, language: language !== "English" ? language : undefined, ...(aggressiveHint ? { aggressiveHint } : {}) }) });
    const data = await res.json() as { humanizedText?: string; error?: { message: string } };
    if (res.status === 402) { setShowUpgradeModal(true); return null; }
    if (!res.ok) { toast.error(data.error?.message ?? "Humanization failed."); return null; }

    const humanized = data.humanizedText ?? "";
    // Score the result
    let score = 0;
    try {
      const reRes = await fetch("/api/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: humanized.slice(0, 5000) }) });
      if (reRes.ok) {
        const reData = await reRes.json() as AnalyzeResponse;
        score = reData.score;
        docId = reData.documentId;
      }
    } catch { /* ignore */ }

    return { text: humanized, score, docId };
  }, [text, styleFingerprint, language]);

  const handleHumanize = useCallback(async (overrideTone?: ToneOption) => {
    if (!result) return;
    if (!isSignedIn) { setShowAuthModal(true); return; }
    const useTone = overrideTone ?? tone;
    posthog?.capture("humanize_clicked", { tone: useTone, score: result.score });
    track("humanize_clicked", { tone: useTone, score: result.score });
    setHumanizing(true);
    setHumanizedText(null);
    setHumanizedScore(null);
    setChunkProgress(null);
    setPassInfo({ current: 1, scores: [] });
    setPassCount(1);
    setScoreHistory([]);
    chunkAbortRef.current = false;

    const needsChunking = wordCount > 1500;
    const SCORE_THRESHOLD = 45;
    const MAX_PASSES = 3;

    try {
      let finalText: string;

      if (needsChunking) {
        // Chunked humanization (no multi-pass for chunks — too expensive)
        const chunks = splitIntoChunks(text, 1500);
        setChunkProgress({ current: 0, total: chunks.length });
        const results: string[] = [];

        for (let i = 0; i < chunks.length; i++) {
          if (chunkAbortRef.current) { toast.error("Humanization cancelled."); return; }
          setChunkProgress({ current: i + 1, total: chunks.length });

          const analyzeRes = await fetch("/api/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: chunks[i] }) });
          if (!analyzeRes.ok) { toast.error(`Chunk ${i + 1} analysis failed.`); return; }
          const analyzeData = await analyzeRes.json() as AnalyzeResponse;

          const res = await fetch("/api/humanize", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ documentId: analyzeData.documentId, tone: useTone, intensity, styleFingerprint: styleFingerprint ?? undefined, language: language !== "English" ? language : undefined }) });
          const data = await res.json() as { humanizedText?: string; error?: { message: string } };
          if (res.status === 402) { setShowUpgradeModal(true); return; }
          if (!res.ok) { toast.error(data.error?.message ?? `Chunk ${i + 1} failed. Try again.`); return; }
          results.push(data.humanizedText ?? chunks[i]);
        }

        finalText = results.join("\n\n");
      } else {
        // Single-chunk flow with multi-pass
        const pass1 = await runSinglePass(text, result.documentId, useTone, intensity);
        if (!pass1) return;

        finalText = pass1.text;
        const scores: number[] = [pass1.score];
        setPassInfo({ current: 1, scores });
        setScoreHistory(scores);
        let passes = 1;

        // Auto pass 2 if score >= threshold
        if (pass1.score >= SCORE_THRESHOLD && passes < MAX_PASSES) {
          passes++;
          setPassInfo({ current: 2, scores: [...scores] });
          const pass2 = await runSinglePass(pass1.text, pass1.docId, useTone, "heavy");
          if (!pass2) return;
          finalText = pass2.text;
          scores.push(pass2.score);
          setPassInfo({ current: 2, scores: [...scores] });
          setScoreHistory([...scores]);

          // Auto pass 3 if still >= threshold — with aggressive hint
          if (pass2.score >= SCORE_THRESHOLD && passes < MAX_PASSES) {
            passes++;
            setPassInfo({ current: 3, scores: [...scores] });
            const pass3 = await runSinglePass(pass2.text, pass2.docId, useTone, "heavy", "The text still shows AI patterns. Be more aggressive in varying sentence structure, vocabulary, and style.");
            if (!pass3) return;
            finalText = pass3.text;
            scores.push(pass3.score);
            setPassInfo({ current: 3, scores: [...scores] });
            setScoreHistory([...scores]);
          }
        }

        setPassCount(passes);
      }

      setHumanizedText(finalText);
      if (finalText) {
        try {
          const reRes = await fetch("/api/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: finalText.slice(0, 5000) }) });
          if (reRes.ok) {
            const reData = await reRes.json() as AnalyzeResponse;
            setHumanizedScore(reData.score);
            if (userPlan === "PRO" || userPlan === "TEAM") {
              setHumanizedEngineScores(simulateEngineScores(reData.score));
            }
          }
        } catch { /* ignore */ }
      }
      posthog?.capture("humanize_completed", { tone: useTone, original_score: result.score, passes: passCount });
    } catch { toast.error("Network error. Please try again."); }
    finally { setHumanizing(false); setChunkProgress(null); setPassInfo(null); }
  }, [result, tone, isSignedIn, posthog, userPlan, styleFingerprint, language, wordCount, text, splitIntoChunks, intensity, runSinglePass, passCount]);

  const handleCopy = useCallback(async () => {
    if (!humanizedText) return;
    await navigator.clipboard.writeText(humanizedText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    posthog?.capture("text_copied");
  }, [humanizedText, posthog]);

  const handleUploadExtracted = useCallback((extracted: ExtractResult) => {
    setText(extracted.text);
    setUploadedFileName(extracted.fileName);
    setInputMode("paste");
    setResult(null);
    setHumanizedText(null);
    setHumanizedScore(null);
    toast.success(`Loaded ${extracted.fileName} — ${extracted.wordCount.toLocaleString()} words`);
  }, []);

  const handleDownloadTxt = useCallback(() => {
    if (!humanizedText) return;
    const blob = new Blob([humanizedText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const baseName = uploadedFileName
      ? uploadedFileName.replace(/\.[^.]+$/, "")
      : `text-${Date.now()}`;
    a.href = url;
    a.download = `humanized-${baseName}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    posthog?.capture("download_txt");
    toast.success("Downloaded .txt");
  }, [humanizedText, uploadedFileName, posthog]);

  const handleReset = () => {
    setResult(null);
    setHumanizedText(null);
    setHumanizedScore(null);
    setShowAllPatterns(false);
    setParaScores({});
    setParaHumanized({});
    setParaHumanizing({});
    setUploadedFileName(null);
    setPassInfo(null);
    setPassCount(1);
    setScoreHistory([]);
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

  const handleLearnStyle = useCallback(async () => {
    const validSamples = styleSamples.filter(s => s.trim().length >= 50);
    if (validSamples.length < 2) { toast.error("Provide at least 2 samples (50+ chars each)."); return; }
    setStyleLoading(true);
    try {
      const res = await fetch("/api/style-clone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ samples: validSamples }),
      });
      const data = await res.json() as { fingerprint?: Record<string, string>; error?: { message: string } };
      if (res.status === 403) { toast.error("Style Clone requires a Pro or Team plan."); return; }
      if (!res.ok) { toast.error(data.error?.message ?? "Failed to analyze style."); return; }
      if (data.fingerprint) {
        setStyleFingerprint(data.fingerprint);
        localStorage.setItem("style-fingerprint", JSON.stringify(data.fingerprint));
        toast.success("Style fingerprint learned!");
        setStyleOpen(false);
      }
    } catch { toast.error("Network error."); }
    finally { setStyleLoading(false); }
  }, [styleSamples]);

  const handleClearStyle = () => {
    setStyleFingerprint(null);
    localStorage.removeItem("style-fingerprint");
    toast.success("Style cleared.");
  };

  const handleLanguageChange = (lang: LanguageOption) => {
    setLanguage(lang);
    localStorage.setItem("language-preference", lang);
    setLangOpen(false);
  };

  const isRTL = language === "Arabic";
  const isPaidPlan = userPlan === "PRO" || userPlan === "TEAM";

  // Word count color
  const wordCountColor = wordCount === 0 ? "#4b5563"
    : wordCount > 1800 ? "#dc2626"
    : wordCount > 1500 ? "#d97706"
    : "#16a34a";

  const showRightPanel = result || analyzing;

  return (
    <div style={{ minHeight: "100%", background: "#ffffff", display: "flex", flexDirection: "column" }}>

      {/* ── Header ── */}
      <div style={{
        padding: "12px 24px",
        borderBottom: "1px solid #e5e7eb",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        flexShrink: 0, gap: "12px", flexWrap: "wrap",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <Sparkles size={15} color="#7c3aed" />
          <h1 style={{ fontSize: "14px", fontWeight: 700, color: "#0a0a0a", margin: 0, fontFamily: "var(--font-heading)" }}>Editor</h1>

          {/* Mode toggle */}
          <div style={{ display: "flex", gap: "2px", background: "#f9fafb", borderRadius: "6px", padding: "2px" }}>
            <button onClick={() => setEditorMode("single")} style={{
              padding: "4px 10px", borderRadius: "4px", fontSize: "11px", fontWeight: 500, cursor: "pointer",
              border: "none",
              background: editorMode === "single" ? "#f3e8ff" : "transparent",
              color: editorMode === "single" ? "#7c3aed" : "#374151",
              transition: "all 0.15s",
            }}>Single</button>
            <button onClick={() => {
              if (userPlan === "FREE" && !isSignedIn) { setShowAuthModal(true); return; }
              if (userPlan === "FREE") { setShowUpgradeModal(true); return; }
              setEditorMode("bulk");
            }} style={{
              padding: "4px 10px", borderRadius: "4px", fontSize: "11px", fontWeight: 500, cursor: "pointer",
              border: "none",
              background: editorMode === "bulk" ? "#f3e8ff" : "transparent",
              color: editorMode === "bulk" ? "#7c3aed" : "#374151",
              display: "flex", alignItems: "center", gap: "4px",
              transition: "all 0.15s",
            }}>
              <Layers size={10} /> Bulk
              {userPlan === "FREE" && <span style={{ fontSize: "8px", background: "#f3e8ff", color: "#7c3aed", padding: "1px 4px", borderRadius: "3px", fontWeight: 700 }}>PRO</span>}
            </button>
          </div>

          {/* Step breadcrumb (single mode only) */}
          {editorMode === "single" && (
            <div style={{ display: "flex", alignItems: "center", gap: "0px" }}>
              {[
                { label: "Write", done: !!result || analyzing, active: !result && !analyzing && !isDone },
                { label: "Analyze", done: !!result, active: analyzing },
                { label: "Humanize", done: isDone, active: humanizing },
              ].map(({ label, done, active }, i) => (
                <div key={label} style={{ display: "flex", alignItems: "center" }}>
                  {i > 0 && (
                    <div style={{
                      width: "28px", height: "2px",
                      background: done ? "#059669" : active ? "#7c3aed" : "#e5e7eb",
                      transition: "background 0.3s",
                    }} />
                  )}
                  <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                    <div style={{
                      width: "20px", height: "20px", borderRadius: "50%",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: "10px", fontWeight: 700, flexShrink: 0,
                      background: done ? "#059669" : active ? "#7c3aed" : "transparent",
                      color: done || active ? "#fff" : "#4b5563",
                      border: done || active ? "none" : "2px solid #e5e7eb",
                      transition: "all 0.3s",
                    }}>
                      {done ? <CheckCircle2 size={11} /> : i + 1}
                    </div>
                    <span style={{
                      fontSize: "11px", fontWeight: done || active ? 600 : 400,
                      color: done ? "#059669" : active ? "#7c3aed" : "#4b5563",
                      transition: "color 0.3s",
                    }}>
                      {label}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {/* Style Clone badge */}
          {styleFingerprint && (
            <div style={{
              display: "flex", alignItems: "center", gap: "4px",
              padding: "4px 8px", borderRadius: "5px", fontSize: "10px", fontWeight: 600,
              background: "rgba(22,163,74,0.08)", border: "1px solid rgba(22,163,74,0.25)",
              color: "#16a34a",
            }}>
              <Fingerprint size={10} /> Style Clone Active
              <button onClick={handleClearStyle} style={{ background: "none", border: "none", cursor: "pointer", padding: "0 0 0 2px", color: "#16a34a", display: "flex" }}>
                <X size={9} />
              </button>
            </div>
          )}
          {/* Language selector */}
          <div style={{ position: "relative" }}>
            <button onClick={() => setLangOpen(o => !o)} style={{
              display: "flex", alignItems: "center", gap: "4px",
              padding: "4px 9px", borderRadius: "5px", fontSize: "11px", fontWeight: 500, cursor: "pointer",
              border: `1px solid ${language !== "English" ? "rgba(124,58,237,0.4)" : "#e5e7eb"}`,
              background: language !== "English" ? "#f3e8ff" : "transparent",
              color: language !== "English" ? "#7c3aed" : "#374151",
              transition: "all 0.15s",
            }}>
              <Globe size={10} /> {LANGUAGES.find(l => l.value === language)?.flag} {language}
            </button>
            {langOpen && (
              <div style={{
                position: "absolute", top: "100%", right: 0, marginTop: "4px", zIndex: 50,
                background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: "8px",
                padding: "4px", minWidth: "140px", boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
              }}>
                {LANGUAGES.map(({ value, label, flag }) => (
                  <button key={value} onClick={() => handleLanguageChange(value)} style={{
                    display: "flex", alignItems: "center", gap: "8px", width: "100%",
                    padding: "7px 10px", borderRadius: "5px", fontSize: "12px", cursor: "pointer",
                    background: language === value ? "#f3e8ff" : "transparent",
                    color: language === value ? "#7c3aed" : "#374151",
                    border: "none", textAlign: "left", fontWeight: language === value ? 600 : 400,
                  }}>
                    <span>{flag}</span> {label}
                  </button>
                ))}
              </div>
            )}
          </div>
          {/* Tone selector */}
          <div style={{ display: "flex", gap: "3px", flexWrap: "wrap" }}>
            {TONES.map(({ value, label, icon }) => (
              <button key={value} onClick={() => setTone(value)} style={{
                padding: "4px 10px", borderRadius: "20px", fontSize: "11px", fontWeight: 500, cursor: "pointer",
                border: `1px solid ${tone === value ? "rgba(124,58,237,0.4)" : "#e5e7eb"}`,
                background: tone === value ? "#f3e8ff" : "transparent",
                color: tone === value ? "#7c3aed" : "#374151",
                transition: "all 0.15s",
                display: "flex", alignItems: "center", gap: "4px",
              }}><span style={{ fontSize: "12px" }}>{icon}</span>{label}</button>
            ))}
          </div>
          {editorMode === "single" && (result || humanizedText) && (
            <button onClick={handleReset} style={{
              display: "flex", alignItems: "center", gap: "4px",
              background: "#f9fafb", border: "1px solid #e5e7eb",
              borderRadius: "6px", padding: "4px 10px", color: "#374151",
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

              {/* Style Clone panel */}
              {isPaidPlan && (
                <div style={{
                  background: "#ffffff", borderRadius: "12px",
                  border: `1px solid ${styleOpen ? "rgba(124,58,237,0.2)" : "#f0f0f0"}`,
                  overflow: "hidden", transition: "border-color 0.3s",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
                }}>
                  <button onClick={() => setStyleOpen(o => !o)} style={{
                    width: "100%", padding: "10px 14px",
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    background: "transparent", border: "none", cursor: "pointer", color: "#374151",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <Fingerprint size={13} color="#7c3aed" />
                      <span style={{ fontSize: "12px", fontWeight: 600, color: "#4b5563" }}>Style Clone</span>
                      {styleFingerprint && (
                        <span style={{ fontSize: "10px", padding: "2px 6px", borderRadius: "4px", background: "rgba(22,163,74,0.08)", color: "#16a34a", fontWeight: 600 }}>Active</span>
                      )}
                    </div>
                    {styleOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                  </button>
                  {styleOpen && (
                    <div style={{ padding: "0 14px 14px", animation: "fadeInUp 0.2s ease" }}>
                      <p style={{ fontSize: "11px", color: "#4b5563", marginBottom: "10px", lineHeight: 1.5 }}>
                        Paste 2-3 samples of your writing. We&apos;ll extract your style and apply it to humanizations.
                      </p>
                      {styleSamples.map((sample, i) => (
                        <div key={i} style={{ marginBottom: "8px" }}>
                          <label style={{ fontSize: "10px", color: "#4b5563", marginBottom: "3px", display: "block" }}>
                            Sample {i + 1} {i < 2 ? "(required)" : "(optional)"}
                          </label>
                          <textarea
                            value={sample}
                            onChange={e => {
                              const next = [...styleSamples];
                              next[i] = e.target.value;
                              setStyleSamples(next);
                            }}
                            placeholder="Paste a paragraph of your own writing..."
                            style={{
                              width: "100%", minHeight: "70px", padding: "8px 10px",
                              background: "#f9fafb", border: "1px solid #e5e7eb",
                              borderRadius: "6px", color: "#111827", fontSize: "12px",
                              lineHeight: 1.6, fontFamily: "inherit", resize: "vertical",
                              outline: "none", boxSizing: "border-box", display: "block",
                            }}
                          />
                        </div>
                      ))}
                      {styleSamples.length < 3 && (
                        <button onClick={() => setStyleSamples([...styleSamples, ""])} style={{
                          fontSize: "11px", color: "#7c3aed", background: "none", border: "none",
                          cursor: "pointer", padding: "4px 0", marginBottom: "8px",
                        }}>+ Add sample 3</button>
                      )}
                      <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
                        <button onClick={() => void handleLearnStyle()} disabled={styleLoading} style={{
                          padding: "8px 16px", borderRadius: "6px", border: "none",
                          background: "linear-gradient(135deg, #7c3aed, #6d28d9)",
                          color: "#fff", fontSize: "12px", fontWeight: 600, cursor: styleLoading ? "not-allowed" : "pointer",
                          opacity: styleLoading ? 0.6 : 1,
                        }}>
                          {styleLoading ? "Analyzing..." : "Learn My Style"}
                        </button>
                        {styleFingerprint && (
                          <button onClick={handleClearStyle} style={{
                            padding: "8px 16px", borderRadius: "6px",
                            background: "#f9fafb", border: "1px solid #e5e7eb",
                            color: "#374151", fontSize: "12px", cursor: "pointer",
                          }}>Clear Style</button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Input mode toggle */}
              {!result && !analyzing && (
                <div style={{ display: "flex", gap: "2px", background: "#f9fafb", borderRadius: "8px", padding: "3px", alignSelf: "flex-start" }}>
                  <button onClick={() => setInputMode("paste")} style={{
                    padding: "6px 14px", borderRadius: "6px", fontSize: "12px", fontWeight: 600, cursor: "pointer",
                    border: "none", display: "flex", alignItems: "center", gap: "5px",
                    background: inputMode === "paste" ? "#f3e8ff" : "transparent",
                    color: inputMode === "paste" ? "#7c3aed" : "#374151",
                    transition: "all 0.15s",
                  }}>
                    <span style={{ fontSize: "13px" }}>&#9998;</span> Paste text
                  </button>
                  <button onClick={() => setInputMode("upload")} style={{
                    padding: "6px 14px", borderRadius: "6px", fontSize: "12px", fontWeight: 600, cursor: "pointer",
                    border: "none", display: "flex", alignItems: "center", gap: "5px",
                    background: inputMode === "upload" ? "#f3e8ff" : "transparent",
                    color: inputMode === "upload" ? "#7c3aed" : "#374151",
                    transition: "all 0.15s",
                  }}>
                    <FileUp size={12} /> Upload document
                  </button>
                </div>
              )}

              {/* Upload zone */}
              {inputMode === "upload" && !result && !analyzing && (
                <UploadZone
                  onExtracted={handleUploadExtracted}
                  plan={userPlan}
                  uploadEnabled={(PLANS[userPlan as PlanId] ?? PLANS.FREE).uploadEnabled}
                />
              )}

              {/* Uploaded file banner */}
              {uploadedFileName && inputMode === "paste" && !result && (
                <div style={{
                  padding: "8px 14px", borderRadius: "8px",
                  background: "#faf5ff", border: "1px solid rgba(124,58,237,0.15)",
                  display: "flex", alignItems: "center", gap: "8px",
                }}>
                  <FileUp size={12} color="#7c3aed" />
                  <span style={{ fontSize: "12px", color: "#7c3aed", fontWeight: 500 }}>
                    Loaded from {uploadedFileName} — {wordCount.toLocaleString()} words
                  </span>
                </div>
              )}

              {/* Textarea card */}
              {(inputMode === "paste" || result || analyzing) && (
              <div style={{
                background: "#ffffff", borderRadius: "12px",
                border: `1.5px solid ${analyzing ? "rgba(124,58,237,0.4)" : "#e5e7eb"}`,
                overflow: "hidden", transition: "border-color 0.3s, box-shadow 0.3s",
                boxShadow: analyzing ? "0 4px 12px rgba(124,58,237,0.15)" : "0 1px 3px rgba(0,0,0,0.06)",
              }}>
                {/* Mac-style toolbar */}
                <div style={{
                  padding: "10px 14px", borderBottom: "1px solid #e5e7eb",
                  display: "flex", alignItems: "center", gap: "6px",
                  background: analyzing ? "rgba(124,58,237,0.04)" : "transparent",
                  transition: "background 0.3s",
                }}>
                  {["#dc2626", "#d97706", "#16a34a"].map((c, i) => (
                    <div key={i} style={{ width: "8px", height: "8px", borderRadius: "50%", background: c, opacity: analyzing ? 0.8 : 0.4 }} />
                  ))}
                  <span style={{ fontSize: "10px", color: "#d1d5db", marginLeft: "8px", fontFamily: "var(--font-mono)" }}>
                    {analyzing ? "scanning..." : "your text"}
                  </span>
                  {result && !analyzing && (
                    <button onClick={() => setParagraphMode(p => !p)} style={{
                      marginLeft: "auto", display: "flex", alignItems: "center", gap: "4px",
                      padding: "3px 8px", borderRadius: "4px", fontSize: "10px", cursor: "pointer",
                      border: `1px solid ${paragraphMode ? "rgba(124,58,237,0.3)" : "#e5e7eb"}`,
                      background: paragraphMode ? "#f3e8ff" : "transparent",
                      color: paragraphMode ? "#7c3aed" : "#4b5563",
                      transition: "all 0.15s",
                    }}>
                      <Rows3 size={10} /> Paragraph Mode
                    </button>
                  )}
                  {analyzing && (
                    <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "6px" }}>
                      <div className="scan-pulse" />
                      <span style={{ fontSize: "10px", color: "#7c3aed" }}>Analyzing</span>
                    </div>
                  )}
                </div>

                {/* Scan progress bar */}
                {analyzing && (
                  <div style={{ height: "2px", background: "#f3f4f6" }}>
                    <div className="scan-bar" style={{ height: "100%", background: "linear-gradient(90deg, #7c3aed, #6d28d9, #7c3aed)", backgroundSize: "200% 100%" }} />
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
                    background: "#ffffff", border: "none", outline: "none",
                    resize: "vertical", color: "#111827", fontSize: "13px",
                    lineHeight: 1.8, fontFamily: "var(--font-mono, ui-monospace, monospace)", boxSizing: "border-box",
                    display: "block", opacity: analyzing ? 0.5 : 1, transition: "opacity 0.3s",
                    direction: isRTL ? "rtl" : "ltr", textAlign: isRTL ? "right" : "left",
                    borderRadius: "0",
                  }}
                />

                {/* Intensity slider */}
                <div style={{
                  padding: "8px 14px", borderTop: "1px solid #e5e7eb",
                  display: "flex", alignItems: "center", gap: "10px",
                }}>
                  <SlidersHorizontal size={11} color="#4b5563" />
                  <span style={{ fontSize: "10px", color: "#4b5563", flexShrink: 0 }}>Intensity</span>
                  <div style={{ display: "flex", alignItems: "center", gap: "2px", flex: 1, maxWidth: "220px" }}>
                    {INTENSITIES.map(({ value, label }) => (
                      <button key={value} onClick={() => setIntensity(value)} style={{
                        flex: 1, padding: "4px 0", borderRadius: "4px", fontSize: "10px", fontWeight: 600,
                        cursor: "pointer", border: "none", transition: "all 0.15s",
                        background: intensity === value
                          ? value === "light" ? "rgba(22,163,74,0.1)" : value === "medium" ? "rgba(249,115,22,0.1)" : "rgba(220,38,38,0.1)"
                          : "#f9fafb",
                        color: intensity === value
                          ? value === "light" ? "#16a34a" : value === "medium" ? "#f97316" : "#dc2626"
                          : "#4b5563",
                      }}>{label}</button>
                    ))}
                  </div>
                  <span style={{ fontSize: "9px", color: "#d1d5db", flexShrink: 0 }}>
                    {INTENSITIES.find(i => i.value === intensity)?.desc}
                  </span>
                </div>

                {/* Toolbar */}
                <div style={{
                  padding: "10px 14px", borderTop: "1px solid #e5e7eb",
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
                      padding: "10px 22px", borderRadius: "12px", border: "none",
                      background: canAnalyze ? "linear-gradient(135deg, #7c3aed, #6d28d9)" : "rgba(124,58,237,0.12)",
                      color: canAnalyze ? "#fff" : "#4b5563",
                      fontSize: "13px", fontWeight: 700,
                      cursor: canAnalyze ? "pointer" : "not-allowed",
                      transition: "all 0.2s", flexShrink: 0,
                      boxShadow: canAnalyze ? "0 4px 12px rgba(124,58,237,0.15)" : "none",
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
              )}

              {/* Paragraph Mode Cards */}
              {paragraphMode && result && paragraphs.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px", animation: "fadeInUp 0.3s ease" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "2px" }}>
                    <Rows3 size={12} color="#7c3aed" />
                    <span style={{ fontSize: "12px", fontWeight: 600, color: "#374151" }}>
                      {paragraphs.length} paragraph{paragraphs.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                  {paragraphs.map((para, idx) => {
                    const score = paraScores[idx];
                    const hText = paraHumanized[idx];
                    const isHumanizing = paraHumanizing[idx] ?? false;
                    const scoreColor = score === null || score === undefined ? "#d1d5db"
                      : score >= 75 ? "#dc2626" : score >= 50 ? "#f97316" : score >= 30 ? "#d97706" : "#16a34a";

                    return (
                      <div key={idx} style={{
                        background: "#ffffff", borderRadius: "10px",
                        border: "1px solid #f0f0f0",
                        overflow: "hidden",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
                      }}>
                        <div style={{
                          height: "3px", background: "#f3f4f6",
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
                              color: hText ? "#16a34a" : "#4b5563",
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
                              border: "1px solid rgba(124,58,237,0.2)",
                              background: isHumanizing ? "#faf5ff" : "#f3e8ff",
                              color: isHumanizing ? "#4b5563" : "#7c3aed",
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
              {(humanizing || isDone) && (
                <div style={{
                  background: "#ffffff", borderRadius: "12px",
                  border: `1.5px solid ${isDone ? "rgba(22,163,74,0.25)" : "rgba(124,58,237,0.2)"}`,
                  overflow: "hidden", animation: "fadeInUp 0.35s ease",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
                }}>
                  {humanizing ? (
                    <HumanizingState chunkProgress={chunkProgress} passInfo={passInfo} />
                  ) : humanizedText && (
                    <>
                      <div style={{
                        padding: "12px 16px", borderBottom: "1px solid #e5e7eb",
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          <span style={{ fontSize: "12px", fontWeight: 700, color: "#16a34a", display: "flex", alignItems: "center", gap: "5px" }}>
                            <CheckCircle2 size={13} /> Humanized{passCount > 1 ? ` in ${passCount} passes` : ""}
                          </span>
                          {humanizedScore !== null && result && (
                            <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                              <span style={{ fontSize: "11px", padding: "2px 7px", borderRadius: "4px", fontWeight: 700, background: "rgba(220,38,38,0.08)", color: "#dc2626", textDecoration: "line-through", opacity: 0.6 }}>
                                {Math.round(result.score)}%
                              </span>
                              {scoreHistory.length > 1 && scoreHistory.slice(0, -1).map((s, i) => (
                                <span key={i} style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                                  <ArrowRight size={9} color="#d1d5db" />
                                  <span style={{ fontSize: "10px", padding: "2px 5px", borderRadius: "3px", fontWeight: 600, background: "rgba(249,115,22,0.08)", color: "rgba(249,115,22,0.6)", textDecoration: "line-through", opacity: 0.5 }}>
                                    {Math.round(s)}%
                                  </span>
                                </span>
                              ))}
                              <ArrowRight size={9} color="#d1d5db" />
                              <span style={{
                                fontSize: "11px", padding: "2px 7px", borderRadius: "4px", fontWeight: 700,
                                background: humanizedScore < 30 ? "rgba(22,163,74,0.08)" : "rgba(249,115,22,0.08)",
                                color: humanizedScore < 30 ? "#16a34a" : "#f97316",
                                animation: "popIn 0.4s ease",
                              }}>
                                {Math.round(humanizedScore)}%
                              </span>
                            </div>
                          )}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          {/* Share score */}
                          {humanizedScore !== null && result && (
                            <ShareScore score={result.score} humanizedScore={humanizedScore} />
                          )}
                          {/* Diff view toggle */}
                          <button onClick={() => setShowDiff(d => !d)} style={{
                            display: "flex", alignItems: "center", gap: "4px",
                            background: showDiff ? "#f3e8ff" : "#f9fafb",
                            border: `1px solid ${showDiff ? "rgba(124,58,237,0.25)" : "#e5e7eb"}`,
                            borderRadius: "5px", padding: "5px 10px", cursor: "pointer",
                            color: showDiff ? "#7c3aed" : "#374151", fontSize: "11px",
                            transition: "all 0.2s",
                          }}>
                            <GitCompareArrows size={10} /> {showDiff ? "Clean View" : "Diff View"}
                          </button>
                          <button onClick={handleDownloadTxt} title="Download .txt" style={{
                            display: "flex", alignItems: "center", gap: "4px",
                            background: "#f9fafb", border: "1px solid #e5e7eb",
                            borderRadius: "5px", padding: "5px 8px", cursor: "pointer",
                            color: "#374151", fontSize: "11px", transition: "all 0.2s",
                          }}>
                            <Download size={10} /> .txt
                          </button>
                          <button onClick={() => void handleCopy()} style={{
                            display: "flex", alignItems: "center", gap: "5px",
                            background: copied ? "rgba(22,163,74,0.06)" : "#f9fafb",
                            border: `1px solid ${copied ? "rgba(22,163,74,0.2)" : "#e5e7eb"}`,
                            borderRadius: "5px", padding: "5px 10px", cursor: "pointer",
                            color: copied ? "#16a34a" : "#374151", fontSize: "11px",
                            transition: "all 0.2s",
                          }}>
                            <Copy size={10} /> {copied ? "Copied!" : "Copy"}
                          </button>
                        </div>
                      </div>
                      <div style={{
                        padding: "16px", fontSize: "14px", lineHeight: 1.8,
                        color: "#111827", whiteSpace: "pre-wrap",
                        maxHeight: "380px", overflow: "auto",
                        direction: isRTL ? "rtl" : "ltr", textAlign: isRTL ? "right" : "left",
                        background: "#f0fdf4", borderLeft: "4px solid #16a34a", borderRadius: "12px",
                      }}>
                        {showDiff ? (
                          computeWordDiff(text, humanizedText).map((seg: DiffSegment, i: number) => (
                            <span key={i} style={
                              seg.type === "removed" ? { background: "rgba(220,38,38,0.1)", color: "#dc2626", textDecoration: "line-through", borderRadius: "2px", padding: "0 1px" }
                              : seg.type === "added" ? { background: "rgba(22,163,74,0.1)", color: "#16a34a", borderRadius: "2px", padding: "0 1px" }
                              : {}
                            }>{seg.text}</span>
                          ))
                        ) : humanizedText}
                      </div>
                      <div style={{
                        padding: "10px 16px", borderTop: "1px solid #e5e7eb",
                        display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap",
                      }}>
                        <span style={{ fontSize: "10px", color: "#4b5563", marginRight: "2px" }}>Try tone:</span>
                        {TONES.map(({ value, label, icon }) => (
                          <button key={value} onClick={() => { setTone(value); void handleHumanize(value); }} style={{
                            padding: "4px 10px", borderRadius: "20px", fontSize: "11px",
                            background: tone === value ? "#f3e8ff" : "#f9fafb",
                            border: `1px solid ${tone === value ? "rgba(124,58,237,0.3)" : "#e5e7eb"}`,
                            color: tone === value ? "#7c3aed" : "#374151", cursor: "pointer",
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
                  background: analyzing ? "#ffffff" : (scoreConfig?.dimColor ?? "#ffffff"),
                  border: `1px solid ${analyzing ? "#e5e7eb" : (scoreConfig?.border ?? "#e5e7eb")}`,
                  borderRadius: "14px", padding: "22px",
                  animation: analyzing ? "none" : "fadeInUp 0.35s ease",
                  transition: "background 0.5s, border-color 0.5s",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
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
                          <div style={{ fontSize: "12px", color: "#374151", lineHeight: 1.6, marginBottom: "6px" }}>
                            {scoreConfig.desc}
                          </div>
                          <div style={{ fontSize: "11px", color: "#4b5563", background: "#f9fafb", padding: "2px 8px", borderRadius: "4px", display: "inline-block" }}>
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
                          <div key={label} title={tip} style={{ background: "#f9fafb", borderRadius: "8px", padding: "10px 12px", cursor: "help" }}>
                            <div style={{ fontSize: "10px", color: "#4b5563", marginBottom: "4px" }}>{label}</div>
                            <div style={{ fontSize: "18px", fontWeight: 800, color: bad ? "#f97316" : "#16a34a" }}>{val}</div>
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

                {/* Multi-Engine Detection Panel */}
                {result && !analyzing && (
                  <div style={{
                    background: "#ffffff", borderRadius: "12px",
                    border: "1px solid #f0f0f0", overflow: "hidden",
                    animation: "fadeInUp 0.4s ease 0.15s both",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
                  }}>
                    <div style={{
                      padding: "12px 16px", borderBottom: "1px solid #f0f0f0",
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
                        <Shield size={13} color="#7c3aed" />
                        <span style={{ fontSize: "12px", fontWeight: 600, color: "#4b5563" }}>
                          {humanizedEngineScores ? "Updated scores" : "How you score across detectors"}
                        </span>
                      </div>
                    </div>

                    {(userPlan === "PRO" || userPlan === "TEAM") ? (
                      <div style={{ padding: "10px 16px 6px" }}>
                        {(humanizedEngineScores ?? engineScores ?? []).map((es, i) => {
                          const barColor = es.score < 30 ? "#16a34a" : es.score < 60 ? "#d97706" : "#dc2626";
                          const badgeBg = es.status === "PASS" ? "rgba(22,163,74,0.08)" : es.status === "RISKY" ? "rgba(217,119,6,0.08)" : "rgba(220,38,38,0.08)";
                          const badgeColor = es.status === "PASS" ? "#16a34a" : es.status === "RISKY" ? "#d97706" : "#dc2626";
                          return (
                            <div key={es.engine} style={{
                              display: "flex", alignItems: "center", gap: "10px",
                              padding: "8px 0",
                              borderBottom: i < (humanizedEngineScores ?? engineScores ?? []).length - 1 ? "1px solid #f3f4f6" : "none",
                              animation: `fadeInUp 0.3s ease ${0.05 * i}s both`,
                            }}>
                              <span style={{ fontSize: "11px", color: "#374151", width: "90px", flexShrink: 0, fontWeight: 500 }}>{es.engine}</span>
                              <div style={{ flex: 1, height: "6px", borderRadius: "3px", background: "#f3f4f6", overflow: "hidden" }}>
                                <div style={{
                                  width: `${es.score}%`, height: "100%", borderRadius: "3px",
                                  background: barColor, transition: "width 0.6s ease",
                                }} />
                              </div>
                              <span style={{ fontSize: "11px", fontWeight: 700, color: barColor, width: "28px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{es.score}</span>
                              <span style={{
                                fontSize: "9px", fontWeight: 700, padding: "2px 6px", borderRadius: "3px",
                                background: badgeBg, color: badgeColor, letterSpacing: "0.5px", width: "38px", textAlign: "center",
                              }}>{es.status}</span>
                            </div>
                          );
                        })}
                        <p style={{ fontSize: "9px", color: "#d1d5db", padding: "6px 0 4px", lineHeight: 1.4 }}>
                          Scores are simulated estimates based on our detection algorithm
                        </p>
                      </div>
                    ) : (
                      <div style={{ padding: "20px 16px", textAlign: "center" }}>
                        <Lock size={20} color="#d1d5db" style={{ margin: "0 auto 8px" }} />
                        <p style={{ fontSize: "12px", color: "#374151", marginBottom: "4px", fontWeight: 500 }}>
                          See how your text scores across 5 AI detectors
                        </p>
                        <p style={{ fontSize: "10px", color: "#4b5563", marginBottom: "12px" }}>
                          GPTZero · Turnitin · Originality.ai · Copyleaks · Winston AI
                        </p>
                        <button onClick={() => setShowUpgradeModal(true)} style={{
                          padding: "8px 18px", borderRadius: "7px", border: "1px solid rgba(124,58,237,0.3)",
                          background: "#f3e8ff", color: "#7c3aed",
                          fontSize: "12px", fontWeight: 600, cursor: "pointer",
                        }}>
                          Upgrade to Pro
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Patterns */}
                {analyzing ? (
                  <div style={{ background: "#ffffff", border: "1px solid #f0f0f0", borderRadius: "12px", padding: "14px", display: "flex", flexDirection: "column", gap: "8px", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
                    <Skeleton width="55%" height={11} />
                    {[0, 1, 2].map(i => <Skeleton key={i} height={36} radius={6} style={{ animationDelay: `${i * 0.15}s` }} />)}
                  </div>
                ) : result && result.patterns.length > 0 && (
                  <div style={{
                    background: "#ffffff", borderRadius: "12px",
                    border: "1px solid #f0f0f0", overflow: "hidden",
                    animation: "fadeInUp 0.4s ease 0.1s both",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
                  }}>
                    <div style={{
                      padding: "12px 16px", borderBottom: "1px solid #f0f0f0",
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                    }}>
                      <span style={{ fontSize: "12px", fontWeight: 600, color: "#4b5563" }}>AI Patterns Detected</span>
                      <span style={{ fontSize: "11px", padding: "2px 8px", borderRadius: "4px", background: "#f3e8ff", color: "#7c3aed", fontWeight: 700 }}>
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
                          width: "100%", padding: "9px", background: "#f9fafb",
                          border: "none", borderTop: "1px solid #e5e7eb",
                          color: "#4b5563", cursor: "pointer", fontSize: "11px",
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
                    background: "#ffffff", borderRadius: "12px",
                    border: "1px solid rgba(124,58,237,0.15)", padding: "18px",
                    animation: "fadeInUp 0.4s ease 0.2s both",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "7px", marginBottom: "6px" }}>
                      <Sparkles size={13} color="#7c3aed" />
                      <span style={{ fontSize: "13px", fontWeight: 600, color: "#0a0a0a", fontFamily: "var(--font-heading)" }}>Humanize with AI</span>
                    </div>
                    <p style={{ fontSize: "11px", color: "#4b5563", lineHeight: 1.6, marginBottom: "14px" }}>
                      Multi-pass rewrite · 3 attempts · picks the best result
                    </p>
                    <button
                      onClick={() => void handleHumanize()}
                      style={{
                        width: "100%", padding: "16px", borderRadius: "12px", border: "none",
                        background: "#7c3aed",
                        color: "#fff", fontSize: "16px", fontWeight: 600, cursor: "pointer",
                        display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
                        boxShadow: "0 4px 12px rgba(124,58,237,0.25)", transition: "all 0.2s",
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
                      width: "100%", padding: "11px", borderRadius: "10px", border: "1px solid rgba(124,58,237,0.2)",
                      background: "#f3e8ff", color: "#7c3aed",
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
                background: "#ffffff", borderRadius: "12px",
                border: "1.5px solid #f0f0f0", overflow: "hidden",
                boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
              }}>
                <div style={{
                  padding: "10px 14px", borderBottom: "1px solid #e5e7eb",
                  display: "flex", alignItems: "center", gap: "6px",
                }}>
                  <Layers size={12} color="#7c3aed" />
                  <span style={{ fontSize: "11px", color: "#374151", fontWeight: 600 }}>Bulk Mode</span>
                  <span style={{ fontSize: "10px", color: "#4b5563", marginLeft: "auto" }}>Separate texts with ---</span>
                </div>
                <textarea
                  value={bulkText}
                  onChange={e => setBulkText(e.target.value)}
                  placeholder={"Paste multiple texts here, separated by --- on its own line.\n\nExample:\n\nFirst text goes here...\n\n---\n\nSecond text goes here...\n\n---\n\nThird text goes here..."}
                  style={{
                    width: "100%", minHeight: "320px", padding: "16px",
                    background: "#f9fafb", border: "none", outline: "none",
                    resize: "vertical", color: "#111827", fontSize: "14px",
                    lineHeight: 1.8, fontFamily: "inherit", boxSizing: "border-box",
                    display: "block",
                  }}
                />
                <div style={{
                  padding: "10px 14px", borderTop: "1px solid #e5e7eb",
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                }}>
                  <span style={{ fontSize: "11px", color: "#4b5563" }}>
                    {parseBulkTexts().length} text{parseBulkTexts().length !== 1 ? "s" : ""} detected
                  </span>
                  <button
                    onClick={() => void handleBulkAnalyze()}
                    disabled={parseBulkTexts().length === 0}
                    style={{
                      display: "flex", alignItems: "center", gap: "7px",
                      padding: "10px 22px", borderRadius: "12px", border: "none",
                      background: parseBulkTexts().length > 0 ? "linear-gradient(135deg, #7c3aed, #6d28d9)" : "rgba(124,58,237,0.12)",
                      color: parseBulkTexts().length > 0 ? "#fff" : "#4b5563",
                      fontSize: "13px", fontWeight: 700,
                      cursor: parseBulkTexts().length > 0 ? "pointer" : "not-allowed",
                      boxShadow: parseBulkTexts().length > 0 ? "0 4px 12px rgba(124,58,237,0.15)" : "none",
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
                background: "#faf5ff", border: "1px solid rgba(124,58,237,0.2)",
                borderRadius: "10px", padding: "14px 18px", marginBottom: "16px",
                display: "flex", alignItems: "center", gap: "12px",
                animation: "fadeInUp 0.3s ease",
              }}>
                <div className="spin-sm" />
                <span style={{ fontSize: "13px", color: "#7c3aed", fontWeight: 600 }}>
                  Processing {bulkProgress.current}/{bulkProgress.total}...
                </span>
                <button onClick={() => { bulkAbortRef.current = true; }} style={{
                  marginLeft: "auto", padding: "4px 10px", borderRadius: "5px",
                  background: "rgba(220,38,38,0.06)", border: "1px solid rgba(220,38,38,0.2)",
                  color: "#dc2626", fontSize: "11px", cursor: "pointer",
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
                      flex: 1, padding: "13px", borderRadius: "12px", border: "none",
                      background: "#7c3aed",
                      color: "#fff", fontSize: "14px", fontWeight: 700, cursor: "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
                      boxShadow: "0 4px 12px rgba(124,58,237,0.25)",
                    }}>
                      <Sparkles size={14} /> Humanize All <ArrowRight size={12} />
                    </button>
                    <button onClick={() => { setBulkItems([]); setBulkText(""); }} style={{
                      padding: "13px 18px", borderRadius: "12px",
                      background: "#f9fafb", border: "1px solid #e5e7eb",
                      color: "#374151", fontSize: "13px", cursor: "pointer",
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
                    background: "#f9fafb", border: "1px solid #e5e7eb",
                    color: "#374151", fontSize: "13px", cursor: "pointer",
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
                      background: "#ffffff", borderRadius: "12px",
                      border: `1px solid ${item.status === "done" ? "rgba(22,163,74,0.2)" : item.status === "error" ? "rgba(220,38,38,0.2)" : "#e5e7eb"}`,
                      overflow: "hidden", animation: "fadeInUp 0.3s ease",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
                    }}>
                      {/* Card header */}
                      <div style={{
                        padding: "10px 14px", borderBottom: "1px solid #f3f4f6",
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span style={{
                            fontSize: "11px", fontWeight: 700, color: "#7c3aed",
                            background: "#f3e8ff", padding: "2px 8px", borderRadius: "4px",
                          }}>#{item.id + 1}</span>
                          <span style={{ fontSize: "11px", color: "#4b5563" }}>
                            {item.text.split(/\s+/).length} words
                          </span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          {item.status === "analyzing" || item.status === "humanizing" ? (
                            <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                              <div className="spin-sm" />
                              <span style={{ fontSize: "10px", color: "#7c3aed" }}>
                                {item.status === "analyzing" ? "Analyzing" : "Humanizing"}
                              </span>
                            </div>
                          ) : item.status === "error" ? (
                            <span style={{ fontSize: "10px", color: "#dc2626" }}>{item.error}</span>
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
                                  <ArrowRight size={9} color="#d1d5db" />
                                  <span style={{
                                    fontSize: "11px", padding: "2px 8px", borderRadius: "4px", fontWeight: 700,
                                    background: item.humanizedScore < 30 ? "rgba(22,163,74,0.08)" : "rgba(249,115,22,0.08)",
                                    color: item.humanizedScore < 30 ? "#16a34a" : "#f97316",
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
                        <div style={{ fontSize: "12px", color: "#374151", lineHeight: 1.7, maxHeight: "80px", overflow: "hidden", position: "relative" }}>
                          {item.text.slice(0, 200)}{item.text.length > 200 ? "…" : ""}
                          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "30px", background: "linear-gradient(transparent, #ffffff)" }} />
                        </div>
                        {item.humanizedText && (
                          <div style={{ marginTop: "10px", padding: "10px", borderRadius: "8px", background: "rgba(22,163,74,0.04)", border: "1px solid rgba(22,163,74,0.1)" }}>
                            <div style={{ fontSize: "10px", color: "#16a34a", fontWeight: 600, marginBottom: "6px", display: "flex", alignItems: "center", gap: "4px" }}>
                              <CheckCircle2 size={10} /> Humanized
                            </div>
                            <div style={{ fontSize: "12px", color: "#4b5563", lineHeight: 1.7, maxHeight: "120px", overflow: "auto" }}>
                              {item.humanizedText}
                            </div>
                            <button onClick={async () => {
                              await navigator.clipboard.writeText(item.humanizedText!);
                              toast.success(`Text #${item.id + 1} copied`);
                            }} style={{
                              marginTop: "6px", display: "flex", alignItems: "center", gap: "4px",
                              background: "#f9fafb", border: "1px solid #e5e7eb",
                              borderRadius: "4px", padding: "3px 8px", cursor: "pointer",
                              color: "#374151", fontSize: "10px",
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
        @keyframes passGlow { 0%,100% { opacity:0.3; } 50% { opacity:1; border-color: rgba(124,58,237,0.5); } }
        @keyframes dotBlink { 0%,100% { opacity:0; } 50% { opacity:1; } }
        .dots span { animation: dotBlink 1.4s infinite; }
        .dots span:nth-child(2) { animation-delay: 0.2s; }
        .dots span:nth-child(3) { animation-delay: 0.4s; }
        .scan-bar { animation: scanAnim 1.8s linear infinite; }
        .scan-pulse { width: 6px; height: 6px; border-radius: 50%; background: #7c3aed; animation: pulse 1s ease-in-out infinite; }
        .spin-sm { width: 12px; height: 12px; border-radius: 50%; border: 2px solid #e5e7eb; border-top-color: #7c3aed; animation: spin 0.7s linear infinite; display: inline-block; flex-shrink: 0; }
        @media (max-width: 900px) { .editor-grid { grid-template-columns: 1fr !important; } }
      `}</style>
    </div>
  );
}
