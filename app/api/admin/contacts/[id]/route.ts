// ===========================================================
// GET    /api/admin/contacts/[id] — contact 360 payload (lib/crm/contact-360.ts)
// PATCH  /api/admin/contacts/[id] — { action }: setStageOverride | setPipelineStage |
//        update | recompute | withdrawTopics | setLifecycleOff | suppress |
//        unsuppress | grantBonusWords. Admins can withdraw consent, never grant it.
// DELETE /api/admin/contacts/[id] — erase a lead or prospect (409 when it has an account)
// ===========================================================

import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";
import { logAudit } from "@/lib/audit";
import { emailHash, isValidEmail, normalizeEmail } from "@/lib/email/address";
import { PIPELINE_STAGES, TOPICS } from "@/lib/growth/constants";
import { referralsEnabled } from "@/lib/growth/flags";
import { isUniqueViolation } from "@/lib/growth/safe";
import { STAGES } from "@/lib/crm/lifecycle";
import { buildContact360 } from "@/lib/crm/contact-360";
import { recordEvent } from "@/lib/crm/events";
import { recomputeContact } from "@/lib/crm/recompute";
import { setLifecycleEmails, withdrawTopics } from "@/lib/crm/consent";
import { grantBonusWords } from "@/lib/crm/bonus";
import { eraseContact } from "@/lib/crm/contacts";
import { setPipelineStage } from "../actions";

type Ctx = { params: Promise<{ id: string }> };

function fail(err: unknown) {
  const status = (err as { status?: number })?.status ?? 500;
  if (status === 500) console.error("[admin/contacts/:id]", err instanceof Error ? err.message : err);
  return NextResponse.json(
    { error: { code: status === 500 ? "INTERNAL_ERROR" : "UNAUTHORIZED", message: status === 500 ? "Something went wrong." : (err as Error).message } },
    { status }
  );
}
const bad = (message: string, status = 400, code = "INVALID_INPUT") => NextResponse.json({ error: { code, message } }, { status });

export async function GET(_req: Request, { params }: Ctx) {
  try {
    await requireAdmin();
    const { id } = await params;
    const data = await buildContact360(id);
    if (!data) return bad("Contact not found.", 404, "NOT_FOUND");
    return NextResponse.json(data);
  } catch (err) {
    return fail(err);
  }
}

const text = (max: number) => z.string().trim().max(max).nullable().optional();

const patchSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("setStageOverride"), stage: z.enum(STAGES).nullable() }),
  z.object({ action: z.literal("setPipelineStage"), stage: z.enum(PIPELINE_STAGES).nullable() }),
  z.object({
    action: z.literal("update"),
    name: text(120),
    email: text(254),
    company: text(120),
    handle: text(120),
    phone: text(40),
  }),
  z.object({ action: z.literal("recompute") }),
  z.object({ action: z.literal("withdrawTopics"), topics: z.union([z.literal("all"), z.array(z.enum(TOPICS)).min(1)]) }),
  z.object({ action: z.literal("setLifecycleOff") }),
  z.object({ action: z.literal("suppress"), scope: z.enum(["marketing", "all"]), note: text(200) }),
  z.object({ action: z.literal("unsuppress"), suppressionId: z.string().min(1).max(64) }),
  z.object({
    action: z.literal("grantBonusWords"),
    words: z.number().int().min(100).max(50_000),
    reason: z.string().trim().min(3).max(100),
    expiresInDays: z.number().int().min(1).max(730).nullable().optional(),
    /** Generated once per dialog, so a double submit can't pay twice. */
    requestId: z.string().regex(/^[A-Za-z0-9-]{8,64}$/),
  }),
]);

export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return bad("Invalid JSON.", 400, "INVALID_JSON");
    }
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) return bad(parsed.error.issues[0]?.message ?? "Invalid input.");
    const input = parsed.data;

    const contact = await db.contact.findUnique({
      where: { id },
      select: { id: true, email: true, userId: true, stage: true, stageOverride: true },
    });
    if (!contact) return bad("Contact not found.", 404, "NOT_FOUND");
    const audit = (action: string, summary: string, meta?: Record<string, string | number | boolean | null>) =>
      logAudit({ actorEmail: admin.email, action, targetType: "contact", targetId: id, summary, meta });
    const consentMeta = { method: "admin" as const, actor: admin.email, source: "admin" };

    switch (input.action) {
      case "setStageOverride": {
        if (contact.stageOverride === input.stage) break;
        await db.contact.update({ where: { id }, data: { stageOverride: input.stage } });
        await recordEvent({ contactId: id, type: "stage_overridden", props: { from: contact.stageOverride, to: input.stage }, actor: admin.email });
        await recomputeContact(id);
        await audit("contact.stage.override", input.stage ? `Stage pinned to ${input.stage}` : "Stage override cleared");
        break;
      }
      case "setPipelineStage": {
        const moved = await setPipelineStage(id, input.stage, admin.email);
        if (moved) await audit("contact.pipeline.set", `Pipeline → ${input.stage ?? "none"}`);
        break;
      }
      case "update": {
        const data: { name?: string | null; email?: string | null; company?: string | null; handle?: string | null; phone?: string | null } = {};
        const clean = (v: string | null | undefined) => (v === undefined ? undefined : v && v.trim() ? v.trim() : null);
        for (const key of ["name", "company", "handle", "phone"] as const) {
          const v = clean(input[key]);
          if (v !== undefined) data[key] = v;
        }
        if (input.email !== undefined) {
          // An account's address comes from Clerk; editing it here would drift from sign-in.
          if (contact.userId) return bad("A customer's email comes from their account and can't be edited here.");
          const raw = clean(input.email);
          if (raw && !isValidEmail(raw)) return bad("That email address doesn't look valid.");
          data.email = raw ? normalizeEmail(raw) : null;
        }
        if (Object.keys(data).length === 0) return bad("Nothing to update.");
        try {
          await db.contact.update({ where: { id }, data });
        } catch (err) {
          if (isUniqueViolation(err)) return bad("Another contact already uses that email.", 409, "ALREADY_EXISTS");
          throw err;
        }
        if (data.email !== undefined) await recomputeContact(id);
        await audit("contact.update", `Updated ${Object.keys(data).join(", ")}`);
        break;
      }
      case "recompute": {
        const result = await recomputeContact(id);
        await audit("contact.recompute", `Recomputed: ${result?.stage ?? "?"}, score ${result?.score ?? "?"}`);
        break;
      }
      case "withdrawTopics": {
        const { withdrawn } = await withdrawTopics(id, input.topics, consentMeta);
        await recomputeContact(id).catch(() => null);
        await audit("contact.consent.withdraw", withdrawn.length ? `Withdrew ${withdrawn.join(", ")}` : "No topics to withdraw");
        break;
      }
      case "setLifecycleOff": {
        const { changed } = await setLifecycleEmails(id, false, consentMeta);
        await audit("contact.lifecycle.off", changed ? "Lifecycle email turned off" : "Lifecycle email was already off");
        break;
      }
      case "suppress": {
        if (!contact.email) return bad("This contact has no email address to suppress.");
        await db.emailSuppression.upsert({
          where: { emailHash_scope: { emailHash: emailHash(contact.email), scope: input.scope } },
          update: {},
          create: { emailHash: emailHash(contact.email), scope: input.scope, reason: "manual", source: "admin", note: input.note ?? null },
        });
        await audit("contact.suppress", `Suppressed (${input.scope})`);
        break;
      }
      case "unsuppress": {
        if (!contact.email) return bad("This contact has no email address.");
        const row = await db.emailSuppression.findUnique({ where: { id: input.suppressionId } });
        if (!row || row.emailHash !== emailHash(contact.email)) return bad("Suppression not found.", 404, "NOT_FOUND");
        // Bounces, complaints, unsubscribes and erasures are the recipient's (or the provider's) decision.
        if (row.reason !== "manual") return bad(`A ${row.reason} suppression can't be lifted by an admin.`, 409, "CONFLICT");
        await db.emailSuppression.delete({ where: { id: row.id } });
        await audit("contact.unsuppress", `Lifted manual suppression (${row.scope})`);
        break;
      }
      case "grantBonusWords": {
        if (!referralsEnabled()) return bad("Bonus words are off (REFERRALS_ENABLED is not set).", 409, "CONFLICT");
        const expiresAt = input.expiresInDays ? new Date(Date.now() + input.expiresInDays * 86_400_000) : null;
        const dedupeKey = `bonus:admin:${id}:${input.requestId}`;
        const granted = await grantBonusWords(id, input.words, input.reason, dedupeKey, { expiresAt, actor: admin.email, props: { via: "admin" } });
        if (!granted) return bad("Nothing granted: this grant was already applied, or the balance changed. Reload and check.", 409, "CONFLICT");
        await audit("contact.bonus.grant", `Granted ${input.words} bonus words: ${input.reason}`, { words: input.words });
        break;
      }
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return fail(err);
  }
}

export async function DELETE(req: Request, { params }: Ctx) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;
    const erasure = new URL(req.url).searchParams.get("erasure") === "1";
    const result = await eraseContact(id, { erasureRequest: erasure });
    if (!result.ok) {
      return result.reason === "not_found"
        ? bad("Contact not found.", 404, "NOT_FOUND")
        : bad("This contact has an account. Delete the customer instead.", 409, "LINKED_TO_USER");
    }
    await logAudit({
      actorEmail: admin.email,
      action: "contact.delete",
      targetType: "contact",
      targetId: id,
      summary: erasure ? "Erased contact (erasure request)" : "Deleted contact",
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return fail(err);
  }
}
