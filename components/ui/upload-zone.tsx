"use client";

import { useState, useRef, useCallback } from "react";
import { Upload, FileUp, AlertTriangle, CheckCircle2, FileText, ArrowRight, RotateCcw, Lock } from "lucide-react";
import { extractTextFromFile, type ExtractResult } from "@/lib/extract-document";
import { PLANS, type PlanId } from "@/lib/plans";
import { THEME, glow } from "@/lib/theme";

type UploadState = "idle" | "dragging" | "extracting" | "error" | "success";

interface UploadZoneProps {
  onExtracted: (result: ExtractResult) => void;
  plan: string;
  uploadEnabled: boolean;
}

const ACCEPTED = ".pdf,.docx,.txt";
const ACCEPT_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
];

export function UploadZone({ onExtracted, plan, uploadEnabled }: UploadZoneProps) {
  const [state, setState] = useState<UploadState>("idle");
  const [error, setError] = useState("");
  const [result, setResult] = useState<ExtractResult | null>(null);
  const [truncated, setTruncated] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const planConfig = PLANS[plan as PlanId] ?? PLANS.FREE;

  const handleFile = useCallback(async (file: File) => {
    setState("extracting");
    setError("");
    setResult(null);
    setTruncated(false);

    try {
      const extracted = await extractTextFromFile(file);

      // Truncate if over plan word limit
      if (planConfig.uploadMaxWords > 0 && extracted.wordCount > planConfig.uploadMaxWords) {
        const words = extracted.text.split(/\s+/);
        extracted.text = words.slice(0, planConfig.uploadMaxWords).join(" ");
        extracted.wordCount = planConfig.uploadMaxWords;
        setTruncated(true);
      }

      setResult(extracted);
      setState("success");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to extract text.");
      setState("error");
    }
  }, [planConfig.uploadMaxWords]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setState("idle");
    const file = e.dataTransfer.files[0];
    if (file) void handleFile(file);
  }, [handleFile]);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (uploadEnabled) setState("dragging");
  }, [uploadEnabled]);

  const onDragLeave = useCallback(() => setState("idle"), []);

  const onFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void handleFile(file);
    if (e.target) e.target.value = "";
  }, [handleFile]);

  const reset = useCallback(() => {
    setState("idle");
    setError("");
    setResult(null);
    setTruncated(false);
  }, []);

  // FREE plan locked overlay
  if (!uploadEnabled) {
    return (
      <div style={{
        borderRadius: THEME.radiusLg, border: `1.5px dashed ${THEME.borderStrong}`,
        padding: "32px 24px", textAlign: "center",
        background: THEME.surface1, position: "relative", overflow: "hidden",
      }}>
        <div style={{
          position: "absolute", inset: 0,
          background: "rgba(255,255,255,0.82)", backdropFilter: "blur(2px)",
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          zIndex: 2,
        }}>
          <div style={{
            display: "grid", placeItems: "center", width: 40, height: 40,
            borderRadius: "50%", background: THEME.brandDim, marginBottom: "12px",
          }}>
            <Lock size={18} color={THEME.brand} aria-hidden="true" />
          </div>
          <p style={{ fontSize: "13px", fontWeight: 600, color: THEME.text, marginBottom: "8px" }}>
            Upload available on PRO &amp; TEAM plans
          </p>
          <a href="/dashboard/settings" style={{
            padding: "8px 18px", borderRadius: "8px", border: "none",
            background: THEME.brand, color: "#fff",
            fontSize: "12px", fontWeight: 600, cursor: "pointer", textDecoration: "none",
            display: "inline-block", marginTop: "4px",
            boxShadow: glow(THEME.brand, 0.24),
          }}>
            Upgrade
          </a>
        </div>
        <Upload size={28} color={THEME.textMuted} style={{ marginBottom: "8px" }} aria-hidden="true" />
        <p style={{ fontSize: "13px", color: THEME.textDim }}>Drop your PDF, Word doc, or .txt here</p>
      </div>
    );
  }

  // SUCCESS state
  if (state === "success" && result) {
    const originalWordCount = truncated
      ? result.text.split(/\s+/).filter(Boolean).length + 1 // approximate
      : result.wordCount;

    return (
      <div
        role="status"
        aria-live="polite"
        style={{
          borderRadius: THEME.radius, border: `1.5px solid ${THEME.human}40`,
          background: THEME.surface2, overflow: "hidden",
          animation: "fadeInUp 0.3s ease",
        }}
      >
        {/* File info header */}
        <div style={{
          padding: "12px 16px", borderBottom: `1px solid ${THEME.border}`,
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <CheckCircle2 size={14} color={THEME.human} aria-hidden="true" />
            <span style={{ fontSize: "12px", fontWeight: 600, color: THEME.human }}>Document loaded</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{
              fontSize: "10px", padding: "3px 8px", borderRadius: "999px", fontWeight: 700,
              background: THEME.brandDim, color: THEME.brandHi, textTransform: "uppercase",
              letterSpacing: "0.04em",
            }}>
              {result.fileType}
            </span>
            {result.pageCount && (
              <span style={{ fontSize: "11px", color: THEME.textDim }}>
                {result.pageCount} page{result.pageCount !== 1 ? "s" : ""}
              </span>
            )}
          </div>
        </div>

        {/* File details */}
        <div style={{ padding: "12px 16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "8px" }}>
            <FileText size={12} color={THEME.textDim} aria-hidden="true" />
            <span style={{ fontSize: "12px", color: THEME.text, fontWeight: 500 }}>
              {result.fileName}
            </span>
            <span style={{ fontSize: "11px", color: THEME.textDim }}>
              —{" "}
              <span style={{ fontFamily: THEME.fontMono, fontVariantNumeric: "tabular-nums" }}>
                {result.wordCount.toLocaleString()}
              </span>{" "}
              words
            </span>
          </div>

          {/* Truncation warning */}
          {truncated && (
            <div style={{
              padding: "8px 12px", borderRadius: "8px", marginBottom: "10px",
              background: THEME.warnDim, border: `1px solid ${THEME.warn}33`,
              display: "flex", alignItems: "flex-start", gap: "8px",
            }}>
              <AlertTriangle size={13} color={THEME.warn} style={{ flexShrink: 0, marginTop: "1px" }} aria-hidden="true" />
              <span style={{ fontSize: "11px", color: THEME.warn, lineHeight: 1.5 }}>
                Your document has {originalWordCount.toLocaleString()}+ words.{" "}
                {plan === "PRO" ? "PRO" : "TEAM"} plan supports up to{" "}
                {planConfig.uploadMaxWords.toLocaleString()}. Only the first{" "}
                {planConfig.uploadMaxWords.toLocaleString()} words will be analyzed.
              </span>
            </div>
          )}

          {/* Preview */}
          <div style={{
            padding: "10px 12px", borderRadius: "8px",
            background: THEME.surface1, border: `1px solid ${THEME.border}`,
            maxHeight: "100px", overflow: "auto",
          }}>
            <p style={{
              fontSize: "12px", color: THEME.textDim, lineHeight: 1.6,
              whiteSpace: "pre-wrap", margin: 0,
            }}>
              {result.text.slice(0, 300)}{result.text.length > 300 ? "..." : ""}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div style={{
          padding: "10px 16px", borderTop: `1px solid ${THEME.border}`,
          display: "flex", alignItems: "center", gap: "8px",
        }}>
          <button
            onClick={() => onExtracted(result)}
            style={{
              flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
              padding: "10px", borderRadius: "8px", border: "none",
              background: THEME.brand,
              color: "#fff", fontSize: "13px", fontWeight: 700, cursor: "pointer",
              boxShadow: glow(THEME.brand, 0.28),
            }}
          >
            Use this text <ArrowRight size={12} aria-hidden="true" />
          </button>
          <button
            onClick={reset}
            style={{
              display: "flex", alignItems: "center", gap: "5px",
              padding: "10px 14px", borderRadius: "8px",
              background: THEME.surface3, border: `1px solid ${THEME.border}`,
              color: THEME.textDim, fontSize: "12px", cursor: "pointer",
            }}
          >
            <RotateCcw size={11} aria-hidden="true" /> Different file
          </button>
        </div>
      </div>
    );
  }

  // ERROR state
  if (state === "error") {
    return (
      <div
        role="alert"
        aria-live="polite"
        style={{
          borderRadius: THEME.radius, border: `1.5px solid ${THEME.ai}4d`,
          padding: "24px", textAlign: "center", background: THEME.aiDim,
          animation: "fadeInUp 0.3s ease",
        }}
      >
        <AlertTriangle size={28} color={THEME.ai} style={{ marginBottom: "10px" }} aria-hidden="true" />
        <p style={{ fontSize: "13px", color: THEME.ai, fontWeight: 600, marginBottom: "6px" }}>{error}</p>
        <button
          onClick={reset}
          style={{
            padding: "8px 18px", borderRadius: "7px", border: `1px solid ${THEME.ai}40`,
            background: `${THEME.ai}1a`, color: THEME.ai,
            fontSize: "12px", fontWeight: 600, cursor: "pointer", marginTop: "6px",
          }}
        >
          Try again
        </button>
      </div>
    );
  }

  // EXTRACTING state
  if (state === "extracting") {
    return (
      <div
        role="status"
        aria-live="polite"
        style={{
          borderRadius: THEME.radius, border: `1.5px dashed ${THEME.brand}4d`,
          padding: "32px 24px", textAlign: "center",
          background: THEME.brandDim,
        }}
      >
        <div className="spin-sm" style={{ width: 24, height: 24, borderWidth: 2.5, margin: "0 auto 12px" }} />
        <p style={{ fontSize: "13px", color: THEME.brandHi, fontWeight: 600 }}>Reading your document...</p>
      </div>
    );
  }

  // IDLE / DRAGGING
  const isDragging = state === "dragging";

  return (
    <div
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onClick={() => fileRef.current?.click()}
      role="button"
      tabIndex={0}
      aria-label="Upload a PDF, Word doc, or .txt file"
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          fileRef.current?.click();
        }
      }}
      style={{
        borderRadius: THEME.radiusLg,
        border: `1.5px dashed ${isDragging ? THEME.brand : THEME.borderStrong}`,
        padding: "30px 24px", textAlign: "center", cursor: "pointer",
        background: isDragging ? THEME.brandDim : THEME.surface1,
        boxShadow: isDragging ? glow(THEME.brand, 0.2) : "none",
        transition: "all 0.2s ease",
      }}
    >
      <input
        ref={fileRef}
        type="file"
        accept={ACCEPTED}
        onChange={onFileChange}
        style={{ display: "none" }}
      />
      <FileUp
        size={isDragging ? 32 : 28}
        color={isDragging ? THEME.brand : THEME.textDim}
        style={{ marginBottom: "10px", transition: "all 0.2s" }}
        aria-hidden="true"
      />
      <p style={{
        fontSize: "13px", fontWeight: 600, marginBottom: "4px",
        color: isDragging ? THEME.brandHi : THEME.text,
      }}>
        {isDragging ? "Drop to upload" : "Drop your PDF, Word doc, or .txt here"}
      </p>
      <p style={{ fontSize: "11px", color: THEME.textDim, marginBottom: "12px" }}>
        or click to browse
      </p>
      <div style={{ display: "flex", justifyContent: "center", gap: "6px" }}>
        {["PDF", "DOCX", "TXT"].map((fmt) => (
          <span key={fmt} style={{
            fontSize: "11px", fontWeight: 600, padding: "3px 10px", borderRadius: "999px",
            background: THEME.surface1, border: `1px solid ${THEME.border}`,
            color: THEME.textDim,
          }}>
            {fmt}
          </span>
        ))}
      </div>
    </div>
  );
}
