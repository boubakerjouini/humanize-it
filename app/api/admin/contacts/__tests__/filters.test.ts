import { encodeFilterParam, parseContactQuery } from "../filters";

const parse = (qs: string) => parseContactQuery(new URLSearchParams(qs));

describe("parseContactQuery", () => {
  it("defaults to every contact, newest first, page 1", () => {
    const r = parse("");
    expect(r).toEqual({ ok: true, query: { filter: { match: "all", rules: [] }, segmentRef: null, sort: "created", dir: "desc", page: 1 } });
  });

  it("turns each UI filter into one rule", () => {
    const r = parse("q=ada&type=lead&stage=lead,engaged_lead&channel=social&source=magnet_page&topic=tips&tag=t1&minScore=40&magnet=false-ai-flag-appeal-kit");
    if (!r.ok) throw new Error(r.error);
    expect(r.query.filter.rules).toEqual([
      { field: "search", op: "contains", value: "ada" },
      { field: "type", op: "is", value: "lead" },
      { field: "stage", op: "in", value: ["lead", "engaged_lead"] },
      { field: "channel", op: "in", value: ["social"] },
      { field: "source", op: "in", value: ["magnet_page"] },
      { field: "magnet", op: "in", value: ["false-ai-flag-appeal-kit"] },
      { field: "topic", op: "has", value: "tips" },
      { field: "tag", op: "has", value: "t1" },
      { field: "score", op: "gte", value: 40 },
    ]);
  });

  it("handles the pipeline none/any shortcuts and stage lists", () => {
    const none = parse("pipelineStage=none");
    const any = parse("pipelineStage=any");
    const some = parse("pipelineStage=contacted,replied");
    expect(none.ok && none.query.filter.rules).toEqual([{ field: "pipelineStage", op: "is_null" }]);
    expect(any.ok && any.query.filter.rules).toEqual([{ field: "pipelineStage", op: "not_null" }]);
    expect(some.ok && some.query.filter.rules).toEqual([{ field: "pipelineStage", op: "in", value: ["contacted", "replied"] }]);
  });

  it("rejects unknown values instead of ignoring them", () => {
    expect(parse("stage=vip").ok).toBe(false);
    expect(parse("topic=spam").ok).toBe(false);
    expect(parse("minScore=abc").ok).toBe(false);
    expect(parse("type=robot").ok).toBe(false);
  });

  it("merges a base64url SegmentFilter with the UI filters", () => {
    const filter = encodeFilterParam({ match: "all", rules: [{ field: "billing", op: "is", value: "comped" }] });
    const r = parse(`type=user&filter=${filter}`);
    expect(r.ok && r.query.filter.rules).toEqual([
      { field: "type", op: "is", value: "user" },
      { field: "billing", op: "is", value: "comped" },
    ]);
    expect(parse("filter=not-base64-json").ok).toBe(false);
    const anyOf = encodeFilterParam({
      match: "any",
      rules: [
        { field: "topic", op: "has", value: "tips" },
        { field: "score", op: "gte", value: 60 },
      ],
    });
    expect(parse(`filter=${anyOf}`).ok).toBe(false);
  });

  it("reads sort, direction, page and segment", () => {
    const r = parse("sort=score&dir=asc&page=3&segment=sys:hot_leads");
    expect(r.ok && r.query).toMatchObject({ sort: "score", dir: "asc", page: 3, segmentRef: "sys:hot_leads" });
    const bad = parse("sort=email&dir=sideways&page=-4");
    expect(bad.ok && bad.query).toMatchObject({ sort: "created", dir: "desc", page: 1 });
  });
});
