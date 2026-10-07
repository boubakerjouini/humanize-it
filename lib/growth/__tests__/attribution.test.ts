import {
  buildTouch,
  classifyChannel,
  decodeTouch,
  encodeTouch,
  externalReferrerHost,
  hasSignal,
  mergeLastTouch,
  normalizeRef,
  readCookieValue,
  touchCookie,
  touchToFirstTouchFields,
  type Touch,
} from "@/lib/growth/attribution";

const NOW = Date.UTC(2026, 9, 6, 12, 0, 0);
const SITE = "https://humanizeit.app";

function touch(path: string, referrer = "") {
  return buildTouch({ href: `${SITE}${path}`, referrer, now: NOW });
}

function encodeRaw(value: unknown): string {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

describe("classifyChannel rules, in order", () => {
  it("1. a referral code wins over everything, even paid UTMs", () => {
    expect(touch("/?ref=k7m2p9qr&utm_medium=cpc").ch).toBe("referral_program");
  });

  it("does not take launch-directory ?ref= tags for referral codes", () => {
    const producthunt = touch("/?ref=producthunt", "https://www.producthunt.com/posts/humanizeit");
    expect(producthunt.ref).toBeUndefined();
    expect(producthunt.ch).toBe("social");
    for (const [tag, referrer] of [
      ["betalist", "https://betalist.com/startups/humanizeit"],
      ["futurepedia", "https://www.futurepedia.io/tool/humanizeit"],
    ]) {
      const t = touch(`/?ref=${tag}`, referrer);
      expect(t.ref).toBeUndefined();
      expect(t.ch).toBe("referral");
    }
  });

  it("2. paid mediums and ad click ids are paid", () => {
    for (const medium of ["cpc", "PPC", "paid", "paidsearch", "paid_social", "display"]) {
      expect(touch(`/?utm_medium=${medium}&utm_source=reddit`).ch).toBe("paid");
    }
    expect(touch("/?gclid=xyz").ch).toBe("paid");
    expect(touch("/?fbclid=xyz", "https://www.facebook.com/").ch).toBe("paid");
  });

  it("3. email medium or source is email", () => {
    expect(touch("/?utm_medium=email").ch).toBe("email");
    expect(touch("/?utm_source=newsletter").ch).toBe("email");
  });

  it("4. outreach source or outreach/dm medium is outreach", () => {
    expect(touch("/?utm_source=outreach").ch).toBe("outreach");
    expect(touch("/?utm_medium=dm&utm_source=whatsapp").ch).toBe("outreach");
    expect(touch("/?utm_medium=outreach").ch).toBe("outreach");
  });

  it("5. social mediums or a social utm_source is social", () => {
    expect(touch("/?utm_medium=social").ch).toBe("social");
    expect(touch("/?utm_medium=social-organic").ch).toBe("social");
    expect(touch("/?utm_medium=community").ch).toBe("social");
    expect(touch("/?utm_source=reddit").ch).toBe("social");
    expect(touch("/?utm_source=LinkedIn").ch).toBe("social");
  });

  it("6. AI assistants come before search engines (gemini.google.com is not Google search)", () => {
    expect(touch("/", "https://gemini.google.com/app").ch).toBe("ai_assistant");
    expect(touch("/", "https://chatgpt.com/").ch).toBe("ai_assistant");
    expect(touch("/", "https://www.perplexity.ai/search").ch).toBe("ai_assistant");
    expect(touch("/", "https://claude.ai/chat/1").ch).toBe("ai_assistant");
  });

  it("7. search engines are organic search", () => {
    for (const ref of [
      "https://www.google.com/",
      "https://www.google.co.uk/",
      "https://news.google.fr/",
      "https://www.bing.com/search?q=x",
      "https://duckduckgo.com/",
      "https://yandex.ru/",
      "https://search.brave.com/",
    ]) {
      expect(touch("/", ref).ch).toBe("organic_search");
    }
  });

  it("8. social hosts are social", () => {
    for (const ref of ["https://www.reddit.com/r/x", "https://t.co/abc", "https://lnkd.in/x", "https://www.linkedin.com/feed", "https://m.facebook.com/"]) {
      expect(touch("/", ref).ch).toBe("social");
    }
  });

  it("9. any other external host is a referral", () => {
    expect(touch("/", "https://someblog.example.org/post").ch).toBe("referral");
  });

  it("10. nothing at all is direct", () => {
    expect(touch("/").ch).toBe("direct");
  });

  it("classifies a bare touch shape", () => {
    expect(classifyChannel({ rh: "googleusercontent.com" })).toBe("referral");
    expect(classifyChannel({})).toBe("direct");
  });
});

describe("referrer handling", () => {
  it("ignores our own hosts, previews, checkout returns and sign-in round trips", () => {
    for (const ref of [
      "https://humanizeit.app/pricing",
      "https://www.humanizeit.app/",
      "https://accounts.humanizeit.app/sign-in",
      "https://humanize-it-git-feat.vercel.app/",
      "http://localhost:3458/",
      "https://humanizeit.lemonsqueezy.com/checkout",
      "https://accounts.google.com/o/oauth2",
    ]) {
      const t = touch("/dashboard", ref);
      expect(t.rh).toBeUndefined();
      expect(t.ch).toBe("direct");
    }
  });

  it("stores the host only, without www", () => {
    expect(externalReferrerHost("https://www.Reddit.com/r/writing?x=1")).toBe("reddit.com");
    expect(externalReferrerHost("not a url")).toBeUndefined();
    expect(externalReferrerHost("android-app://com.google.android.gm/")).toBeUndefined();
  });

  it("lets a UTM win over the referrer", () => {
    expect(touch("/?utm_source=reddit", "https://www.google.com/").ch).toBe("social");
    expect(touch("/?utm_medium=email", "https://www.bing.com/").ch).toBe("email");
  });
});

describe("buildTouch fields and caps", () => {
  it("keeps the pathname only and records click ids as presence", () => {
    const t = touch("/free/ai-detection-field-guide?utm_source=reddit&gclid=SECRET#top");
    expect(t.lp).toBe("/free/ai-detection-field-guide");
    expect(t.cid).toBe("g");
    expect(JSON.stringify(t)).not.toContain("SECRET");
    expect(t.ts).toBe(NOW);
  });

  it("caps the landing path at 200 and each UTM at 100 characters", () => {
    const long = "a".repeat(400);
    const t = touch(`/${long}?utm_source=${long}&utm_medium=${long}&utm_campaign=${long}&utm_term=${long}&utm_content=${long}`);
    expect(t.lp.length).toBe(200);
    for (const key of ["us", "um", "uc", "ut", "ux"] as const) expect(t[key]!.length).toBe(100);
  });

  it("encodes even a maximal touch under 1 KB", () => {
    const long = "z".repeat(400);
    const t = touch(`/${long}?utm_source=${long}&utm_medium=${long}&utm_campaign=${long}&utm_term=${long}&utm_content=${long}`, `https://${"b".repeat(60)}.example.com/`);
    expect(encodeTouch(t).length).toBeLessThanOrEqual(1000);
    expect(decodeTouch(encodeTouch(t))).not.toBeNull();
  });

  it("falls back to a direct touch for an unparseable href", () => {
    expect(buildTouch({ href: "::nope", now: NOW })).toEqual({ v: 1, ts: NOW, ch: "direct", lp: "/" });
  });
});

describe("ref normalization", () => {
  it("upper-cases valid codes and drops invalid ones", () => {
    expect(normalizeRef("abc12345")).toBe("ABC12345");
    expect(normalizeRef(" k7m2p9qr ")).toBe("K7M2P9QR");
    expect(normalizeRef("ab12")).toBeUndefined();
    expect(normalizeRef("abc-1234")).toBeUndefined();
    expect(normalizeRef("K7M2P9QR1")).toBeUndefined();
    expect(touch("/sign-up?ref=bad!").ref).toBeUndefined();
  });

  it("accepts only 8 Crockford base32 characters (no I, L, O or U)", () => {
    expect(normalizeRef("ABC123")).toBeUndefined();
    for (const letter of ["I", "L", "O", "U"]) expect(normalizeRef(`K7M2P9Q${letter}`)).toBeUndefined();
    for (const tag of ["producthunt", "betalist", "futurepedia", "hackernews"]) expect(normalizeRef(tag)).toBeUndefined();
  });
});

describe("encode / decode", () => {
  it("round-trips a full touch", () => {
    const t = touch("/blog/x?utm_source=quora&utm_medium=community&utm_campaign=launch&utm_term=t&utm_content=v2&ref=K7M2P9QR", "https://www.quora.com/");
    expect(decodeTouch(encodeTouch(t))).toEqual(t);
  });

  it("round-trips non-ASCII UTM values", () => {
    const t = touch("/?utm_campaign=%C3%A9t%C3%A9");
    expect(decodeTouch(encodeTouch(t))?.uc).toBe("été");
  });

  it("returns null for anything malformed", () => {
    const valid = { v: 1, ts: NOW, ch: "direct", lp: "/" };
    expect(decodeTouch(undefined)).toBeNull();
    expect(decodeTouch("")).toBeNull();
    expect(decodeTouch("%%%")).toBeNull();
    expect(decodeTouch(encodeRaw("just a string"))).toBeNull();
    expect(decodeTouch(encodeRaw([valid]))).toBeNull();
    expect(decodeTouch(encodeRaw({ ...valid, v: 2 }))).toBeNull();
    expect(decodeTouch(encodeRaw({ ...valid, ch: "carrier_pigeon" }))).toBeNull();
    expect(decodeTouch(encodeRaw({ ...valid, lp: "no-slash" }))).toBeNull();
    expect(decodeTouch(encodeRaw({ ...valid, ts: -1 }))).toBeNull();
    expect(decodeTouch(encodeRaw({ ...valid, us: 42 }))).toBeNull();
    expect(decodeTouch(encodeRaw({ ...valid, ref: "x" }))).toBeNull();
    expect(decodeTouch(encodeRaw({ ...valid, cid: "z" }))).toBeNull();
    expect(decodeTouch(encodeRaw(valid))).toEqual(valid);
  });

  it("re-applies caps to an oversized but well-formed cookie", () => {
    const decoded = decodeTouch(encodeRaw({ v: 1, ts: NOW, ch: "social", lp: "/", us: "u".repeat(300) }));
    expect(decoded?.us?.length).toBe(100);
  });
});

describe("last-touch overwrite rules", () => {
  const earlier: Touch = { v: 1, ts: NOW - 1000, ch: "social", lp: "/", us: "reddit" };

  it("sets the last touch when there is none", () => {
    const direct = touch("/");
    expect(mergeLastTouch(null, direct)).toBe(direct);
  });

  it("keeps the previous touch on a visit without a signal", () => {
    const internal = touch("/dashboard", "https://humanizeit.app/");
    expect(hasSignal(internal)).toBe(false);
    expect(mergeLastTouch(earlier, internal)).toBe(earlier);
  });

  it("overwrites on a UTM, a ref, a click id or an external referrer", () => {
    for (const next of [touch("/?utm_source=x"), touch("/?ref=K7M2P9QR"), touch("/?msclkid=1"), touch("/", "https://news.ycombinator.com/")]) {
      expect(mergeLastTouch(earlier, next)).toBe(next);
    }
  });
});

describe("cookie helpers and contact mapping", () => {
  it("writes first-party Lax cookies, Secure only on https", () => {
    expect(touchCookie("hz_ft", "abc", { maxAgeSeconds: 60, secure: true })).toBe("hz_ft=abc; Max-Age=60; Path=/; SameSite=Lax; Secure");
    expect(touchCookie("hz_lt", "abc", { maxAgeSeconds: 60, secure: false })).not.toContain("Secure");
  });

  it("reads one cookie out of a header", () => {
    expect(readCookieValue("a=1; hz_ft=eyJ2; b=2", "hz_ft")).toBe("eyJ2");
    expect(readCookieValue("a=1", "hz_ft")).toBeUndefined();
    expect(readCookieValue(undefined, "hz_ft")).toBeUndefined();
  });

  it("maps a touch onto the contact first-touch columns", () => {
    const t = touch("/free?utm_source=reddit&utm_medium=community&ref=K7M2P9QR", "https://www.reddit.com/");
    expect(touchToFirstTouchFields(t)).toEqual({
      channel: "referral_program",
      referrerHost: "reddit.com",
      landingPath: "/free",
      utmSource: "reddit",
      utmMedium: "community",
      utmCampaign: null,
      utmTerm: null,
      utmContent: null,
      refCode: "K7M2P9QR",
      firstTouchAt: new Date(NOW),
    });
  });
});
