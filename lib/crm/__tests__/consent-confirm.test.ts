// The double opt-in button confirms the list it names: "Confirm my spot" on
// the waitlist page must not also subscribe someone to pending writing tips.

const mockDb = {
  contact: { findUnique: jest.fn(), updateMany: jest.fn(async () => ({ count: 1 })) },
  consentRecord: { createMany: jest.fn(async () => ({ count: 1 })) },
};

jest.mock("@/lib/db", () => ({ db: mockDb }));
jest.mock("@/lib/growth/triggers", () => ({ onUnsubscribed: jest.fn() }));

import { confirmPendingTopics } from "@/lib/crm/consent";

beforeEach(() => {
  jest.clearAllMocks();
  mockDb.contact.findUnique.mockResolvedValue({ subscribedTopics: [], pendingTopics: ["tips", "extension_launch"] });
});

function topicWrite() {
  return (mockDb.contact.updateMany.mock.calls as unknown as [{ data: { subscribedTopics?: string[]; pendingTopics?: string[] } }][])
    .map(([arg]) => arg.data)
    .find((d) => d.subscribedTopics !== undefined)!;
}

it("confirms only the named topic and leaves the other pending", async () => {
  const { confirmed } = await confirmPendingTopics("c_1", { only: ["extension_launch"] });
  expect(confirmed).toEqual(["extension_launch"]);
  expect(topicWrite()).toMatchObject({ subscribedTopics: ["extension_launch"], pendingTopics: ["tips"] });
  expect(mockDb.consentRecord.createMany).toHaveBeenCalledWith({
    data: [expect.objectContaining({ topic: "extension_launch", action: "confirm", method: "doi" })],
  });
});

it("confirms every pending topic when the page listed them all", async () => {
  const { confirmed } = await confirmPendingTopics("c_1");
  expect(confirmed.sort()).toEqual(["extension_launch", "tips"]);
  expect(topicWrite()).toMatchObject({ pendingTopics: [] });
});

it("changes nothing when the named topic isn't pending", async () => {
  mockDb.contact.findUnique.mockResolvedValue({ subscribedTopics: [], pendingTopics: ["tips"] });
  const { confirmed } = await confirmPendingTopics("c_1", { only: ["extension_launch"] });
  expect(confirmed).toEqual([]);
  expect(topicWrite()).toBeUndefined();
});
