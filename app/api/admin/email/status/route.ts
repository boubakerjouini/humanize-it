// ===========================================================
// GET /api/admin/email/status — Everything the email status banner shows:
// sending mode, configuration presence (booleans only, never values), the
// sending domain, today's sends against the cap, the last daily-job runs and
// the circuit breaker. Polled while a "Run now" is in progress.
// ===========================================================

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { adminEmails, requireAdmin } from "@/lib/admin";
import { emailDomain } from "@/lib/email/address";
import { BULK_RESERVE, sentToday } from "@/lib/email/budget";
import { breakerState } from "@/lib/email/circuit-breaker";
import { DAILY_JOB } from "@/lib/growth/daily-job";
import { emailConfigStatus, emailDailyCap, emailSendingMode, effectiveAllowlist, isProductionRuntime, referralsEnabled } from "@/lib/growth/flags";
import { handleError } from "../_lib/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** "HumanizeIt <hello@mail.humanizeit.app>" → "mail.humanizeit.app". The domain is public (it's in every From header). */
function fromDomain(raw: string | undefined): string | null {
  if (!raw?.trim()) return null;
  const address = raw.match(/<([^>]+)>/)?.[1] ?? raw;
  return emailDomain(address.trim());
}

export async function GET() {
  try {
    await requireAdmin();
    const now = new Date();
    const [sent, runs, lock, breaker, lastTrip] = await Promise.all([
      sentToday(now),
      db.jobRun.findMany({ where: { job: DAILY_JOB }, orderBy: { startedAt: "desc" }, take: 5 }),
      db.jobLock.findUnique({ where: { key: DAILY_JOB }, select: { lockedUntil: true } }),
      breakerState(now),
      db.auditLog.findFirst({ where: { action: "email.circuit_breaker" }, orderBy: { createdAt: "desc" }, select: { createdAt: true, summary: true } }),
    ]);
    const cap = emailDailyCap();
    return NextResponse.json({
      mode: emailSendingMode(),
      production: isProductionRuntime(),
      allowlistCount: effectiveAllowlist(adminEmails()).size,
      config: emailConfigStatus(),
      domain: fromDomain(process.env.EMAIL_FROM),
      referralsEnabled: referralsEnabled(),
      sentToday: sent,
      cap,
      bulkCap: Math.max(0, cap - BULK_RESERVE),
      running: !!lock && lock.lockedUntil > now,
      runs: runs.map((r) => ({
        id: r.id,
        trigger: r.trigger,
        status: r.status,
        startedAt: r.startedAt,
        finishedAt: r.finishedAt,
        actorEmail: r.actorEmail,
        stats: r.stats,
        error: r.error,
      })),
      breaker: { ...breaker, lastTripAt: lastTrip?.createdAt ?? null, lastTripSummary: lastTrip?.summary ?? null },
    });
  } catch (err) {
    return handleError("admin-email-status", err);
  }
}
