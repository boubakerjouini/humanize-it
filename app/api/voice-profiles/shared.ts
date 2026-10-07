// ===========================================================
// app/api/voice-profiles/shared.ts — Voice Match helpers shared by the
// voice-profile routes and /api/humanize.
//
// A profile is the style fingerprint /api/style-clone has always produced,
// now stored per user. Limits come from lib/plans.ts (Free 0, Pro 1, Pro
// annual and Founding 3, Team 10). After a downgrade the extra profiles are
// kept but locked: only the oldest `limit` ones stay usable, so nothing the
// user wrote is deleted behind their back.
// ===========================================================

import { db } from "@/lib/db";
import { complete } from "@/lib/llm";
import { PLANS, voiceProfileLimit, type PlanId } from "@/lib/plans";

export const MIN_SAMPLES = 2;
export const MAX_SAMPLES = 3;
export const MIN_SAMPLE_CHARS = 50;
export const MAX_SAMPLE_CHARS = 6_000;
export const MAX_NAME_CHARS = 60;

/** The fingerprint keys the humanizer prompt expects (same as /api/style-clone). */
const FINGERPRINT_KEYS = [
  "sentencePatterns",
  "vocabularyLevel",
  "punctuationHabits",
  "paragraphStructure",
  "toneVoice",
  "quirks",
] as const;

export type Fingerprint = Record<(typeof FINGERPRINT_KEYS)[number], string>;

export type VoiceAllowance = { limit: number; annual: boolean; founding: boolean };

/** Founding members hold a founding Purchase; any read error counts as "not founding". */
export async function isFoundingMember(userId: string): Promise<boolean> {
  try {
    return (await db.purchase.count({ where: { userId, kind: "founding" } })) > 0;
  } catch {
    return false;
  }
}

/** How many profiles `userId` may use on `planId` right now. */
export async function voiceAllowance(userId: string, planId: PlanId): Promise<VoiceAllowance> {
  if (planId !== "PRO") return { limit: voiceProfileLimit(planId), annual: false, founding: false };
  const annualVariant = PLANS.PRO.lsVariantIdAnnual;
  const [sub, founding] = await Promise.all([
    db.subscription.findUnique({ where: { userId }, select: { lsVariantId: true, status: true } }),
    isFoundingMember(userId),
  ]);
  const annual = !!annualVariant && sub?.lsVariantId === annualVariant && sub.status !== "expired";
  return { limit: voiceProfileLimit(planId, { annual, founding }), annual, founding };
}

/** Ids of the profiles that are usable under `limit` (oldest first). */
export async function usableProfileIds(userId: string, limit: number): Promise<Set<string>> {
  if (limit <= 0) return new Set();
  const rows = await db.voiceProfile.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
    take: limit,
    select: { id: true },
  });
  return new Set(rows.map((r) => r.id));
}

/** Coerce a stored Json value into the fingerprint shape, or null when it isn't one. */
export function toFingerprint(value: unknown): Fingerprint | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  const out = {} as Fingerprint;
  for (const key of FINGERPRINT_KEYS) {
    const field = v[key];
    out[key] = typeof field === "string" ? field.slice(0, 600) : "";
  }
  return FINGERPRINT_KEYS.some((k) => out[k]) ? out : null;
}

export function countWords(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

/**
 * Ask the model for a style fingerprint of the samples. Same prompt as
 * /api/style-clone, through lib/llm so it follows the configured provider.
 * Throws when the model fails or returns something that isn't a fingerprint.
 */
export async function extractFingerprint(samples: string[]): Promise<Fingerprint> {
  const samplesText = samples.map((s, i) => `--- Sample ${i + 1} ---\n${s.trim()}`).join("\n\n");
  const { text } = await complete({
    system:
      "You are a writing style analyst. Analyze the provided writing samples and extract a concise style fingerprint as JSON. Return ONLY valid JSON, no markdown or explanation.",
    prompt: `Analyze these writing samples and return a JSON style fingerprint with these exact keys:

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
    maxTokens: 1024,
    temperature: 0,
  });
  const json = text.trim().replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
  const fingerprint = toFingerprint(JSON.parse(json));
  if (!fingerprint) throw new Error("The model returned no usable fingerprint.");
  return fingerprint;
}
