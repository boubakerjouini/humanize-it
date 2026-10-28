// ===========================================================
// lib/growth/tool-runs.ts — One ToolRun row per use of a free tool: the
// public detector (instant check and deep scan), the free humanizer and the
// blog widget, on whichever page it ran. Metadata only, never the text, the
// IP or an email: the privacy policy promises free-tool text isn't stored.
// The admin "Free tools" view reads them, so every detector page counts
// even when the visitor's browser blocks analytics.
// ===========================================================

import { db } from "@/lib/db";
import type { Touch } from "@/lib/growth/attribution";
import { logGrowthError } from "@/lib/growth/safe";

export const TOOL_RUN_TOOLS = ["detector_instant", "detector_deep", "humanizer_free"] as const;
export type ToolRunTool = (typeof TOOL_RUN_TOOLS)[number];

/** The instant check's score band (analyzeText) or the deep scan's confidence. */
export const TOOL_RUN_BANDS = ["likely-human", "uncertain", "possibly-ai", "likely-ai", "low", "medium", "high"] as const;

/** A lower-case site path with no query: /, /ai-detector, /detectors/turnitin, /blog/<slug>. */
const PAGE_PATH = /^\/(?:[a-z0-9][a-z0-9/-]{0,119})?$/;

/** The page path to store, or null for anything that isn't one of our plain paths. */
export function cleanToolPage(value: unknown): string | null {
  if (typeof value !== "string") return null;
  // The home page is "/"; any other trailing slash goes.
  const path = value.split(/[?#]/)[0].replace(/\/+$/, "").toLowerCase() || (value.startsWith("/") ? "/" : "");
  return PAGE_PATH.test(path) ? path : null;
}

/** The page a request came from, by its Referer, when it is our own site. */
export function refererPage(req: Request): string | null {
  const referer = req.headers.get("referer");
  if (!referer) return null;
  try {
    const url = new URL(referer);
    return url.host === new URL(req.url).host ? cleanToolPage(url.pathname) : null;
  } catch {
    return null;
  }
}

/** How the visitor arrived: utm_source, else the attribution channel. */
export function toolRunSource(touch: Touch | null | undefined): string | null {
  const source = touch?.us ?? touch?.ch ?? null;
  return source ? source.slice(0, 60) : null;
}

export type ToolRunInput = {
  tool: ToolRunTool;
  page: string;
  wordCount: number;
  score?: number | null;
  scoreAfter?: number | null;
  band?: string | null;
  userId?: string | null;
  source?: string | null;
};

const clampScore = (value: number | null | undefined) =>
  typeof value === "number" && Number.isFinite(value) ? Math.min(100, Math.max(0, Math.round(value * 10) / 10)) : null;

/** Write one run. Never throws: tracking must not break a tool. */
export async function recordToolRun(input: ToolRunInput): Promise<void> {
  try {
    await db.toolRun.create({
      data: {
        tool: input.tool,
        page: input.page,
        wordCount: Math.max(0, Math.min(100_000, Math.round(input.wordCount))),
        score: clampScore(input.score),
        scoreAfter: clampScore(input.scoreAfter),
        band: input.band && (TOOL_RUN_BANDS as readonly string[]).includes(input.band) ? input.band : null,
        userId: input.userId ?? null,
        source: input.source ?? null,
      },
    });
  } catch (err) {
    logGrowthError("tool-run", err);
  }
}
