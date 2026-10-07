// ===========================================================
// app/free/_lib/confirm-state.ts — Read-only check of a confirm token for
// the thanks and confirmed pages: is it valid, and is anything still pending?
// Never writes: the page only shows a button, and the button confirms.
// ===========================================================

import { db } from "@/lib/db";
import { verifyToken } from "@/lib/email/tokens";
import { isTopic, type MagnetSlug, type Topic } from "@/lib/growth/constants";
import { logGrowthError } from "@/lib/growth/safe";

export type ConfirmState = {
  /** The token to hand to the client button, or null when invalid or expired. */
  token: string | null;
  magnet: MagnetSlug | null;
  pending: Topic[];
  subscribed: Topic[];
};

export async function readConfirmState(raw: string | string[] | undefined): Promise<ConfirmState> {
  const t = typeof raw === "string" ? raw : null;
  const payload = verifyToken(t, "confirm");
  if (!t || !payload) return { token: null, magnet: null, pending: [], subscribed: [] };
  try {
    const contact = await db.contact.findUnique({
      where: { id: payload.c },
      select: { pendingTopics: true, subscribedTopics: true },
    });
    if (!contact) return { token: null, magnet: payload.m ?? null, pending: [], subscribed: [] };
    return {
      token: t,
      magnet: payload.m ?? null,
      pending: contact.pendingTopics.filter(isTopic),
      subscribed: contact.subscribedTopics.filter(isTopic),
    };
  } catch (err) {
    logGrowthError("confirm-state", err);
    // Let the button try: the endpoint reports a clear error if it fails too.
    return { token: t, magnet: payload.m ?? null, pending: [], subscribed: [] };
  }
}
