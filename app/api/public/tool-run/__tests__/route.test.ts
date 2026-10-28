// POST /api/public/tool-run: the browser's note that an instant check ran.
// Stored as metadata only (never text or IP), bounded per IP, and always 204.

const mockFindUser = jest.fn();
jest.mock("@/lib/db", () => ({ db: { user: { findUnique: (...args: unknown[]) => mockFindUser(...args) } } }));
jest.mock("@clerk/nextjs/server", () => ({ auth: jest.fn(async () => ({ userId: null })) }));
jest.mock("@/lib/rate-limit", () => ({
  checkRateLimit: jest.fn(async () => ({ ok: true })),
  checkDailyLimit: jest.fn(async () => ({ ok: true })),
}));
jest.mock("@/lib/growth/attribution-server", () => ({
  ...jest.requireActual("@/lib/growth/attribution-server"),
  readAttribution: jest.fn(async () => null),
}));
const mockRecordToolRun = jest.fn();
jest.mock("@/lib/growth/tool-runs", () => ({
  ...jest.requireActual("@/lib/growth/tool-runs"),
  recordToolRun: (...args: unknown[]) => mockRecordToolRun(...args),
}));

import { auth } from "@clerk/nextjs/server";
import { POST } from "@/app/api/public/tool-run/route";
import { checkRateLimit } from "@/lib/rate-limit";

const CHECK = { tool: "detector_instant", page: "/bypass/gptzero", wordCount: 240, score: 63.4, band: "possibly-ai" };

function note(body: unknown) {
  return POST(new Request("http://localhost/api/public/tool-run", { method: "POST", body: JSON.stringify(body), headers: { "x-real-ip": "203.0.113.5" } }));
}

beforeEach(() => jest.clearAllMocks());

it("records an anonymous instant check with its page, words and score, and nothing that identifies the visitor", async () => {
  const res = await note(CHECK);
  expect(res.status).toBe(204);
  expect(mockRecordToolRun).toHaveBeenCalledWith({ ...CHECK, userId: null, source: null });
  expect(JSON.stringify(mockRecordToolRun.mock.calls)).not.toContain("203.0.113.5");
});

it("links a signed-in visitor's check to their account without creating one", async () => {
  (auth as unknown as jest.Mock).mockResolvedValueOnce({ userId: "clerk_1" });
  mockFindUser.mockResolvedValueOnce({ id: "user_1" });
  await note(CHECK);
  expect(mockFindUser).toHaveBeenCalledWith({ where: { clerkId: "clerk_1" }, select: { id: true } });
  expect(mockRecordToolRun).toHaveBeenCalledWith(expect.objectContaining({ userId: "user_1" }));
});

it("drops malformed notes, other tools and foreign pages, still answering 204", async () => {
  for (const bad of [
    { ...CHECK, page: "https://evil.example/x" },
    { ...CHECK, tool: "detector_deep" },
    { ...CHECK, wordCount: 0 },
    { ...CHECK, score: 140 },
    { ...CHECK, band: "maybe" },
    "not json at all",
  ]) {
    expect((await note(bad)).status).toBe(204);
  }
  expect(mockRecordToolRun).not.toHaveBeenCalled();
});

it("stops recording once an IP sends too many", async () => {
  (checkRateLimit as jest.Mock).mockResolvedValueOnce({ ok: false });
  expect((await note(CHECK)).status).toBe(204);
  expect(mockRecordToolRun).not.toHaveBeenCalled();
});
