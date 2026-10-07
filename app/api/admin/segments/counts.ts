// ===========================================================
// app/api/admin/segments/counts.ts — Segment list with live counts, shared by
// GET /api/admin/segments and the /admin/segments page. Counts use the same
// compileSegment path as the contacts list, so "view contacts" shows exactly
// the number on the card.
// ===========================================================

import { db } from "@/lib/db";
import { SYSTEM_SEGMENTS, compileSegment, parseSegmentFilter, type SegmentFilter } from "@/lib/crm/segments";

export type SegmentListItem = {
  id: string;
  name: string;
  description: string;
  system: boolean;
  /** null when the count query failed (e.g. a table missing in a preview). */
  count: number | null;
  filter: SegmentFilter;
};

export async function listSegmentsWithCounts(now: Date = new Date()): Promise<SegmentListItem[]> {
  const saved = await db.segment.findMany({ orderBy: { name: "asc" } }).catch(() => []);
  const defs = [
    ...Object.values(SYSTEM_SEGMENTS).map((s) => ({ id: s.id, name: s.name, description: s.description, system: true, filter: s.filter })),
    ...saved.flatMap((row) => {
      const parsed = parseSegmentFilter(row.filter);
      return parsed.ok ? [{ id: row.id, name: row.name, description: row.description ?? "", system: false, filter: parsed.filter }] : [];
    }),
  ];
  const counts = await Promise.all(defs.map((d) => db.contact.count({ where: compileSegment(d.filter, now) }).catch(() => null)));
  return defs.map((d, i) => ({ ...d, count: counts[i] }));
}
