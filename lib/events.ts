import { db } from "@/lib/db";

export type EventType =
  | "document.analyzed"
  | "document.humanized"
  | "quota.hit"
  | "plan.upgraded"
  | "user.firstAnalysis"
  | "user.firstHumanization"
  | "export.copied"
  | "score.improved";

export async function trackEvent(
  userId: string,
  type: EventType,
  meta?: Record<string, unknown>
) {
  try {
    await db.userEvent.create({
      data: { userId, type, meta: meta ?? undefined },
    });
  } catch (err) {
    console.error("[trackEvent] failed:", err);
  }
}
