// ===========================================================
// POST /api/admin/contacts/[id]/touch — log an outreach touch (Rule-of-100
// tracker). A first touch moves a fresh card to "contacted", and a reply moves
// it to "replied", so the board follows the log without a second click.
// ===========================================================

import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";
import { logAudit } from "@/lib/audit";
import { OUTREACH_CHANNELS, OUTREACH_OUTCOMES, type PipelineStage } from "@/lib/growth/constants";
import { recordEvent, touchLastActive } from "@/lib/crm/events";
import { getScript } from "@/lib/crm/scripts";
import { setPipelineStage } from "../../actions";

type Ctx = { params: Promise<{ id: string }> };

function fail(err: unknown) {
  const status = (err as { status?: number })?.status ?? 500;
  if (status === 500) console.error("[admin/contacts/touch]", err instanceof Error ? err.message : err);
  return NextResponse.json(
    { error: { code: status === 500 ? "INTERNAL_ERROR" : "UNAUTHORIZED", message: status === 500 ? "Something went wrong." : (err as Error).message } },
    { status }
  );
}
const bad = (message: string, status = 400, code = "INVALID_INPUT") => NextResponse.json({ error: { code, message } }, { status });

const schema = z.object({
  channel: z.enum(OUTREACH_CHANNELS),
  outcome: z.enum(OUTREACH_OUTCOMES),
  script: z.string().max(40).nullable().optional(),
  note: z.string().trim().max(300).nullable().optional(),
});

/** Where a touch moves the card (only ever forward from the early stages). */
function nextStage(current: string | null, outcome: string): PipelineStage | null {
  if (outcome === "replied" || outcome === "interested") {
    return current === null || current === "to_contact" || current === "contacted" ? "replied" : null;
  }
  if (outcome === "not_interested") return current && current !== "won" && current !== "lost" ? "lost" : null;
  if (outcome === "posted") return null; // content, not a conversation
  return current === null || current === "to_contact" ? "contacted" : null;
}

export async function POST(req: Request, { params }: Ctx) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return bad("Invalid JSON.", 400, "INVALID_JSON");
    }
    const parsed = schema.safeParse(body);
    if (!parsed.success) return bad(parsed.error.issues[0]?.message ?? "Invalid input.");
    const input = parsed.data;
    if (input.script && !getScript(input.script)) return bad("Unknown script.");

    const contact = await db.contact.findUnique({ where: { id }, select: { pipelineStage: true, userId: true } });
    if (!contact) return bad("Contact not found.", 404, "NOT_FOUND");

    const event = await recordEvent({
      contactId: id,
      type: "outreach_touch",
      props: { channel: input.channel, outcome: input.outcome, script: input.script ?? null, note: input.note || null },
      actor: admin.email,
    });
    if (!event) return bad("The touch could not be saved.", 500, "DB_ERROR");

    // A prospect's reply is activity; a customer's lastActiveAt stays product usage.
    if (!contact.userId && (input.outcome === "replied" || input.outcome === "interested")) await touchLastActive(id);

    const target = nextStage(contact.pipelineStage, input.outcome);
    const moved = target ? await setPipelineStage(id, target, admin.email) : false;
    await logAudit({
      actorEmail: admin.email,
      action: "contact.touch",
      targetType: "contact",
      targetId: id,
      summary: `Touch via ${input.channel}: ${input.outcome}${moved ? ` (pipeline → ${target})` : ""}`,
    });
    return NextResponse.json({ ok: true, pipelineStage: moved ? target : contact.pipelineStage }, { status: 201 });
  } catch (err) {
    return fail(err);
  }
}
