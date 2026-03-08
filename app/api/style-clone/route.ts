// ===========================================================
// POST /api/style-clone — Analyze writing samples to extract style fingerprint
// ===========================================================

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { anthropic } from "@/lib/anthropic";
import { db } from "@/lib/db";

export async function POST(req: Request) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Authentication required." } },
        { status: 401 }
      );
    }

    // Check plan — only PRO/TEAM
    const user = await db.user.findUnique({ where: { clerkId } });
    if (!user || user.plan === "FREE") {
      return NextResponse.json(
        { error: { code: "PLAN_REQUIRED", message: "Style Clone requires a Pro or Team plan." } },
        { status: 403 }
      );
    }

    let body: { samples?: unknown };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: { code: "INVALID_JSON", message: "Invalid JSON body." } },
        { status: 400 }
      );
    }

    const samples = body.samples;
    if (!Array.isArray(samples) || samples.length < 2 || samples.length > 3) {
      return NextResponse.json(
        { error: { code: "INVALID_INPUT", message: "Provide 2-3 writing samples." } },
        { status: 400 }
      );
    }

    for (const s of samples) {
      if (typeof s !== "string" || s.trim().length < 50) {
        return NextResponse.json(
          { error: { code: "INVALID_INPUT", message: "Each sample must be at least 50 characters." } },
          { status: 400 }
        );
      }
    }

    const samplesText = (samples as string[])
      .map((s, i) => `--- Sample ${i + 1} ---\n${s.trim()}`)
      .join("\n\n");

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 1024,
      temperature: 0,
      system: `You are a writing style analyst. Analyze the provided writing samples and extract a concise style fingerprint as JSON. Return ONLY valid JSON, no markdown or explanation.`,
      messages: [{
        role: "user",
        content: `Analyze these writing samples and return a JSON style fingerprint with these exact keys:

{
  "sentencePatterns": "description of typical sentence structures, lengths, rhythm",
  "vocabularyLevel": "simple/intermediate/advanced + notable word choices",
  "punctuationHabits": "comma usage, semicolons, dashes, exclamation marks, etc.",
  "paragraphStructure": "typical paragraph length, how ideas flow between paragraphs",
  "toneVoice": "formal/casual/conversational/academic + personality traits",
  "quirks": "any unique habits, repeated phrases, distinctive patterns"
}

Writing samples:
${samplesText}`,
      }],
    });

    const rawText = response.content[0].type === "text" ? response.content[0].text.trim() : "";

    // Parse JSON — strip markdown code fences if present
    const jsonStr = rawText.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
    let fingerprint: Record<string, string>;
    try {
      fingerprint = JSON.parse(jsonStr);
    } catch {
      return NextResponse.json(
        { error: { code: "PARSE_ERROR", message: "Failed to parse style fingerprint." } },
        { status: 500 }
      );
    }

    return NextResponse.json({ fingerprint });
  } catch (err) {
    console.error("[style-clone] error:", err);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Something went wrong." } },
      { status: 500 }
    );
  }
}
