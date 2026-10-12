// withPageTouch: a lead form's in-memory touch fills in only when no
// attribution cookie holds one, and a touch without a signal never becomes
// the last touch.

jest.mock("@/lib/db", () => ({ db: {} }));

import { buildTouch } from "@/lib/growth/attribution";
import { withPageTouch } from "@/lib/growth/attribution-server";

const NOW = Date.UTC(2026, 9, 8, 12, 0, 0);
const touch = (path: string, referrer = "") => buildTouch({ href: `https://humanizeit.app${path}`, referrer, now: NOW });

describe("withPageTouch", () => {
  const cookieFirst = touch("/?utm_source=reddit");
  const pageTagged = touch("/free/false-ai-flag-appeal-kit?utm_source=linkedin&utm_medium=dm");

  it("keeps the cookies' snapshot whenever a cookie holds a touch", () => {
    const fromCookies = { first: cookieFirst, last: null };
    expect(withPageTouch(fromCookies, pageTagged)).toBe(fromCookies);
    const lastOnly = { first: null, last: cookieFirst };
    expect(withPageTouch(lastOnly, pageTagged)).toBe(lastOnly);
  });

  it("uses the page's touch as first and last touch when no cookie exists", () => {
    expect(withPageTouch(null, pageTagged)).toEqual({ first: pageTagged, last: pageTagged });
    expect(withPageTouch({ first: null, last: null }, pageTagged)).toEqual({ first: pageTagged, last: pageTagged });
  });

  it("records a page touch without a signal as a first touch only", () => {
    const direct = touch("/ai-detector");
    expect(withPageTouch(null, direct)).toEqual({ first: direct, last: null });
  });

  it("changes nothing without a page touch", () => {
    expect(withPageTouch(null, null)).toBeNull();
    const empty = { first: null, last: null };
    expect(withPageTouch(empty, null)).toBe(empty);
  });
});
