import { createHash } from "node:crypto";
import {
  canonicalForLimits,
  canonicalHash,
  emailDomain,
  emailHash,
  isRoleAddress,
  isValidEmail,
  maskEmail,
  normalizeEmail,
} from "@/lib/email/address";

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

describe("normalizeEmail", () => {
  it("trims and lower-cases", () => {
    expect(normalizeEmail("  Sam.Smith@Example.COM ")).toBe("sam.smith@example.com");
  });

  it("rejects anything that isn't an address", () => {
    for (const bad of [null, undefined, "", "   ", "sam", "sam@", "@example.com", "sam@example", "sam smith@example.com", `${"a".repeat(250)}@x.io`]) {
      expect(normalizeEmail(bad)).toBeNull();
    }
    expect(isValidEmail("sam@example.com")).toBe(true);
    expect(isValidEmail("sam@example")).toBe(false);
  });
});

describe("hashing", () => {
  it("hashes the normalized address with sha256", () => {
    expect(emailHash(" Sam@Example.com")).toBe(sha256("sam@example.com"));
    expect(emailHash("sam@example.com")).toHaveLength(64);
  });

  it("gives the same hash for the same inbox spelled differently", () => {
    expect(emailHash("SAM@example.com")).toBe(emailHash("sam@EXAMPLE.com "));
  });

  it("extracts the domain", () => {
    expect(emailDomain("Sam@Mail.Example.com")).toBe("mail.example.com");
    expect(emailDomain("nope")).toBeNull();
  });
});

describe("role addresses", () => {
  it("detects addresses nobody reads", () => {
    for (const role of ["noreply@x.com", "No-Reply@x.com", "donotreply@x.com", "mailer-daemon@x.com", "postmaster@x.com", "abuse@x.com"]) {
      expect(isRoleAddress(role)).toBe(true);
    }
    expect(isRoleAddress("support@x.com")).toBe(false);
    expect(isRoleAddress("noreplyx@x.com")).toBe(false);
    expect(isRoleAddress("garbage")).toBe(false);
  });
});

describe("canonicalForLimits", () => {
  it("drops Gmail dots and folds googlemail.com", () => {
    expect(canonicalForLimits("S.A.M.Smith@gmail.com")).toBe("samsmith@gmail.com");
    expect(canonicalForLimits("sam.smith@googlemail.com")).toBe("samsmith@gmail.com");
  });

  it("drops +tags on every domain", () => {
    expect(canonicalForLimits("sam+magnet1@gmail.com")).toBe("sam@gmail.com");
    expect(canonicalForLimits("s.am+x+y@gmail.com")).toBe("sam@gmail.com");
    expect(canonicalForLimits("sam+news@outlook.com")).toBe("sam@outlook.com");
  });

  it("keeps dots on other domains", () => {
    expect(canonicalForLimits("sam.smith@outlook.com")).toBe("sam.smith@outlook.com");
  });

  it("hashes the canonical form, so variants share one limit key", () => {
    expect(canonicalHash("s.am+a@gmail.com")).toBe(canonicalHash("SAM@googlemail.com"));
    expect(canonicalHash("sam@gmail.com")).not.toBe(canonicalHash("sam@outlook.com"));
  });
});

describe("maskEmail", () => {
  it("shows two characters of the local part", () => {
    expect(maskEmail("boubaker@gmail.com")).toBe("bo***@gmail.com");
    expect(maskEmail("ab@x.io")).toBe("a***@x.io");
    expect(maskEmail("not an email")).toBe("");
  });
});
