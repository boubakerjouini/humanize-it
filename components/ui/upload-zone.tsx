"use client";

import { useState, useRef, useCallback } from "react";
import { Upload, FileUp, AlertTriangle, CheckCircle2, FileText, ArrowRight, RotateCcw, Lock } from "lucide-react";
import { extractTextFromFile, type ExtractResult } from "@/lib/extract-document";
import { PLANS, type PlanId } from "@/lib/plans";

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
        borderRadius: "12px", border: "1.5px dashed rgba(255,255,255,0.1)",
        padding: "32px 24px", textAlign: "center",
        background: "rgba(0,0,0,0.2)", position: "relative", overflow: "hidden",
      }}>
        <div style={{
          position: "absolute", inset: 0,
          background: "rgba(0,0,0,0.5)", backdropFilter: "blur(2px)",
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          zIndex: 2,
        }}>
          <Lock size={24} color="rgba(255,255,255,0.3)" style={{ marginBottom: "10px" }} />
          <p style={{ fontSize: "13px", fontWeight: 600, color: "rgba(255,255,255,0.6)", marginBottom: "6px" }}>
            Upload available on PRO &amp; TEAM plans
          </p>
          <a href="/dashboard/billing" style={{
            padding: "8px 18px", borderRadius: "7px", border: "1px solid rgba(139,92,246,0.3)",
            background: "rgba(139,92,246,0.1)", color: "#a78bfa",
            fontSize: "12px", fontWeight: 600, cursor: "pointer", textDecoration: "none",
            display: "inline-block", marginTop: "4px",
          }}>
            Upgrade
          </a>
        </div>
        <Upload size={28} color="rgba(255,255,255,0.1)" style={{ marginBottom: "8px" }} />
        <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.15)" }}>Drop your PDF, Word doc, or .txt here</p>
      </div>
    );
  }

  // SUCCESS state
  if (state === "success" && result) {
    const originalWordCount = truncated
      ? result.text.split(/\s+/).filter(Boolean).length + 1 // approximate
      : result.wordCount;

    return (
      <div style={{
        borderRadius: "12px", border: "1.5px solid rgba(34,197,94,0.25)",
        background: "#0f0f12", overflow: "hidden",
        animation: "fadeInUp 0.3s ease",
      }}>
        {/* File info header */}
        <div style={{
          padding: "12px 16px", borderBottom: "1px solid rgba(255,255,255,0.05)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <CheckCircle2 size={14} color="#22c55e" />
            <span style={{ fontSize: "12px", fontWeight: 600, color: "#22c55e" }}>Document loaded</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{
              fontSize: "10px", padding: "2px 7px", borderRadius: "4px", fontWeight: 700,
              background: "rgba(139,92,246,0.1)", color: "#a78bfa", textTransform: "uppercase",
            }}>
              {result.fileType}
            </span>
            {result.pageCount && (
              <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)" }}>
                {result.pageCount} page{result.pageCount !== 1 ? "s" : ""}
              </span>
            )}
          </div>
        </div>

        {/* File details */}
        <div style={{ padding: "12px 16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "8px" }}>
            <FileText size={12} color="rgba(255,255,255,0.3)" />
            <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.6)", fontWeight: 500 }}>
              {result.fileName}
            </span>
            <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.3)" }}>
              — {result.wordCount.toLocaleString()} words
            </span>
          </div>

          {/* Truncation warning */}
          {truncated && (
            <div style={{
              padding: "8px 12px", borderRadius: "8px", marginBottom: "10px",
              background: "rgba(234,179,8,0.08)", border: "1px solid rgba(234,179,8,0.2)",
              display: "flex", alignItems: "flex-start", gap: "8px",
            }}>
              <AlertTriangle size={13} color="#eab308" style={{ flexShrink: 0, marginTop: "1px" }} />
              <span style={{ fontSize: "11px", color: "#eab308", lineHeight: 1.5 }}>
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
            background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.05)",
            maxHeight: "100px", overflow: "auto",
          }}>
            <p style={{
              fontSize: "11px", color: "rgba(255,255,255,0.4)", lineHeight: 1.6,
              fontFamily: "monospace", whiteSpace: "pre-wrap", margin: 0,
            }}>
              {result.text.slice(0, 300)}{result.text.length > 300 ? "..." : ""}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div style={{
          padding: "10px 16px", borderTop: "1px solid rgba(255,255,255,0.05)",
          display: "flex", alignItems: "center", gap: "8px",
        }}>
          <button
            onClick={() => onExtracted(result)}
            style={{
              flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
              padding: "10px", borderRadius: "8px", border: "none",
              background: "linear-gradient(135deg, #8b5cf6, #7c3aed)",
              color: "#fff", fontSize: "13px", fontWeight: 700, cursor: "pointer",
              boxShadow: "0 4px 16px rgba(139,92,246,0.3)",
            }}
          >
            Use this text <ArrowRight size={12} />
          </button>
          <button
            onClick={reset}
            style={{
              display: "flex", alignItems: "center", gap: "5px",
              padding: "10px 14px", borderRadius: "8px",
              background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
              color: "rgba(255,255,255,0.4)", fontSize: "12px", cursor: "pointer",
            }}
          >
            <RotateCcw size={11} /> Different file
          </button>
        </div>
      </div>
    );
  }

  // ERROR state
  if (state === "error") {
    return (
      <div style={{
        borderRadius: "12px", border: "1.5px solid rgba(239,68,68,0.3)",
        padding: "24px", textAlign: "center", background: "rgba(239,68,68,0.04)",
        animation: "fadeInUp 0.3s ease",
      }}>
        <AlertTriangle size={28} color="#ef4444" style={{ marginBottom: "10px" }} />
        <p style={{ fontSize: "13px", color: "#ef4444", fontWeight: 600, marginBottom: "6px" }}>{error}</p>
        <button
          onClick={reset}
          style={{
            padding: "8px 18px", borderRadius: "7px", border: "1px solid rgba(239,68,68,0.25)",
            background: "rgba(239,68,68,0.08)", color: "#ef4444",
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
      <div style={{
        borderRadius: "12px", border: "1.5px dashed rgba(139,92,246,0.3)",
        padding: "32px 24px", textAlign: "center",
        background: "rgba(139,92,246,0.04)",
      }}>
        <div className="spin-sm" style={{ width: 24, height: 24, borderWidth: 2.5, margin: "0 auto 12px" }} />
        <p style={{ fontSize: "13px", color: "#a78bfa", fontWeight: 600 }}>Reading your document...</p>
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
      style={{
        borderRadius: "12px",
        border: `1.5px dashed ${isDragging ? "#3b82f6" : "rgba(113,113,122,0.4)"}`,
        padding: "28px 24px", textAlign: "center", cursor: "pointer",
        background: isDragging ? "rgba(59,130,246,0.06)" : "rgba(0,0,0,0.15)",
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
        color={isDragging ? "#3b82f6" : "rgba(255,255,255,0.25)"}
        style={{ marginBottom: "10px", transition: "all 0.2s" }}
      />
      <p style={{
        fontSize: "13px", fontWeight: 600, marginBottom: "4px",
        color: isDragging ? "#3b82f6" : "rgba(255,255,255,0.5)",
      }}>
        {isDragging ? "Drop to upload" : "Drop your PDF, Word doc, or .txt here"}
      </p>
      <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.25)", marginBottom: "12px" }}>
        or click to browse
      </p>
      <div style={{ display: "flex", justifyContent: "center", gap: "6px" }}>
        {["PDF", "DOCX", "TXT"].map((fmt) => (
          <span key={fmt} style={{
            fontSize: "10px", fontWeight: 700, padding: "3px 8px", borderRadius: "4px",
            background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
            color: "rgba(255,255,255,0.3)", letterSpacing: "0.5px",
          }}>
            {fmt}
          </span>
        ))}
      </div>
    </div>
  );
}
