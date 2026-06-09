// ===========================================================
// POST /api/documents/process — Start the durable document pipeline
//
// Accepts either a multipart file upload (PDF/DOCX/TXT) or a JSON { text }
// body, extracts text server-side, reserves the word quota, creates a
// Document in "processing" state, and launches humanizeDocumentWorkflow.
// Returns immediately with { documentId, runId }; the review UI polls
// GET /api/documents/:id for live status.
// ===========================================================

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { start } from "workflow/api";
import { db } from "@/lib/db";
import { ensureUser } from "@/lib/user";
import { checkAndResetQuota, planConfigFor, consumeWordQuota, refundWordQuota } from "@/lib/quota";
import { checkRateLimit, rateLimitHeaders } from "@/lib/rate-limit";
import { extractFromBuffer } from "@/lib/extract-server";
import { activeProvider } from "@/lib/llm";
import { trackServer } from "@/lib/posthog";
import {
  humanizeDocumentWorkflow,
  type PipelineOptions,
} from "@/workflows/humanize-document";
import type { ToneOption, IntensityLevel } from "@/lib/algorithms/humanizeText";

const VALID_TONES: ToneOption[] = ["standard", "formal", "casual", "academic", "storytelling", "professional"];
const VALID_INTENSITIES: IntensityLevel[] = ["light", "medium", "heavy"];

export async function POST(req: Request) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Authentication required." } },
        { status: 401 }
      );
    }

    // Fail fast if no model provider is configured — don't leave users waiting.
    if (activeProvider() === "none") {
      return NextResponse.json(
        { error: { code: "AI_NOT_CONFIGURED", message: "AI is not configured on the server. Contact support." } },
        { status: 503 }
      );
    }

    const user = await ensureUser(clerkId);
    const freshUser = await checkAndResetQuota(user);
    const plan = planConfigFor(freshUser);

    // Document pipeline is a paid feature.
    if (!plan.uploadEnabled) {
      return NextResponse.json(
        { error: { code: "UPGRADE_REQUIRED", message: "Document review is available on Pro and Team plans." } },
        { status: 402 }
      );
    }

    // Rate limit.
    const rl = await checkRateLimit(`docproc:${freshUser.id}`, plan.rateLimit);
    const rlHeaders = rateLimitHeaders(rl);
    if (!rl.ok) {
      return NextResponse.json(
        { error: { code: "RATE_LIMITED", message: "Too many requests. Please slow down." } },
        { status: 429, headers: { ...rlHeaders, "Retry-After": String(rl.retryAfterSeconds) } }
      );
    }

    // ── Resolve input text (file upload or JSON paste) ──
    const contentType = req.headers.get("content-type") ?? "";
    let text = "";
    let sourceType: string = "paste";
    let pageCount: number | undefined;
    let fileName = "Pasted text";
    let options: PipelineOptions = { tone: "standard", intensity: "medium" };
    let truncated = false;

    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file");
      if (!(file instanceof File)) {
        return NextResponse.json(
          { error: { code: "NO_FILE", message: "No file was uploaded." } },
          { status: 400, headers: rlHeaders }
        );
      }
      const buffer = Buffer.from(await file.arrayBuffer());
      try {
        const extracted = await extractFromBuffer(buffer, file.name);
        text = extracted.text;
        sourceType = extracted.fileType;
        pageCount = extracted.pageCount;
        fileName = file.name;
      } catch (err) {
        return NextResponse.json(
          { error: { code: "EXTRACT_FAILED", message: err instanceof Error ? err.message : "Could not read the file." } },
          { status: 400, headers: rlHeaders }
        );
      }
      const tone = form.get("tone");
      const intensity = form.get("intensity");
      const language = form.get("language");
      options = {
        tone: typeof tone === "string" && VALID_TONES.includes(tone as ToneOption) ? (tone as ToneOption) : "standard",
        intensity: typeof intensity === "string" && VALID_INTENSITIES.includes(intensity as IntensityLevel) ? (intensity as IntensityLevel) : "medium",
        language: typeof language === "string" && language ? language : undefined,
      };
    } else {
      let body: {
        text?: unknown; tone?: unknown; intensity?: unknown; language?: unknown;
        styleFingerprint?: unknown;
      };
      try {
        body = await req.json();
      } catch {
        return NextResponse.json(
          { error: { code: "INVALID_JSON", message: "Invalid JSON body." } },
          { status: 400, headers: rlHeaders }
        );
      }
      if (typeof body.text !== "string" || body.text.trim().length < 10) {
        return NextResponse.json(
          { error: { code: "TEXT_TOO_SHORT", message: "Provide at least 10 characters of text." } },
          { status: 400, headers: rlHeaders }
        );
      }
      text = body.text;
      sourceType = "paste";
      options = {
        tone: typeof body.tone === "string" && VALID_TONES.includes(body.tone as ToneOption) ? (body.tone as ToneOption) : "standard",
        intensity: typeof body.intensity === "string" && VALID_INTENSITIES.includes(body.intensity as IntensityLevel) ? (body.intensity as IntensityLevel) : "medium",
        language: typeof body.language === "string" && body.language ? body.language : undefined,
        styleFingerprint:
          typeof body.styleFingerprint === "object" && body.styleFingerprint !== null
            ? (body.styleFingerprint as Record<string, string>)
            : undefined,
      };
    }

    // Enforce the plan's per-document word ceiling (truncate, don't reject).
    let wordCount = text.split(/\s+/).filter(Boolean).length;
    if (plan.uploadMaxWords > 0 && wordCount > plan.uploadMaxWords) {
      text = text.split(/\s+/).slice(0, plan.uploadMaxWords).join(" ");
      wordCount = plan.uploadMaxWords;
      truncated = true;
    }

    // Atomically reserve the word quota (refunded by the workflow on failure).
    const reserved = await consumeWordQuota(freshUser.id, wordCount, plan);
    if (!reserved) {
      return NextResponse.json(
        { error: { code: "QUOTA_EXCEEDED", message: `You've used your ${plan.wordsLimitPeriod}ly word allowance. Upgrade for more.` } },
        { status: 402, headers: rlHeaders }
      );
    }

    // Create the Document in processing state. If creation fails, the quota was
    // already reserved above with no workflow to refund it — refund here.
    const title = (fileName !== "Pasted text" ? fileName : text.trim().slice(0, 60)).replace(/\s+/g, " ");
    let document: { id: string };
    try {
      document = await db.document.create({
        data: {
          userId: freshUser.id,
          title,
          originalText: text,
          analysisResult: {},
          overallScore: 0,
          wordCount,
          status: "processing",
          stage: "queued",
          sourceType,
          pageCount: pageCount ?? null,
        },
      });
    } catch (createErr) {
      console.error("[documents/process] failed to create document:", createErr);
      await refundWordQuota(freshUser.id, wordCount);
      return NextResponse.json(
        { error: { code: "DB_ERROR", message: "Could not start processing. Please try again." } },
        { status: 500, headers: rlHeaders }
      );
    }

    // Launch the durable workflow (async — returns immediately). A start()
    // failure means nothing will ever run failDocumentStep, so refund the
    // reserved quota and mark the document errored here.
    let runId: string | null = null;
    try {
      const run = await start(humanizeDocumentWorkflow, [document.id, options]);
      runId = run.runId;
    } catch (startErr) {
      console.error("[documents/process] failed to start workflow:", startErr);
      await refundWordQuota(freshUser.id, wordCount);
      await db.document.update({
        where: { id: document.id },
        data: { status: "error", stage: "error", errorMessage: "Could not start processing." },
      });
      return NextResponse.json(
        { error: { code: "WORKFLOW_START_FAILED", message: "Could not start processing. Please try again." } },
        { status: 500, headers: rlHeaders }
      );
    }

    // Persist the runId separately and NON-FATALLY: the workflow is already
    // running, so a transient DB error here must not flip a live job to "error".
    try {
      await db.document.update({ where: { id: document.id }, data: { runId } });
    } catch (persistErr) {
      console.error("[documents/process] failed to persist runId (workflow still running):", persistErr);
    }

    trackServer(clerkId, "document_pipeline_started", { source_type: sourceType, word_count: wordCount, plan: plan.id });

    return NextResponse.json(
      { documentId: document.id, runId, sourceType, pageCount: pageCount ?? null, wordCount, truncated },
      { headers: rlHeaders }
    );
  } catch (err) {
    console.error("[documents/process] error:", err);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Something went wrong." } },
      { status: 500 }
    );
  }
}
