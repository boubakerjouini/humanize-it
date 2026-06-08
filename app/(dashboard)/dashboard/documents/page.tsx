"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useUser } from "@clerk/nextjs";
import Link from "next/link";
import {
  FileUp, FileText, Sparkles, Copy, Download, RotateCcw, CheckCircle2,
  AlertTriangle, ArrowRight, Loader2, Lock, ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { THEME, glow, humanScore, humanScoreColor, humanScoreLabel } from "@/lib/theme";
import { ScoreRing } from "@/components/ui/score-ring";
import { estimateEngineScores, type EngineScore } from "@/lib/engines";

type Tone = "standard" | "formal" | "casual" | "academic" | "storytelling" | "professional";
type Intensity = "light" | "medium" | "heavy";

interface PolledDoc {
  id: string;
  title: string | null;
  originalText: string;
  overallScore: number;
  rewrittenText: string | null;
  humanizedScore: number | null;
  rewriteModel: string | null;
  wordCount: number;
  status: string;
  stage: string | null;
  sourceType: string | null;
  pageCount: number | null;
  errorMessage: string | null;
  createdAt?: string;
}

const TONES: { value: Tone; label: string }[] = [
  { value: "standard", label: "Standard" },
  { value: "professional", label: "Professional" },
  { value: "academic", label: "Academic" },
  { value: "casual", label: "Casual" },
];

const STAGES: { key: string; label: string }[] = [
  { key: "detect", label: "Detect" },
  { key: "humanize", label: "Humanize" },
  { key: "score", label: "Score" },
];

function stageIndex(stage: string | null): number {
  switch (stage) {
    case "queued": return -1;
    case "detect": return 0;
    case "detected": return 0;
    case "humanize": return 1;
    case "humanized": return 1;
    case "score": return 2;
    case "complete": return 3;
    default: return -1;
  }
}

export default function DocumentsPage() {
  const { isSignedIn } = useUser();
  const [plan, setPlan] = useState<string>("FREE");
  const [mode, setMode] = useState<"upload" | "paste">("upload");
  const [text, setText] = useState("");
  const [tone, setTone] = useState<Tone>("standard");
  const [intensity, setIntensity] = useState<Intensity>("medium");
  const [dragging, setDragging] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [doc, setDoc] = useState<PolledDoc | null>(null);
  const [recent, setRecent] = useState<PolledDoc[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isPaid = plan === "PRO" || plan === "TEAM";

  useEffect(() => {
    fetch("/api/user-plan").then(r => r.json()).then(d => setPlan(d.plan ?? "FREE")).catch(() => {});
    // Only show finished documents in the recent list — a still-processing doc
    // has overallScore 0 (which would render as a misleading "100 human").
    fetch("/api/documents?limit=12")
      .then(r => r.json())
      .then(d => setRecent((d.documents ?? []).filter((x: PolledDoc) => x.status === "complete").slice(0, 6)))
      .catch(() => {});
  }, []);

  // Poll the processing document until it completes, errors, or we hit a safety
  // timeout (the durable workflow keeps running server-side regardless).
  const startPolling = useCallback((id: string) => {
    if (pollRef.current) clearInterval(pollRef.current);
    const startedAt = Date.now();
    const MAX_POLL_MS = 3 * 60_000;
    pollRef.current = setInterval(async () => {
      if (Date.now() - startedAt > MAX_POLL_MS) {
        if (pollRef.current) clearInterval(pollRef.current);
        pollRef.current = null;
        toast("Still processing in the background — it'll appear in History when done.", { icon: "⏳" });
        return;
      }
      try {
        const res = await fetch(`/api/documents/${id}`);
        if (!res.ok) return;
        const d = (await res.json()) as PolledDoc;
        setDoc(d);
        if (d.status === "complete" || d.status === "error") {
          if (pollRef.current) clearInterval(pollRef.current);
          pollRef.current = null;
          if (d.status === "error") toast.error(d.errorMessage ?? "Processing failed.");
        }
      } catch { /* keep polling */ }
    }, 1200);
  }, []);

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  const submit = useCallback(async (payload: FormData | string) => {
    if (!isSignedIn) { toast.error("Please sign in first."); return; }
    setSubmitting(true);
    setDoc(null);
    try {
      const res = await fetch("/api/documents/process", {
        method: "POST",
        ...(typeof payload === "string"
          ? { headers: { "Content-Type": "application/json" }, body: payload }
          : { body: payload }),
      });
      const data = await res.json() as { documentId?: string; truncated?: boolean; error?: { message: string } };
      if (!res.ok || !data.documentId) {
        toast.error(data.error?.message ?? "Could not start processing.");
        return;
      }
      if (data.truncated) toast("Document exceeded your plan limit — only the first part was processed.", { icon: "✂️" });
      // Seed an optimistic processing doc, then poll.
      setDoc({
        id: data.documentId, title: null, originalText: "", overallScore: 0,
        rewrittenText: null, humanizedScore: null, rewriteModel: null, wordCount: 0,
        status: "processing", stage: "queued", sourceType: null, pageCount: null, errorMessage: null,
      });
      startPolling(data.documentId);
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }, [isSignedIn, startPolling]);

  const handleFile = useCallback((file: File) => {
    const form = new FormData();
    form.append("file", file);
    form.append("tone", tone);
    form.append("intensity", intensity);
    void submit(form);
  }, [tone, intensity, submit]);

  const handlePaste = useCallback(() => {
    if (text.trim().length < 10) { toast.error("Enter at least 10 characters."); return; }
    void submit(JSON.stringify({ text, tone, intensity }));
  }, [text, tone, intensity, submit]);

  const reset = () => { setDoc(null); setText(""); if (pollRef.current) clearInterval(pollRef.current); };

  // ── Locked state for FREE ──
  if (!isPaid) {
    return (
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "48px 24px", fontFamily: THEME.fontSans }}>
        <div style={{
          background: THEME.surface2, border: `1px solid ${THEME.border}`, borderRadius: THEME.radiusXl,
          padding: "40px 32px", textAlign: "center", boxShadow: glow(THEME.brand, 0.14),
        }}>
          <div style={{ width: 48, height: 48, borderRadius: 14, background: THEME.brandDim, display: "grid", placeItems: "center", margin: "0 auto 16px" }}>
            <Lock size={22} color={THEME.brand} aria-hidden="true" />
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: THEME.text, fontFamily: THEME.fontHeading, marginBottom: 8 }}>Document Review</h1>
          <p style={{ fontSize: 14, color: THEME.textDim, lineHeight: 1.6, maxWidth: 420, margin: "0 auto 24px" }}>
            Upload a PDF or Word doc and we&apos;ll detect AI patterns and humanize the whole thing in one pass — durable, so even large files finish reliably. Available on Pro &amp; Team.
          </p>
          <Link href="/dashboard/settings" style={{
            display: "inline-flex", alignItems: "center", gap: 6, padding: "11px 22px",
            background: THEME.brand, color: "#fff", borderRadius: 12, fontSize: 14, fontWeight: 700,
            textDecoration: "none", boxShadow: glow(THEME.brand, 0.3),
          }}>
            Upgrade to unlock <ArrowRight size={15} aria-hidden="true" />
          </Link>
        </div>
      </div>
    );
  }

  const sIdx = doc ? stageIndex(doc.stage) : -1;
  const isProcessing = doc?.status === "processing";
  const isComplete = doc?.status === "complete" && doc.rewrittenText;

  return (
    <div style={{ maxWidth: 920, margin: "0 auto", padding: "28px 24px 64px", fontFamily: THEME.fontSans }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: THEME.text, fontFamily: THEME.fontHeading, letterSpacing: "-0.02em", marginBottom: 4, display: "flex", alignItems: "center", gap: 10 }}>
          <FileText size={20} color={THEME.brand} aria-hidden="true" /> Document Review
        </h1>
        <p style={{ fontSize: 14, color: THEME.textDim }}>
          Upload a PDF, Word doc, or paste text. We detect AI patterns and humanize the whole document in one durable pass.
        </p>
      </div>

      {!doc && (
        <>
          {/* Mode toggle */}
          <div style={{ display: "flex", gap: 4, background: THEME.surface2, borderRadius: 10, padding: 4, border: `1px solid ${THEME.border}`, width: "fit-content", marginBottom: 16 }}>
            {(["upload", "paste"] as const).map(m => (
              <button key={m} onClick={() => setMode(m)} style={{
                padding: "7px 16px", borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: "pointer", border: "none",
                background: mode === m ? THEME.brandDim : "transparent",
                color: mode === m ? THEME.brandHi : THEME.textDim, textTransform: "capitalize",
              }}>{m === "upload" ? "Upload file" : "Paste text"}</button>
            ))}
          </div>

          {/* Upload / Paste */}
          {mode === "upload" ? (
            <div
              onDragOver={e => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
              onClick={() => fileRef.current?.click()}
              role="button" tabIndex={0}
              onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fileRef.current?.click(); } }}
              aria-label="Upload a document"
              style={{
                borderRadius: THEME.radiusLg, border: `1.5px dashed ${dragging ? THEME.brand : THEME.borderStrong}`,
                padding: "44px 24px", textAlign: "center", cursor: "pointer",
                background: dragging ? THEME.brandDim : THEME.surface1,
                boxShadow: dragging ? glow(THEME.brand, 0.2) : "none", transition: "all 0.2s",
              }}
            >
              <input ref={fileRef} type="file" accept=".pdf,.docx,.txt,.md" style={{ display: "none" }}
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); if (e.target) e.target.value = ""; }} />
              <FileUp size={32} color={dragging ? THEME.brand : THEME.textDim} style={{ marginBottom: 12 }} aria-hidden="true" />
              <p style={{ fontSize: 15, fontWeight: 600, color: dragging ? THEME.brandHi : THEME.text, marginBottom: 4 }}>
                {dragging ? "Drop to upload" : "Drop your document here"}
              </p>
              <p style={{ fontSize: 12, color: THEME.textDim, marginBottom: 14 }}>PDF, DOCX, or TXT · up to 20 MB · extracted on our servers</p>
              <div style={{ display: "flex", justifyContent: "center", gap: 6 }}>
                {["PDF", "DOCX", "TXT"].map(f => (
                  <span key={f} style={{ fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 999, background: THEME.surface2, border: `1px solid ${THEME.border}`, color: THEME.textDim }}>{f}</span>
                ))}
              </div>
            </div>
          ) : (
            <div>
              <textarea
                value={text}
                onChange={e => setText(e.target.value)}
                placeholder="Paste the text you want reviewed and humanized…"
                style={{
                  width: "100%", minHeight: 200, padding: 16, borderRadius: THEME.radiusLg,
                  border: `1px solid ${THEME.border}`, background: THEME.surface2, color: THEME.text,
                  fontSize: 14, lineHeight: 1.6, resize: "vertical", outline: "none", fontFamily: THEME.fontSans,
                }}
              />
              <div style={{ fontSize: 12, color: THEME.textMuted, marginTop: 6 }}>
                {text.trim() ? text.trim().split(/\s+/).length.toLocaleString() : 0} words
              </div>
            </div>
          )}

          {/* Options + submit */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 16, flexWrap: "wrap" }}>
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              {TONES.map(t => (
                <button key={t.value} onClick={() => setTone(t.value)} style={{
                  padding: "6px 12px", borderRadius: 999, fontSize: 12, fontWeight: tone === t.value ? 700 : 500, cursor: "pointer",
                  border: `1px solid ${tone === t.value ? THEME.brand + "66" : THEME.border}`,
                  background: tone === t.value ? THEME.brandDim : THEME.surface2,
                  color: tone === t.value ? THEME.brandHi : THEME.textDim,
                }}>{t.label}</button>
              ))}
            </div>
            {mode === "paste" && (
              <button onClick={handlePaste} disabled={submitting} style={{
                marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 20px",
                background: THEME.brand, color: "#fff", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 700,
                cursor: submitting ? "not-allowed" : "pointer", boxShadow: glow(THEME.brand, 0.28),
              }}>
                {submitting ? <Loader2 size={15} className="spin" aria-hidden="true" /> : <Sparkles size={15} aria-hidden="true" />}
                Review &amp; humanize
              </button>
            )}
          </div>
        </>
      )}

      {/* Processing / Result */}
      {doc && (
        <div style={{ animation: "fadeInUp 0.3s ease" }}>
          {/* Pipeline progress */}
          {isProcessing && (
            <div style={{ background: THEME.surface2, border: `1px solid ${THEME.border}`, borderRadius: THEME.radiusXl, padding: "28px 24px", marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
                <Loader2 size={16} className="spin" color={THEME.brand} aria-hidden="true" />
                <span style={{ fontSize: 14, fontWeight: 600, color: THEME.text }}>Processing your document…</span>
                <span style={{ marginLeft: "auto", fontSize: 11, color: THEME.textMuted, display: "inline-flex", alignItems: "center", gap: 4 }}>
                  <ShieldCheck size={12} aria-hidden="true" /> Durable — survives timeouts
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
                {STAGES.map((s, i) => {
                  const done = sIdx > i || doc.status === "complete";
                  const active = sIdx === i;
                  return (
                    <div key={s.key} style={{ display: "flex", alignItems: "center", flex: i < STAGES.length - 1 ? 1 : "0 0 auto" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{
                          width: 28, height: 28, borderRadius: "50%", display: "grid", placeItems: "center",
                          background: done ? THEME.human : active ? THEME.brand : THEME.surface3,
                          color: done || active ? "#fff" : THEME.textMuted, flexShrink: 0,
                          border: done || active ? "none" : `1px solid ${THEME.border}`,
                        }}>
                          {done ? <CheckCircle2 size={15} aria-hidden="true" /> : active ? <Loader2 size={14} className="spin" aria-hidden="true" /> : i + 1}
                        </div>
                        <span style={{ fontSize: 13, fontWeight: done || active ? 600 : 500, color: done ? THEME.human : active ? THEME.brandHi : THEME.textDim }}>{s.label}</span>
                      </div>
                      {i < STAGES.length - 1 && (
                        <div style={{ flex: 1, height: 2, margin: "0 12px", background: done ? THEME.human : THEME.border }} />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Error */}
          {doc.status === "error" && (
            <div role="alert" style={{ background: THEME.aiDim, border: `1px solid ${THEME.ai}40`, borderRadius: THEME.radiusLg, padding: "20px 24px", marginBottom: 20 }}>
              <p style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 700, color: THEME.ai, marginBottom: 4 }}>
                <AlertTriangle size={16} aria-hidden="true" /> Processing failed
              </p>
              <p style={{ fontSize: 13, color: THEME.textDim }}>{doc.errorMessage ?? "Something went wrong. Your quota was refunded."}</p>
            </div>
          )}

          {/* Result */}
          {isComplete && (
            <ResultView doc={doc} />
          )}

          <button onClick={reset} style={{
            display: "inline-flex", alignItems: "center", gap: 6, marginTop: 16,
            background: THEME.surface2, border: `1px solid ${THEME.border}`, borderRadius: 10,
            padding: "9px 16px", color: THEME.textDim, fontSize: 13, fontWeight: 600, cursor: "pointer",
          }}>
            <RotateCcw size={13} aria-hidden="true" /> Review another document
          </button>
        </div>
      )}

      {/* Recent */}
      {!doc && recent.length > 0 && (
        <div style={{ marginTop: 36 }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: THEME.text, fontFamily: THEME.fontHeading, marginBottom: 12 }}>Recent documents</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {recent.map(d => {
              const orig = humanScore(d.overallScore);
              const hum = d.humanizedScore != null ? humanScore(d.humanizedScore) : null;
              return (
                <Link key={d.id} href={`/dashboard/editor?doc=${d.id}`} style={{ textDecoration: "none" }}>
                  <div style={{ background: THEME.surface2, border: `1px solid ${THEME.border}`, borderRadius: THEME.radiusLg, padding: "12px 16px", display: "flex", alignItems: "center", gap: 12 }}>
                    <FileText size={15} color={THEME.textMuted} aria-hidden="true" />
                    <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: THEME.textDim, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.title || d.originalText?.slice(0, 60) || "Untitled"}</span>
                    <span className="tnum" style={{ fontSize: 12, color: humanScoreColor(orig), fontWeight: 700 }}>{orig}</span>
                    {hum != null && <><ArrowRight size={11} color={THEME.textMuted} aria-hidden="true" /><span className="tnum" style={{ fontSize: 12, color: humanScoreColor(hum), fontWeight: 700 }}>{hum}</span></>}
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      <style>{`.spin { animation: spin 0.8s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ── Before/after result view ──
function ResultView({ doc }: { doc: PolledDoc }) {
  const [copied, setCopied] = useState(false);
  const origHuman = humanScore(doc.overallScore);
  const humHuman = doc.humanizedScore != null ? humanScore(doc.humanizedScore) : origHuman;
  const engines: EngineScore[] = estimateEngineScores(doc.humanizedScore ?? doc.overallScore);

  const copy = async () => {
    if (!doc.rewrittenText) return;
    await navigator.clipboard.writeText(doc.rewrittenText);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };
  const download = () => {
    if (!doc.rewrittenText) return;
    const blob = new Blob([doc.rewrittenText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `humanized-${(doc.title ?? "document").replace(/\.[^.]+$/, "")}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      {/* Score comparison */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginBottom: 20 }}>
        <div style={{ background: THEME.surface2, border: `1px solid ${THEME.border}`, borderRadius: THEME.radiusLg, padding: 20, textAlign: "center" }}>
          <div style={{ fontSize: 11, color: THEME.textDim, fontWeight: 600, marginBottom: 12 }}>BEFORE</div>
          <ScoreRing score={doc.overallScore} size={84} hideLabel />
          <div style={{ fontSize: 12, color: humanScoreColor(origHuman), fontWeight: 600, marginTop: 8 }}>{humanScoreLabel(origHuman)}</div>
        </div>
        <div style={{ background: THEME.surface2, border: `1px solid ${THEME.human}33`, borderRadius: THEME.radiusLg, padding: 20, textAlign: "center", boxShadow: glow(THEME.human, 0.14) }}>
          <div style={{ fontSize: 11, color: THEME.human, fontWeight: 600, marginBottom: 12 }}>AFTER</div>
          <ScoreRing score={doc.humanizedScore ?? doc.overallScore} size={84} hideLabel />
          <div style={{ fontSize: 12, color: humanScoreColor(humHuman), fontWeight: 600, marginTop: 8 }}>{humanScoreLabel(humHuman)}</div>
        </div>
      </div>

      {/* Estimated detector risk */}
      <div style={{ background: THEME.surface2, border: `1px solid ${THEME.border}`, borderRadius: THEME.radiusLg, padding: 16, marginBottom: 20 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: THEME.text, marginBottom: 4 }}>Estimated detector risk</div>
        <div style={{ fontSize: 11, color: THEME.textMuted, marginBottom: 12 }}>Modelled from our detector — not live third-party API calls.</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {engines.map(e => (
            <div key={e.engine} style={{
              display: "flex", alignItems: "center", gap: 6, padding: "5px 10px", borderRadius: 999,
              background: e.status === "PASS" ? THEME.humanDim : e.status === "RISKY" ? THEME.warnDim : THEME.aiDim,
              border: `1px solid ${e.status === "PASS" ? THEME.human : e.status === "RISKY" ? THEME.warn : THEME.ai}33`,
            }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: THEME.textDim }}>{e.engine}</span>
              <span className="tnum" style={{ fontSize: 11, fontWeight: 700, color: e.status === "PASS" ? THEME.human : e.status === "RISKY" ? THEME.warn : THEME.ai }}>~{e.score}%</span>
            </div>
          ))}
        </div>
      </div>

      {/* Humanized text */}
      <div style={{ background: THEME.surface2, border: `1px solid ${THEME.border}`, borderRadius: THEME.radiusLg, overflow: "hidden" }}>
        <div style={{ padding: "12px 16px", borderBottom: `1px solid ${THEME.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: THEME.text }}>Humanized document</span>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={copy} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "6px 12px", background: THEME.surface3, border: `1px solid ${THEME.border}`, borderRadius: 8, fontSize: 12, fontWeight: 600, color: THEME.text, cursor: "pointer" }}>
              {copied ? <CheckCircle2 size={13} color={THEME.human} aria-hidden="true" /> : <Copy size={13} aria-hidden="true" />} {copied ? "Copied" : "Copy"}
            </button>
            <button onClick={download} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "6px 12px", background: THEME.brand, border: "none", borderRadius: 8, fontSize: 12, fontWeight: 600, color: "#fff", cursor: "pointer" }}>
              <Download size={13} aria-hidden="true" /> .txt
            </button>
          </div>
        </div>
        <div style={{ padding: 18, maxHeight: 420, overflow: "auto", fontSize: 14, lineHeight: 1.7, color: THEME.text, whiteSpace: "pre-wrap" }}>
          {doc.rewrittenText}
        </div>
      </div>
    </div>
  );
}
