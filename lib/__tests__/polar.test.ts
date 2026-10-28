// ensureCustomer: every checkout opens on the buyer's own Polar customer
// (external id = our user id), created on first use. A parallel create is
// resolved by reading it back; an email Polar refuses or another customer
// already holds becomes a BillingAccountError the routes can show.
// deleteCustomerOf: account deletion cancels billing, best effort.

const mockDeleteExternal = jest.fn();
const mockOrgList = jest.fn();
jest.mock("@polar-sh/sdk/2026-10", () => ({
  ...jest.requireActual("@polar-sh/sdk/2026-10"),
  createPolar: () => ({ customers: { deleteExternal: mockDeleteExternal }, organizations: { list: mockOrgList } }),
}));

import { errors } from "@polar-sh/sdk/2026-10";
import type { Polar } from "@polar-sh/sdk/2026-10";
import { BillingAccountError, checkoutPaymentsEnabled, customerPortalUrl, deleteCustomerOf, ensureCustomer } from "@/lib/polar";

const notFound = () => new errors.ResourceNotFound(404, { error: "ResourceNotFound", detail: "Not found" });
const invalid = (field: string, msg: string) =>
  new errors.HTTPValidationError(422, { detail: [{ loc: ["body", field], msg, type: "value_error" }] });

const user = { id: "user_1", email: "buyer@example.org", name: "Buyer" };

function client() {
  const getExternal = jest.fn();
  const create = jest.fn();
  const deleteExternal = jest.fn();
  return { polar: { customers: { getExternal, create, deleteExternal } } as unknown as Polar, getExternal, create, deleteExternal };
}

const savedEnv = { ...process.env };

afterEach(() => {
  process.env = savedEnv;
  jest.restoreAllMocks();
});

describe("ensureCustomer", () => {
  it("reuses the customer that already carries the user's id", async () => {
    const { polar, getExternal, create } = client();
    getExternal.mockResolvedValue({ id: "cus_1" });
    await expect(ensureCustomer(polar, user)).resolves.toBe("cus_1");
    expect(getExternal).toHaveBeenCalledWith("user_1");
    expect(create).not.toHaveBeenCalled();
  });

  it("creates one with the account's email on first use", async () => {
    const { polar, getExternal, create } = client();
    getExternal.mockRejectedValue(notFound());
    create.mockResolvedValue({ id: "cus_new" });
    await expect(ensureCustomer(polar, user)).resolves.toBe("cus_new");
    expect(create).toHaveBeenCalledWith({ external_id: "user_1", email: "buyer@example.org", name: "Buyer" });
  });

  it("reads it back when a parallel request created it first", async () => {
    const { polar, getExternal, create } = client();
    getExternal.mockRejectedValueOnce(notFound()).mockResolvedValueOnce({ id: "cus_race" });
    create.mockRejectedValue(invalid("external_id", "A customer with this external ID already exists."));
    await expect(ensureCustomer(polar, user)).resolves.toBe("cus_race");
  });

  it("refuses when another Polar customer holds the email", async () => {
    const { polar, getExternal, create } = client();
    getExternal.mockRejectedValue(notFound());
    create.mockRejectedValue(invalid("email", "A customer with this email address already exists."));
    const err = await ensureCustomer(polar, user).catch((e) => e);
    expect(err).toBeInstanceOf(BillingAccountError);
    expect(err.code).toBe("EMAIL_TAKEN");
  });

  it("refuses an email Polar won't accept", async () => {
    const { polar, getExternal, create } = client();
    getExternal.mockRejectedValue(notFound());
    create.mockRejectedValue(invalid("email", "The domain name example.com does not accept email."));
    const err = await ensureCustomer(polar, user).catch((e) => e);
    expect(err).toBeInstanceOf(BillingAccountError);
    expect(err.code).toBe("EMAIL_REJECTED");
  });

  it("passes any other Polar error through", async () => {
    const { polar, getExternal, create } = client();
    getExternal.mockRejectedValue(new Error("Polar down"));
    await expect(ensureCustomer(polar, user)).rejects.toThrow("Polar down");
    expect(create).not.toHaveBeenCalled();
  });
});

describe("customerPortalUrl", () => {
  const portal = (create: jest.Mock) => ({ customerSessions: { create } }) as unknown as Polar;

  it("opens the portal by our user id", async () => {
    const create = jest.fn(async () => ({ customer_portal_url: "https://polar.example/portal/xyz" }));
    await expect(customerPortalUrl(portal(create), "user_1")).resolves.toBe("https://polar.example/portal/xyz");
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ external_customer_id: "user_1" }));
  });

  it("returns null for a user who never bought anything (Polar answers 422, not 404)", async () => {
    const create = jest.fn(async () => Promise.reject(invalid("external_customer_id", "Customer does not exist.")));
    await expect(customerPortalUrl(portal(create), "user_1")).resolves.toBeNull();
  });

  it("passes any other Polar error through", async () => {
    const create = jest.fn(async () => Promise.reject(new Error("Polar down")));
    await expect(customerPortalUrl(portal(create), "user_1")).rejects.toThrow("Polar down");
  });
});

describe("deleteCustomerOf", () => {
  beforeEach(() => {
    mockDeleteExternal.mockReset();
    process.env = { ...savedEnv, POLAR_ACCESS_TOKEN: "polar_test_token" };
  });

  it("deletes the customer that carries the user's id", async () => {
    mockDeleteExternal.mockResolvedValue(undefined);
    await deleteCustomerOf("user_1");
    expect(mockDeleteExternal).toHaveBeenCalledWith("user_1");
  });

  it("is quiet when the user never bought anything", async () => {
    const logged = jest.spyOn(console, "error").mockImplementation(() => {});
    mockDeleteExternal.mockRejectedValue(notFound());
    await expect(deleteCustomerOf("user_1")).resolves.toBeUndefined();
    expect(logged).not.toHaveBeenCalled();
  });

  it("never blocks the account deletion on a Polar error", async () => {
    const logged = jest.spyOn(console, "error").mockImplementation(() => {});
    mockDeleteExternal.mockRejectedValue(new Error("Polar down"));
    await expect(deleteCustomerOf("user_1")).resolves.toBeUndefined();
    expect(logged).toHaveBeenCalled();
  });

  it("does nothing while billing is off", async () => {
    process.env = { ...savedEnv, POLAR_ACCESS_TOKEN: "" };
    await deleteCustomerOf("user_1");
    expect(mockDeleteExternal).not.toHaveBeenCalled();
  });
});

describe("checkoutPaymentsEnabled", () => {
  const org = (checkoutPayments: unknown) => ({ items: [{ id: "org_1", capabilities: { checkout_payments: checkoutPayments } }] });
  let token = 0;
  // A fresh token per test is a fresh client, so the module's cache starts empty.
  beforeEach(() => {
    process.env = { ...savedEnv, POLAR_ACCESS_TOKEN: `polar_oat_test_${++token}` };
    mockOrgList.mockReset();
  });

  it("reads Polar's checkout_payments capability and keeps it five minutes", async () => {
    mockOrgList.mockResolvedValue(org(false));
    expect(await checkoutPaymentsEnabled(1_000)).toBe(false);
    expect(await checkoutPaymentsEnabled(1_000 + 4 * 60_000)).toBe(false);
    expect(mockOrgList).toHaveBeenCalledTimes(1);

    mockOrgList.mockResolvedValue(org(true));
    expect(await checkoutPaymentsEnabled(1_000 + 6 * 60_000)).toBe(true);
    expect(mockOrgList).toHaveBeenCalledTimes(2);
  });

  it("is null, never false, when Polar can't be read, and tries again after a minute", async () => {
    mockOrgList.mockRejectedValue(new Error("network"));
    expect(await checkoutPaymentsEnabled(1_000)).toBeNull();
    mockOrgList.mockResolvedValue(org("yes"));
    expect(await checkoutPaymentsEnabled(1_000 + 30_000)).toBeNull();
    expect(mockOrgList).toHaveBeenCalledTimes(1);
    expect(await checkoutPaymentsEnabled(1_000 + 61_000)).toBeNull();
    expect(mockOrgList).toHaveBeenCalledTimes(2);
  });

  it("is null while billing is off", async () => {
    delete process.env.POLAR_ACCESS_TOKEN;
    expect(await checkoutPaymentsEnabled()).toBeNull();
    expect(mockOrgList).not.toHaveBeenCalled();
  });
});
