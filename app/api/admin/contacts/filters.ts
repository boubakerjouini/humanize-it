// ===========================================================
// app/api/admin/contacts/filters.ts — Contacts list query string → SegmentFilter
// (pure). The list, the CSV export, the pipeline "view all" links and campaign
// targeting all go through compileSegment, so a filter means the same thing
// everywhere. `filter=` also accepts a whole SegmentFilter as base64url JSON.
// ===========================================================

import { parseSegmentFilter, type SegmentFilter } from "@/lib/crm/segments";

export const CONTACTS_PAGE_SIZE = 25;
export const CONTACT_SORTS = ["created", "score", "lastActive"] as const;
export type ContactSort = (typeof CONTACT_SORTS)[number];

export type ContactQuery = {
  filter: SegmentFilter;
  /** "sys:<key>" or a saved Segment id, resolved by the caller. */
  segmentRef: string | null;
  sort: ContactSort;
  dir: "asc" | "desc";
  page: number;
};

const list = (raw: string | null) =>
  (raw ?? "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);

export function encodeFilterParam(filter: SegmentFilter): string {
  return Buffer.from(JSON.stringify(filter), "utf8").toString("base64url");
}

function decodeFilterParam(raw: string): unknown {
  try {
    return JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

/**
 * Build the list query from URL params. Every UI filter becomes one rule; the
 * result is validated as a whole, so an unknown stage or topic is a 400, not
 * a silently ignored filter.
 */
export function parseContactQuery(params: URLSearchParams): { ok: true; query: ContactQuery } | { ok: false; error: string } {
  const rules: unknown[] = [];
  const q = params.get("q")?.trim();
  if (q) rules.push({ field: "search", op: "contains", value: q.slice(0, 100) });

  const type = params.get("type");
  if (type) rules.push({ field: "type", op: "is", value: type });

  const stages = list(params.get("stage"));
  if (stages.length) rules.push({ field: "stage", op: "in", value: stages });

  const pipeline = params.get("pipelineStage");
  if (pipeline === "none") rules.push({ field: "pipelineStage", op: "is_null" });
  else if (pipeline === "any") rules.push({ field: "pipelineStage", op: "not_null" });
  else if (pipeline) rules.push({ field: "pipelineStage", op: "in", value: list(pipeline) });

  for (const field of ["channel", "source", "magnet"] as const) {
    const values = list(params.get(field));
    if (values.length) rules.push({ field, op: "in", value: values });
  }

  const topic = params.get("topic");
  if (topic) rules.push({ field: "topic", op: "has", value: topic });

  const tag = params.get("tag");
  if (tag) rules.push({ field: "tag", op: "has", value: tag });

  const minScore = params.get("minScore");
  if (minScore) rules.push({ field: "score", op: "gte", value: Number(minScore) });

  const raw = params.get("filter");
  if (raw) {
    const decoded = parseSegmentFilter(decodeFilterParam(raw));
    if (!decoded.ok) return { ok: false, error: decoded.error };
    // A filter has one level of rules, so an "any" list can't be ANDed with the UI filters.
    if (decoded.filter.match === "any" && decoded.filter.rules.length > 1) {
      return { ok: false, error: "Only filters that match all rules can be combined with the list filters." };
    }
    rules.push(...decoded.filter.rules);
  }

  const parsed = parseSegmentFilter({ match: "all", rules });
  if (!parsed.ok) return { ok: false, error: parsed.error };

  const sortRaw = params.get("sort");
  const sort: ContactSort = (CONTACT_SORTS as readonly string[]).includes(sortRaw ?? "") ? (sortRaw as ContactSort) : "created";
  const dir = params.get("dir") === "asc" ? "asc" : "desc";
  const page = Math.max(1, Math.min(10_000, parseInt(params.get("page") ?? "1", 10) || 1));
  const segmentRef = params.get("segment")?.trim() || null;

  return { ok: true, query: { filter: parsed.filter, segmentRef, sort, dir, page } };
}
