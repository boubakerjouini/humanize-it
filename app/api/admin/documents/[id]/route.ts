// ===========================================================
// GET /api/admin/documents/[id] — full document detail (admin only)
// Everything that happened to one document: original + humanized text,
// before/after detection, the pattern breakdown, the pipeline state,
// the model/tone used, dates, and the author's lifetime activity.
// ===========================================================

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";
import { resolveIdentities } from "@/lib/clerk-identity";

type Ctx = { params: Promise<{ id: string }> };

function adminError(err: unknown) {
  const status = (err as { status?: number })?.status ?? 500;
  return NextResponse.json(
    { error: { message: status === 500 ? "Something went wrong." : (err as Error).message } },
    { status }
  );
}

export async function GET(_req: Request, { params }: Ctx) {
  try {
    await requireAdmin();
    const { id } = await params;

    const doc = await db.document.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            clerkId: true,
            email: true,
            name: true,
            plan: true,
            wordsUsed: true,
            rewriteCount: true,
            createdAt: true,
            subscription: { select: { status: true } },
            _count: { select: { documents: true } },
          },
        },
      },
    });
    if (!doc) return NextResponse.json({ error: { message: "Document not found." } }, { status: 404 });

    // The DB email/name may be a placeholder — show the real Clerk identity.
    const ident = (await resolveIdentities([doc.user.clerkId])).get(doc.user.clerkId);

    // organizationId is a plain column (no relation), so resolve the org separately.
    const organization = doc.organizationId
      ? await db.organization
          .findUnique({ where: { id: doc.organizationId }, select: { id: true, name: true, slug: true } })
          .catch(() => null)
      : null;

    return NextResponse.json({
      document: {
        id: doc.id,
        title: doc.title,
        originalText: doc.originalText,
        rewrittenText: doc.rewrittenText,
        analysisResult: doc.analysisResult,
        overallScore: doc.overallScore,
        humanizedScore: doc.humanizedScore,
        wordCount: doc.wordCount,
        tone: doc.tone,
        rewriteModel: doc.rewriteModel,
        status: doc.status,
        stage: doc.stage,
        runId: doc.runId,
        sourceType: doc.sourceType,
        pageCount: doc.pageCount,
        errorMessage: doc.errorMessage,
        createdAt: doc.createdAt,
      },
      author: {
        id: doc.user.id,
        email: ident?.email ?? doc.user.email,
        name: ident?.name ?? doc.user.name,
        plan: doc.user.plan,
        paid: doc.user.subscription?.status === "active",
        wordsUsed: doc.user.wordsUsed,
        rewriteCount: doc.user.rewriteCount,
        documentCount: doc.user._count.documents,
        joinedAt: doc.user.createdAt,
      },
      organization,
    });
  } catch (err) {
    return adminError(err);
  }
}
