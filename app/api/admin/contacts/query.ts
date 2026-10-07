// ===========================================================
// app/api/admin/contacts/query.ts — Turn a parsed contacts query into the
// Prisma where/orderBy pair, resolving the segment reference. Shared by the
// list and the CSV export so both always return the same people.
// ===========================================================

import type { Prisma } from "@/app/generated/prisma/client";
import { MAX_SEGMENT_RULES, compileSegment, type SegmentFilter } from "@/lib/crm/segments";
import { resolveSegment } from "@/lib/crm/segment-resolve";
import { encodeFilterParam, type ContactQuery } from "./filters";

/** The /admin/campaigns query that targets the same people: `segmentRef=` or `filter=`. */
export type CampaignTarget = { segmentRef: string } | { filter: string };

export type ResolvedContactQuery =
  | {
      ok: true;
      where: Prisma.ContactWhereInput;
      orderBy: Prisma.ContactOrderByWithRelationInput[];
      segmentName: string | null;
      /** null when the list is unfiltered, or when a segment and the list filters can't be expressed as one filter. */
      campaignTarget: CampaignTarget | null;
    }
  | { ok: false; status: number; error: string };

/** One "match all" filter covering both the segment and the list filters, or null when that isn't expressible. */
function campaignTargetFor(query: ContactQuery, segment: { filter: SegmentFilter } | null): CampaignTarget | null {
  const rules = query.filter.rules;
  if (!segment) return rules.length ? { filter: encodeFilterParam(query.filter) } : null;
  if (!rules.length) return { segmentRef: query.segmentRef! };
  const segmentRules = segment.filter.rules;
  if (segment.filter.match === "any" && segmentRules.length > 1) return null;
  const merged = [...segmentRules, ...rules];
  return merged.length <= MAX_SEGMENT_RULES ? { filter: encodeFilterParam({ match: "all", rules: merged }) } : null;
}

export async function resolveContactQuery(query: ContactQuery, now: Date = new Date()): Promise<ResolvedContactQuery> {
  const parts: Prisma.ContactWhereInput[] = [compileSegment(query.filter, now)];
  let segmentName: string | null = null;
  let segmentFilter: { filter: SegmentFilter } | null = null;
  if (query.segmentRef) {
    const segment = await resolveSegment(query.segmentRef, now);
    if (!segment) return { ok: false, status: 404, error: "Segment not found." };
    parts.push(segment.where);
    segmentName = segment.name;
    segmentFilter = { filter: segment.filter };
  }
  const where: Prisma.ContactWhereInput = parts.length === 1 ? parts[0] : { AND: parts };

  const nulls = query.dir === "asc" ? "first" : "last";
  const primary: Prisma.ContactOrderByWithRelationInput =
    query.sort === "score"
      ? { score: query.dir }
      : query.sort === "lastActive"
        ? { lastActiveAt: { sort: query.dir, nulls } }
        : { createdAt: query.dir };
  // A stable tiebreaker keeps pagination from repeating or skipping rows.
  return { ok: true, where, orderBy: [primary, { id: "asc" }], segmentName, campaignTarget: campaignTargetFor(query, segmentFilter) };
}

/** Columns of a contacts list row (also used by the pipeline board). */
export const contactListSelect = {
  id: true,
  email: true,
  name: true,
  company: true,
  handle: true,
  userId: true,
  stage: true,
  stageOverride: true,
  score: true,
  source: true,
  channel: true,
  subscribedTopics: true,
  pendingTopics: true,
  pipelineStage: true,
  lastActiveAt: true,
  createdAt: true,
  emailStatus: true,
  user: { select: { plan: true, planExpiresAt: true } },
} satisfies Prisma.ContactSelect;
