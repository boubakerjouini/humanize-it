// ===========================================================
// workflows/humanize-document.ts — Durable document pipeline
//
// extract → detect → humanize (multi-pass) → re-score, as a Workflow DevKit
// workflow. Each stage is a retryable "use step" with full Node access; the
// workflow function only orchestrates. Progress is persisted on the Document
// row (status/stage/scores) AND streamed to the run's default stream so the
// review UI can show live progress. Because steps are durable, a serverless
// timeout or crash mid-humanize resumes instead of losing the whole job —
// the failure mode that made the old single-request flow unreliable.
// ===========================================================

import { getWritable } from "workflow";
import { db } from "@/lib/db";
import { analyzeText, type AnalysisResult } from "@/lib/algorithms/analyzeText";
import {
  humanizeText,
  type ToneOption,
  type IntensityLevel,
} from "@/lib/algorithms/humanizeText";
import { refundWordQuota } from "@/lib/quota";

export interface PipelineOptions {
  tone: ToneOption;
  intensity: IntensityLevel;
  language?: string;
  styleFingerprint?: Record<string, string>;
}

export type PipelineStage =
  | "detect"
  | "detected"
  | "humanize"
  | "humanized"
  | "score"
  | "complete"
  | "error";

export interface ProgressEvent {
  documentId: string;
  stage: PipelineStage;
  message?: string;
  originalScore?: number;
  humanizedScore?: number;
  patternCount?: number;
}

// Write a progress event to the run's default stream (called only inside steps).
async function emit(event: ProgressEvent): Promise<void> {
  const writer = getWritable<ProgressEvent>().getWriter();
  try {
    await writer.write(event);
  } finally {
    writer.releaseLock();
  }
}

// ---- Steps (full Node.js access) ----

async function detectStep(documentId: string): Promise<{ score: number; wordCount: number }> {
  "use step";
  const doc = await db.document.findUnique({ where: { id: documentId } });
  if (!doc) throw new Error("Document not found.");

  await db.document.update({
    where: { id: documentId },
    data: { status: "processing", stage: "detect" },
  });
  await emit({ documentId, stage: "detect", message: "Detecting AI patterns" });

  const analysis = analyzeText(doc.originalText);

  await db.document.update({
    where: { id: documentId },
    data: {
      analysisResult: JSON.parse(JSON.stringify(analysis)),
      overallScore: analysis.score,
      stage: "detected",
    },
  });
  await emit({
    documentId,
    stage: "detected",
    originalScore: analysis.score,
    patternCount: analysis.patterns.length,
  });

  return { score: analysis.score, wordCount: analysis.wordCount };
}

async function humanizeStep(
  documentId: string,
  options: PipelineOptions
): Promise<{ humanizedText: string; model: string }> {
  "use step";
  const doc = await db.document.findUnique({ where: { id: documentId } });
  if (!doc) throw new Error("Document not found.");

  await db.document.update({ where: { id: documentId }, data: { stage: "humanize" } });
  await emit({ documentId, stage: "humanize", message: "Humanizing your text" });

  const analysis = doc.analysisResult as unknown as AnalysisResult;
  const result = await humanizeText(
    doc.originalText,
    options.tone,
    analysis,
    options.intensity,
    options.styleFingerprint,
    options.language
  );

  // Never let an empty/refusal response overwrite the user's document.
  if (!result.humanizedText || result.humanizedText.trim().length === 0) {
    throw new Error("The rewrite returned no usable text.");
  }

  await db.document.update({
    where: { id: documentId },
    data: {
      rewrittenText: result.humanizedText,
      rewriteModel: result.model || "unknown",
      tone: options.tone,
      stage: "humanized",
    },
  });
  await emit({ documentId, stage: "humanized", message: "Re-scoring the result" });

  return { humanizedText: result.humanizedText, model: result.model };
}

async function scoreStep(documentId: string, humanizedText: string): Promise<{ score: number }> {
  "use step";
  // Surface the "score" stage so the UI's third progress step activates.
  await db.document.update({ where: { id: documentId }, data: { stage: "score" } });
  await emit({ documentId, stage: "score", message: "Re-scoring the result" });

  const analysis = analyzeText(humanizedText);

  await db.document.update({
    where: { id: documentId },
    data: {
      humanizedScore: analysis.score,
      status: "complete",
      stage: "complete",
    },
  });
  await emit({ documentId, stage: "complete", humanizedScore: analysis.score });

  return { score: analysis.score };
}

async function failDocumentStep(documentId: string, message: string): Promise<void> {
  "use step";
  const doc = await db.document.findUnique({ where: { id: documentId } });
  if (!doc) return;

  // Atomically claim the error transition. updateMany returns count=1 only for
  // the first execution; on a step retry it returns 0, so the refund below runs
  // exactly once even though steps have at-least-once semantics.
  const res = await db.document.updateMany({
    where: { id: documentId, status: { not: "error" } },
    data: { status: "error", stage: "error", errorMessage: message.slice(0, 300) },
  });
  if (res.count === 1) {
    await refundWordQuota(doc.userId, doc.wordCount);
  }
  await emit({ documentId, stage: "error", message });
}

// ---- Workflow (orchestrator only) ----

export async function humanizeDocumentWorkflow(
  documentId: string,
  options: PipelineOptions
): Promise<{ documentId: string; originalScore: number; humanizedScore: number; model: string }> {
  "use workflow";

  try {
    const detection = await detectStep(documentId);
    const humanized = await humanizeStep(documentId, options);
    const final = await scoreStep(documentId, humanized.humanizedText);
    return {
      documentId,
      originalScore: detection.score,
      humanizedScore: final.score,
      model: humanized.model,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Processing failed.";
    await failDocumentStep(documentId, message);
    throw err;
  }
}
