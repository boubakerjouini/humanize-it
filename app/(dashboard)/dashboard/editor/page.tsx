"use client";

import { useState, useCallback } from "react";
import { toast } from "sonner";
import { Loader2, Copy, ChevronDown, ChevronRight, Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { AnalysisResult, PatternHit } from "@/lib/algorithms/analyzeText";

// ---- Types ----

interface AnalyzeResponse {
  score: number;
  patterns: PatternHit[];
  stats: AnalysisResult["stats"];
  wordCount: number;
  documentId: string;
}

type ToneOption = "standard" | "formal" | "casual" | "academic";

// ---- Score helpers ----

function scoreColor(score: number): string {
  if (score >= 80) return "text-red-500";
  if (score >= 61) return "text-orange-500";
  if (score >= 31) return "text-yellow-500";
  return "text-green-500";
}

function scoreLabel(score: number): string {
  if (score >= 80) return "Very likely AI-generated 🔴";
  if (score >= 61) return "Likely AI-generated 🟠";
  if (score >= 31) return "Possibly AI-generated 🟡";
  return "Looks human 🟢";
}

function scoreBg(score: number): string {
  if (score >= 80) return "bg-red-500";
  if (score >= 61) return "bg-orange-500";
  if (score >= 31) return "bg-yellow-500";
  return "bg-green-500";
}

function severityColor(severity: string): string {
  switch (severity) {
    case "critical": return "bg-red-100 text-red-700 border-red-200";
    case "high": return "bg-orange-100 text-orange-700 border-orange-200";
    case "medium": return "bg-yellow-100 text-yellow-700 border-yellow-200";
    default: return "bg-green-100 text-green-700 border-green-200";
  }
}

function severityDot(severity: string): string {
  switch (severity) {
    case "critical": return "bg-red-500";
    case "high": return "bg-orange-500";
    case "medium": return "bg-yellow-500";
    default: return "bg-green-500";
  }
}

// ---- Heatmap ----

function buildHeatmap(text: string, patterns: PatternHit[]): React.ReactNode {
  // Collect all highlighted terms with their tier/severity
  const highlights: Array<{ phrase: string; cls: string }> = [];

  for (const p of patterns) {
    const cls =
      p.id === "ai-vocab-t1"
        ? "bg-red-200 dark:bg-red-900/50 rounded"
        : p.id === "ai-vocab-t2"
        ? "bg-yellow-200 dark:bg-yellow-900/50 rounded"
        : p.category === "phrase" || p.id.startsWith("formulaic")
        ? "bg-orange-200 dark:bg-orange-900/50 rounded"
        : "";
    if (!cls) continue;

    for (const ex of p.examples) {
      if (ex.length < 40) highlights.push({ phrase: ex.toLowerCase(), cls });
    }
  }

  if (highlights.length === 0) return <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed whitespace-pre-wrap">{text}</p>;

  // Simple regex-based highlighting
  const sortedHighlights = highlights.sort((a, b) => b.phrase.length - a.phrase.length);

  const parts: Array<{ text: string; cls?: string }> = [{ text }];

  for (const { phrase, cls } of sortedHighlights) {
    const nextParts: Array<{ text: string; cls?: string }> = [];
    for (const part of parts) {
      if (part.cls) {
        nextParts.push(part);
        continue;
      }
      const regex = new RegExp(`(${phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
      const split = part.text.split(regex);
      for (const seg of split) {
        if (seg.toLowerCase() === phrase) {
          nextParts.push({ text: seg, cls });
        } else if (seg) {
          nextParts.push({ text: seg });
        }
      }
    }
    parts.splice(0, parts.length, ...nextParts);
  }

  return (
    <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed whitespace-pre-wrap">
      {parts.map((part, i) =>
        part.cls ? (
          <mark key={i} className={`${part.cls} px-0.5`}>{part.text}</mark>
        ) : (
          <span key={i}>{part.text}</span>
        )
      )}
    </p>
  );
}

// ---- PatternItem ----

function PatternItem({ pattern }: { pattern: PatternHit }) {
  const [open, setOpen] = useState(false);

  const PATTERN_EXPLANATIONS: Record<string, string> = {
    "ai-vocab-t1": "These words are almost exclusively used by AI models. Human writers rarely use them.",
    "ai-vocab-t2": "Words significantly overused by AI but also found in human writing.",
    "ai-vocab-t3": "Words slightly over-represented in AI-generated text.",
    "sycophantic": "Phrases AI uses to appear friendly/agreeable — no human actually writes like this.",
    "filler": "Padding phrases that add length without adding value.",
    "generic-conclusion": "AI always wraps up with the same formulaic conclusions.",
    "hedging": "AI softens every claim with excessive hedging language.",
    "transition-overuse": "AI overuses formal transition words.",
    "repetitive-starters": "3+ consecutive sentences starting with the same word — an AI habit.",
    "list-heavy": "More than 30% of content is in list format — AI defaults to lists.",
    "uniform-paragraphs": "All paragraphs are suspiciously similar in length.",
    "perfect-grammar": "Zero contractions or informal language — too perfect for a human.",
    "formulaic-intro": "Opening sentence matches a common AI introduction template.",
    "formulaic-conclusion": "Closing paragraph uses generic AI conclusion phrases.",
    "over-explanation": "Defining terms that don't need defining — AI assumes readers know nothing.",
    "balanced-viewpoint": "Every claim has a counterargument — AI always presents 'balance'.",
    "excessive-qualifiers": "Too many intensifiers like 'very', 'extremely', 'highly'.",
    "abstract-language": "High density of abstract nouns with no concrete examples or data.",
    "no-personality": "No questions, exclamations, em dashes, or first-person voice.",
    "low-burstiness": "Sentence lengths are too uniform — human writing has natural variation.",
    "low-ttr": "Vocabulary is repetitive — AI reuses the same words frequently.",
    "median-sentence-len": "Average sentence length in the AI-typical range (18–25 words).",
    "predictable-reading": "Flesch score in the AI-typical range (40–60).",
    "low-perplexity": "Most sentences start with common, predictable words.",
  };

  const explanation = PATTERN_EXPLANATIONS[pattern.id] ?? "AI-generated text pattern detected.";

  return (
    <div className="border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${severityDot(pattern.severity)}`} />
          <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
            {pattern.label}
          </span>
          <span className={`text-xs px-1.5 py-0.5 rounded border font-medium ${severityColor(pattern.severity)}`}>
            {pattern.severity}
          </span>
          <span className="text-xs text-zinc-500">{pattern.hits} hit{pattern.hits !== 1 ? "s" : ""}</span>
        </div>
        {open ? <ChevronDown className="h-4 w-4 text-zinc-400" /> : <ChevronRight className="h-4 w-4 text-zinc-400" />}
      </button>

      {open && (
        <div className="px-4 pb-3 border-t border-zinc-100 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-800/20">
          <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-2 mb-1.5">{explanation}</p>
          <div className="flex flex-wrap gap-1">
            {pattern.examples.map((ex, i) => (
              <code key={i} className="text-xs bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-600 rounded px-1.5 py-0.5 text-zinc-700 dark:text-zinc-300">
                {ex}
              </code>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---- StatItem ----

function StatItem({
  label,
  value,
  description,
  warn,
}: {
  label: string;
  value: string | number;
  description: string;
  warn: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{label}</p>
        <p className="text-xs text-zinc-500">{description}</p>
      </div>
      <span
        className={`text-sm font-mono font-semibold flex-shrink-0 ${
          warn ? "text-orange-500" : "text-green-600"
        }`}
      >
        {value} {warn ? "⚠" : "✓"}
      </span>
    </div>
  );
}

// ---- Main Page ----

export default function EditorPage() {
  const [text, setText] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [humanizing, setHumanizing] = useState(false);
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const [humanizedText, setHumanizedText] = useState<string | null>(null);
  const [humanizedScore] = useState<number | null>(null);
  const [tone, setTone] = useState<ToneOption>("standard");
  const [documentId, setDocumentId] = useState<string | null>(null);

  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;

  const handleAnalyze = useCallback(async () => {
    if (!text.trim() || text.length < 11) {
      toast.error("Please enter at least 10 characters.");
      return;
    }
    if (text.length > 10000) {
      toast.error("Text must be under 10,000 characters.");
      return;
    }

    setAnalyzing(true);
    setResult(null);
    setHumanizedText(null);

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      const data = await res.json() as AnalyzeResponse & { error?: { message: string } };

      if (!res.ok) {
        toast.error(data.error?.message ?? "Analysis failed.");
        return;
      }

      setResult(data);
      setDocumentId(data.documentId);
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setAnalyzing(false);
    }
  }, [text]);

  const handleHumanize = useCallback(async () => {
    if (!documentId || !result) return;

    setHumanizing(true);

    try {
      const res = await fetch("/api/humanize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId, tone }),
      });

      const data = await res.json() as { humanizedText?: string; error?: { message: string } };

      if (!res.ok) {
        toast.error(data.error?.message ?? "Humanization failed.");
        return;
      }

      setHumanizedText(data.humanizedText ?? null);
      toast.success("Text humanized!");
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setHumanizing(false);
    }
  }, [documentId, result, tone]);

  const handleClear = () => {
    setText("");
    setResult(null);
    setHumanizedText(null);
    setDocumentId(null);
  };

  const handleCopy = () => {
    if (!humanizedText) return;
    navigator.clipboard.writeText(humanizedText);
    toast.success("Copied to clipboard!");
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Text Editor</h1>
        <p className="text-sm text-zinc-500 mt-0.5">Paste your text and analyze it for AI patterns.</p>
      </div>

      {/* Input + Results grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left: Input */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Original Text</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Paste your text here..."
              className="min-h-[280px] resize-none font-mono text-sm"
            />
            <div className="flex items-center justify-between">
              <span className="text-xs text-zinc-400">
                {wordCount.toLocaleString()} words · {text.length.toLocaleString()} / 10,000 chars
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleClear} disabled={!text}>
                  Clear
                </Button>
                <Button
                  size="sm"
                  onClick={handleAnalyze}
                  disabled={analyzing || !text.trim()}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                  {analyzing ? (
                    <><Loader2 className="h-3 w-3 animate-spin mr-1" /> Analyzing…</>
                  ) : (
                    "Analyze Text"
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Right: Score */}
        {result ? (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">AI Score</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Score gauge */}
              <div className="text-center py-4">
                <div className={`text-6xl font-black ${scoreColor(result.score)}`}>
                  {Math.round(result.score)}
                </div>
                <div className="text-sm text-zinc-500 mt-1">out of 100</div>
                <div className="mt-3 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full h-3">
                  <div
                    className={`h-3 rounded-full transition-all duration-700 ${scoreBg(result.score)}`}
                    style={{ width: `${result.score}%` }}
                  />
                </div>
                <p className={`mt-2 text-sm font-medium ${scoreColor(result.score)}`}>
                  {scoreLabel(result.score)}
                </p>
              </div>

              <Separator />

              {/* Stats */}
              <div className="space-y-2.5">
                <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">Statistics</p>
                <StatItem
                  label="Burstiness"
                  value={result.stats.burstiness}
                  description="Sentence length variance (< 0.20 = AI)"
                  warn={result.stats.burstiness < 0.2}
                />
                <StatItem
                  label="Type-Token Ratio"
                  value={result.stats.typeTokenRatio}
                  description="Vocabulary diversity (< 0.40 = AI)"
                  warn={result.stats.typeTokenRatio < 0.4}
                />
                <StatItem
                  label="Avg Sentence"
                  value={`${result.stats.avgSentenceLength} words`}
                  description="18–25 words = AI-typical range"
                  warn={result.stats.avgSentenceLength >= 18 && result.stats.avgSentenceLength <= 25}
                />
                <StatItem
                  label="Flesch Score"
                  value={result.stats.fleschReadingEase}
                  description="Reading ease (40–60 = AI-typical)"
                  warn={result.stats.fleschReadingEase >= 40 && result.stats.fleschReadingEase <= 60}
                />
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="flex items-center justify-center bg-zinc-50/50 dark:bg-zinc-800/20 border-dashed">
            <CardContent className="text-center py-12">
              <p className="text-zinc-400 text-sm">Your score will appear here after analysis.</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Patterns detected */}
      {result && result.patterns.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">
                Patterns Detected
                <Badge variant="secondary" className="ml-2">{result.patterns.length}</Badge>
              </CardTitle>
              <span className="text-xs text-zinc-400">{result.wordCount} words analyzed</span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {result.patterns
                .sort((a, b) => {
                  const order = { critical: 0, high: 1, medium: 2, low: 3 };
                  return order[a.severity] - order[b.severity];
                })
                .map((pattern) => (
                  <PatternItem key={pattern.id} pattern={pattern} />
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Heatmap */}
      {result && text && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Text Heatmap</CardTitle>
            <p className="text-xs text-zinc-500 mt-1">
              <mark className="bg-red-200 rounded px-1">Tier 1 AI vocab</mark>
              {" · "}
              <mark className="bg-orange-200 rounded px-1">Pattern phrases</mark>
              {" · "}
              <mark className="bg-yellow-200 rounded px-1">Tier 2 AI vocab</mark>
            </p>
          </CardHeader>
          <CardContent>
            <div className="text-sm leading-relaxed">
              {buildHeatmap(text, result.patterns)}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Humanize section */}
      {result && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Humanize Text</CardTitle>
            <p className="text-xs text-zinc-500">Rewrite with GPT-4o-mini to reduce your AI score.</p>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Tone selector + button */}
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <label className="text-sm text-zinc-600 dark:text-zinc-400">Tone:</label>
                <Select value={tone} onValueChange={(v) => setTone(v as ToneOption)}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="standard">Standard</SelectItem>
                    <SelectItem value="casual">Casual</SelectItem>
                    <SelectItem value="formal">
                      <span className="flex items-center gap-1">
                        Formal <Lock className="h-3 w-3 text-zinc-400" />
                      </span>
                    </SelectItem>
                    <SelectItem value="academic">
                      <span className="flex items-center gap-1">
                        Academic <Lock className="h-3 w-3 text-zinc-400" />
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button
                onClick={handleHumanize}
                disabled={humanizing || !documentId}
                className="bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                {humanizing ? (
                  <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Humanizing…</>
                ) : (
                  "Humanize Text →"
                )}
              </Button>
            </div>

            {/* Before/After panel */}
            {humanizedText && (
              <div className="space-y-4 mt-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Original */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">Original</p>
                      <Badge className={`${scoreBg(result.score)} text-white border-0`}>
                        {Math.round(result.score)} / 100
                      </Badge>
                    </div>
                    <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-lg p-3 text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed max-h-48 overflow-y-auto">
                      {text}
                    </div>
                    <div className="mt-2 w-full bg-zinc-100 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${scoreBg(result.score)}`}
                        style={{ width: `${result.score}%` }}
                      />
                    </div>
                  </div>

                  {/* Humanized */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">Humanized</p>
                      {humanizedScore !== null && (
                        <Badge className={`${scoreBg(humanizedScore)} text-white border-0`}>
                          {Math.round(humanizedScore)} / 100
                        </Badge>
                      )}
                    </div>
                    <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3 text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed max-h-48 overflow-y-auto">
                      {humanizedText}
                    </div>
                    {humanizedScore !== null && (
                      <div className="mt-2 w-full bg-zinc-100 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all duration-1000 ${scoreBg(humanizedScore)}`}
                          style={{ width: `${humanizedScore}%` }}
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* CTA */}
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleCopy}>
                    <Copy className="h-3.5 w-3.5 mr-1.5" />
                    Copy Humanized Text
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setText(humanizedText);
                      setResult(null);
                      setHumanizedText(null);
                      setDocumentId(null);
                    }}
                  >
                    Re-analyze Humanized
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
