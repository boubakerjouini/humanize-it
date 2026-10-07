import { bareAddress, forwardTargets, inboundTaskTitle, isOwnAddress } from "@/lib/email/inbound-rules";

describe("inbound rules", () => {
  it("extracts the bare, lower-cased address", () => {
    expect(bareAddress("Jane Doe <Jane@Example.com>")).toBe("jane@example.com");
    expect(bareAddress("  jane@example.com ")).toBe("jane@example.com");
  });

  it("recognises our own domains and their subdomains (loop guard)", () => {
    expect(isOwnAddress("HumanizeIt <hello@mail.humanizeit.app>")).toBe(true);
    expect(isOwnAddress("support@humanizeit.app")).toBe(true);
    expect(isOwnAddress("x@bounces.mail.humanizeit.app")).toBe(true);
    expect(isOwnAddress("jane@example.com")).toBe(false);
    // A look-alike domain is not ours.
    expect(isOwnAddress("evil@humanizeit.app.example.com")).toBe(false);
    expect(isOwnAddress("evil@nothumanizeit.app")).toBe(false);
  });

  it("forwards to INBOUND_FORWARD_TO when set, else the admins, never to our own domains", () => {
    expect(forwardTargets(undefined, ["Founder@Gmail.com"])).toEqual(["founder@gmail.com"]);
    expect(forwardTargets("  ", ["founder@gmail.com"])).toEqual(["founder@gmail.com"]);
    expect(forwardTargets("a@x.com, A@X.com, b@y.com", ["founder@gmail.com"])).toEqual(["a@x.com", "b@y.com"]);
    expect(forwardTargets("support@humanizeit.app", ["founder@gmail.com"])).toEqual([]);
    expect(forwardTargets(undefined, ["not-an-address", "ok@x.com"])).toEqual(["ok@x.com"]);
  });

  it("builds a single-line, capped task title", () => {
    expect(inboundTaskTitle("Jane <jane@x.com>", "Refund\n please")).toBe("Reply to jane@x.com: Refund please");
    expect(inboundTaskTitle("jane@x.com", null)).toBe("Reply to jane@x.com: (no subject)");
    expect(inboundTaskTitle("jane@x.com", "x".repeat(500)).length).toBe(180);
  });
});
