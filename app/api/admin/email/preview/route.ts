// ===========================================================
// POST /api/admin/email/preview — Render one sequence step with sample data.
// Body: { sequenceKey, stepKey }. Returns { subject, html, text } for the
// admin's sandboxed iframe (srcDoc, sandbox=""). Footer links are signed for
// the admin's own contact, so clicking them only ever affects the admin.
// ===========================================================

import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";
import { normalizeEmail } from "@/lib/email/address";
import type { TemplateKey, TemplateProps } from "@/lib/email/catalog";
import { TemplateNotImplementedError, buildRenderCtx, firstNameFrom, renderEmail } from "@/lib/email/render";
import { findStep, sampleContext } from "@/lib/email/sequences";
import { isSequenceKey } from "@/lib/email/catalog";
import { fail, handleError, readJson } from "../_lib/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({ sequenceKey: z.string().max(64), stepKey: z.string().max(64) });

export async function POST(req: Request) {
  try {
    const admin = await requireAdmin();
    const json = await readJson(req);
    if (!json.ok) return json.response;
    const { sequenceKey, stepKey } = bodySchema.parse(json.body);
    if (!isSequenceKey(sequenceKey)) return fail("NOT_FOUND", "Unknown sequence.", 404);
    const step = findStep(sequenceKey, stepKey);
    if (!step) return fail("NOT_FOUND", "Unknown step.", 404);

    const ownEmail = normalizeEmail(admin.email);
    const own = ownEmail ? await db.contact.findUnique({ where: { email: ownEmail }, select: { id: true, name: true } }) : null;
    const firstName = firstNameFrom(own?.name ?? admin.name);
    const props = (step.props ? step.props(sampleContext(sequenceKey)) : {}) as TemplateProps[TemplateKey];
    const ctx = buildRenderCtx({ contactId: own?.id ?? null, template: step.template, firstName });
    try {
      const rendered = await renderEmail(step.template, props, ctx);
      return NextResponse.json({ ...rendered, template: step.template });
    } catch (err) {
      if (err instanceof TemplateNotImplementedError) {
        return fail("TEMPLATE_MISSING", `The "${step.template}" template isn't built yet.`, 404);
      }
      throw err;
    }
  } catch (err) {
    return handleError("admin-email-preview", err);
  }
}
