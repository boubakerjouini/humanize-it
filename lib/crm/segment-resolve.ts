// ===========================================================
// lib/crm/segment-resolve.ts — Resolve a segment reference ("sys:<key>" for a
// system segment, otherwise a saved Segment id) to its filter and the compiled
// Prisma where clause. Campaign targeting and the contacts list use this.
// ===========================================================

import { db } from "@/lib/db";
import type { Prisma } from "@/app/generated/prisma/client";
import {
  compileSegment,
  getSystemSegment,
  isSystemSegmentRef,
  parseSegmentFilter,
  type SegmentFilter,
} from "@/lib/crm/segments";

export type ResolvedSegment = {
  ref: string;
  name: string;
  description: string | null;
  system: boolean;
  filter: SegmentFilter;
  where: Prisma.ContactWhereInput;
};

/** Null for an unknown ref, or a saved segment whose stored filter no longer validates. */
export async function resolveSegment(ref: string, now: Date = new Date()): Promise<ResolvedSegment | null> {
  if (isSystemSegmentRef(ref)) {
    const segment = getSystemSegment(ref);
    if (!segment) return null;
    return {
      ref,
      name: segment.name,
      description: segment.description,
      system: true,
      filter: segment.filter,
      where: compileSegment(segment.filter, now),
    };
  }
  const row = await db.segment.findUnique({ where: { id: ref } });
  if (!row) return null;
  const parsed = parseSegmentFilter(row.filter);
  if (!parsed.ok) return null;
  return {
    ref,
    name: row.name,
    description: row.description,
    system: false,
    filter: parsed.filter,
    where: compileSegment(parsed.filter, now),
  };
}
