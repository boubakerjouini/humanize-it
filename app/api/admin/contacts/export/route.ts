// ===========================================================
// GET /api/admin/contacts/export — the current contacts filter as CSV (no .csv
// in the path, so the middleware's static-file rules don't apply). Same query
// parsing as the list. Cells are formula-guarded by lib/csv.ts.
// ===========================================================

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";
import { logAudit } from "@/lib/audit";
import { toCsv, type CsvColumn } from "@/lib/csv";
import { effectivePlanId } from "@/lib/quota";
import { gradeFor } from "@/lib/crm/scoring";
import { contactType } from "@/lib/crm/contact-360";
import { parseContactQuery } from "../filters";
import { resolveContactQuery } from "../query";

export const runtime = "nodejs";

const MAX_ROWS = 10_000;

const exportSelect = {
  id: true,
  email: true,
  name: true,
  userId: true,
  stage: true,
  score: true,
  source: true,
  channel: true,
  utmSource: true,
  utmMedium: true,
  utmCampaign: true,
  magnets: true,
  subscribedTopics: true,
  lifecycleEmails: true,
  emailStatus: true,
  createdAt: true,
  lastActiveAt: true,
  pipelineStage: true,
  user: { select: { createdAt: true, plan: true, planExpiresAt: true } },
} as const;

type ExportRow = {
  id: string;
  email: string | null;
  name: string | null;
  userId: string | null;
  stage: string;
  score: number;
  source: string;
  channel: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  magnets: string[];
  subscribedTopics: string[];
  lifecycleEmails: boolean;
  emailStatus: string;
  createdAt: Date;
  lastActiveAt: Date | null;
  pipelineStage: string | null;
  user: { createdAt: Date; plan: string; planExpiresAt: Date | null } | null;
};

const COLUMNS: CsvColumn<ExportRow>[] = [
  { header: "id", value: (r) => r.id },
  { header: "email", value: (r) => r.email },
  { header: "name", value: (r) => r.name },
  { header: "type", value: (r) => contactType(r) },
  { header: "stage", value: (r) => r.stage },
  { header: "score", value: (r) => r.score },
  { header: "grade", value: (r) => gradeFor(r.score) },
  { header: "source", value: (r) => r.source },
  { header: "channel", value: (r) => r.channel },
  { header: "utm_source", value: (r) => r.utmSource },
  { header: "utm_medium", value: (r) => r.utmMedium },
  { header: "utm_campaign", value: (r) => r.utmCampaign },
  { header: "magnets", value: (r) => r.magnets },
  { header: "topics", value: (r) => r.subscribedTopics },
  { header: "lifecycle_emails", value: (r) => r.lifecycleEmails },
  { header: "email_status", value: (r) => r.emailStatus },
  { header: "created_at", value: (r) => r.createdAt },
  { header: "signed_up_at", value: (r) => r.user?.createdAt ?? null },
  { header: "last_active_at", value: (r) => r.lastActiveAt },
  { header: "plan", value: (r) => (r.user ? effectivePlanId(r.user) : null) },
  { header: "pipeline_stage", value: (r) => r.pipelineStage },
];

export async function GET(req: Request) {
  try {
    const admin = await requireAdmin();
    const parsed = parseContactQuery(new URL(req.url).searchParams);
    if (!parsed.ok) return NextResponse.json({ error: { code: "INVALID_INPUT", message: parsed.error } }, { status: 400 });
    const resolved = await resolveContactQuery(parsed.query);
    if (!resolved.ok) return NextResponse.json({ error: { code: "NOT_FOUND", message: resolved.error } }, { status: resolved.status });

    const rows = await db.contact.findMany({ where: resolved.where, orderBy: resolved.orderBy, take: MAX_ROWS, select: exportSelect });
    const csv = toCsv<ExportRow>(rows, COLUMNS);
    await logAudit({
      actorEmail: admin.email,
      action: "contacts.export",
      targetType: "contact",
      summary: `Exported ${rows.length} contacts`,
      meta: { count: rows.length, truncated: rows.length === MAX_ROWS },
    });
    const day = new Date().toISOString().slice(0, 10);
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="contacts-${day}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    const status = (err as { status?: number })?.status ?? 500;
    if (status === 500) console.error("[admin/contacts/export]", err instanceof Error ? err.message : err);
    return NextResponse.json(
      { error: { code: status === 500 ? "INTERNAL_ERROR" : "UNAUTHORIZED", message: status === 500 ? "Export failed." : (err as Error).message } },
      { status }
    );
  }
}
