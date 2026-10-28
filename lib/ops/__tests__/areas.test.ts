// opsArea: every route path lands in one of a fixed set of areas.

import { opsArea } from "@/lib/ops/areas";

it("buckets route paths into a fixed set of areas", () => {
  expect(opsArea("/api/detect")).toBe("api/detect");
  expect(opsArea("/api/webhooks/polar")).toBe("api/webhooks");
  expect(opsArea("/api/public/humanize")).toBe("api/public");
  expect(opsArea("/api/humanize")).toBe("api/humanize");
  expect(opsArea("/api/humanize/stream")).toBe("api/humanize");
  expect(opsArea("/api/humanizer-x")).toBe("other");
  expect(opsArea("/api/admin/tasks")).toBe("other");
  expect(opsArea("/blog/[slug]")).toBe("app");
  expect(opsArea("/")).toBe("app");
  expect(opsArea("")).toBe("other");
  expect(opsArea(undefined)).toBe("other");
});
