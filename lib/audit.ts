// ===========================================================
// lib/audit.ts — append-only admin audit log. Every admin mutation should call
// logAudit() so the CRM has a faithful record of who did what to whom.
// ===========================================================

import { db } from "@/lib/db";
import type { Prisma } from "@/app/generated/prisma/client";

export interface AuditEntry {
  actorEmail: string;
  action: string; // e.g. "user.plan.set", "user.delete", "note.add"
  targetType: string; // "user" | "org" | "code" | ...
  targetId?: string | null;
  summary?: string;
  meta?: Prisma.InputJsonValue;
}

/** Record an admin action. Never throws — auditing must not block the action. */
export async function logAudit(entry: AuditEntry): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        actorEmail: entry.actorEmail,
        action: entry.action,
        targetType: entry.targetType,
        targetId: entry.targetId ?? null,
        summary: entry.summary ?? null,
        meta: entry.meta,
      },
    });
  } catch {
    /* swallow — best-effort ledger */
  }
}
