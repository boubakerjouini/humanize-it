// syncContactForUser, case (1): the account's address changed to one already
// captured as a lead. The lead is merged into the account's contact, and that
// must count as a conversion (event + trigger, which exits lead_nurture)
// exactly like linking a lead at signup.

jest.mock("@/lib/db", () => {
  const state = {
    contacts: new Map<string, Record<string, unknown>>(),
    calls: [] as { op: string; args: unknown }[],
  };
  const find = (where: Record<string, unknown>) =>
    [...state.contacts.values()].find((c) => Object.entries(where).every(([k, v]) => c[k] === v)) ?? null;
  const model = (name: string) =>
    new Proxy(
      {},
      {
        get:
          (_target, method) =>
          async (args: { where?: Record<string, unknown> } = {}) => {
            const op = `${name}.${String(method)}`;
            state.calls.push({ op, args });
            if (op === "contact.findUnique") return find(args.where ?? {});
            if (method === "findMany") return [];
            if (method === "findUnique" || method === "findFirst") return null;
            return { count: 0 };
          },
      }
    );
  // $transaction runs the callback against the same fake client.
  const db: Record<string, unknown> = new Proxy(
    {},
    { get: (_target, name) => (name === "$transaction" ? (fn: (tx: unknown) => unknown) => fn(db) : model(String(name))) }
  );
  return { db, state };
});
jest.mock("@/lib/user", () => ({ isPlaceholderEmail: () => false }));
jest.mock("@/lib/growth/triggers", () => ({ onContactConverted: jest.fn(async () => {}) }));
jest.mock("@/lib/growth/attribution-server", () => ({ applyFirstTouch: jest.fn(async () => {}), firstTouchOf: () => null }));
jest.mock("@/lib/crm/tags", () => ({ moveContactTagsToUser: jest.fn(async () => {}) }));

import * as dbModule from "@/lib/db";
import { onContactConverted } from "@/lib/growth/triggers";
import { syncContactForUser } from "@/lib/crm/contacts";

const state = (dbModule as unknown as {
  state: { contacts: Map<string, Record<string, unknown>>; calls: { op: string; args: unknown }[] };
}).state;

function contactRow(over: Record<string, unknown>): Record<string, unknown> {
  return {
    userId: null,
    email: null,
    name: null,
    createdAt: new Date("2026-09-01T00:00:00Z"),
    firstTouchAt: null,
    subscribedTopics: [],
    pendingTopics: [],
    magnets: [],
    bonusWords: 0,
    bonusWordsExpireAt: null,
    lifecycleEmails: true,
    emailStatus: "ok",
    emailVerifiedAt: null,
    ...over,
  };
}

const user = { id: "user_1", email: "new@example.com", name: "Sam", createdAt: new Date("2026-09-01T00:00:00Z") };

beforeEach(() => {
  state.contacts.clear();
  state.calls.length = 0;
  jest.clearAllMocks();
  state.contacts.set(
    "c_account",
    contactRow({ id: "c_account", userId: "user_1", email: "old@example.com", name: "Sam", emailVerifiedAt: new Date("2026-09-01T00:00:00Z") })
  );
});

describe("an account moving to an address captured as a lead", () => {
  it("merges the lead in and records the conversion", async () => {
    state.contacts.set("c_lead", contactRow({ id: "c_lead", email: "new@example.com" }));

    await expect(syncContactForUser(user)).resolves.toEqual({ contactId: "c_account", created: false, linked: false, merged: true });
    expect(state.calls).toContainEqual({
      op: "contactEvent.create",
      args: { data: { contactId: "c_account", type: "converted", dedupeKey: "converted:user_1", props: { userId: "user_1" } } },
    });
    expect(onContactConverted).toHaveBeenCalledWith("c_account");
  });

  it("(control) a plain address change with no lead behind it is not a conversion", async () => {
    await expect(syncContactForUser(user)).resolves.toEqual({ contactId: "c_account", created: false, linked: false, merged: false });
    expect(onContactConverted).not.toHaveBeenCalled();
  });
});
