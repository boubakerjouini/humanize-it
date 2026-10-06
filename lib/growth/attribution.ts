// ===========================================================
// lib/growth/attribution.ts — First- and last-touch attribution (pure).
//
// Two first-party cookies hold a compact "touch" (where a visit came from):
//   hz_ft  first touch, 180 days, written once and never overwritten
//   hz_lt  last touch, 30 days, replaced only by a visit that carries a signal
//          (a UTM, a ?ref= code, an ad click id, or an external referrer), so
//          an internal page view never erases how someone actually arrived.
// Both are base64url JSON under 1 KB. A click id is recorded only as present,
// never its value. Shared by the client capture component and the server
// reader, so it must stay free of DOM, Node and DB imports.
// ===========================================================

import { CHANNELS, type Channel } from "@/lib/growth/constants";

export const FIRST_TOUCH_COOKIE = "hz_ft";
export const LAST_TOUCH_COOKIE = "hz_lt";
export const FIRST_TOUCH_MAX_AGE_S = 180 * 24 * 60 * 60;
export const LAST_TOUCH_MAX_AGE_S = 30 * 24 * 60 * 60;

export type ClickIdKind = "g" | "m" | "f" | "t";

export type Touch = {
  v: 1;
  /** epoch ms of the visit */
  ts: number;
  ch: Channel;
  /** referrer host (external only) */
  rh?: string;
  /** landing pathname, no query */
  lp: string;
  us?: string;
  um?: string;
  uc?: string;
  ut?: string;
  ux?: string;
  /** referral-program code, upper-case */
  ref?: string;
  /** an ad click id was present (gclid, msclkid, fbclid, ttclid) */
  cid?: ClickIdKind;
};

const LIMITS = { lp: 200, utm: 100, rh: 100 } as const;
/** Fallback caps applied when a touch would encode past MAX_ENCODED_LENGTH. */
const TIGHT_LIMITS = { lp: 100, rh: 60, us: 40, um: 30, uc: 60, ut: 30, ux: 30 } as const;
const MAX_ENCODED_LENGTH = 1000;

const CLICK_ID_PARAMS: ReadonlyArray<readonly [string, ClickIdKind]> = [
  ["gclid", "g"],
  ["msclkid", "m"],
  ["fbclid", "f"],
  ["ttclid", "t"],
];
const CLICK_ID_KINDS: readonly ClickIdKind[] = ["g", "m", "f", "t"];

const REF_PATTERN = /^[A-Z0-9]{6,12}$/;

/**
 * Hosts that are never a referrer: our own domains, previews, checkout returns
 * and dev Clerk pages. Entries match the host itself and any subdomain.
 */
export const DEFAULT_OWN_HOSTS: readonly string[] = [
  "humanizeit.app",
  "vercel.app",
  "lemonsqueezy.com",
  "accounts.dev",
  "localhost",
  "127.0.0.1",
];

/** Sign-in round trips through these hosts are not acquisition. */
const AUTH_HOSTS = ["accounts.google.com", "appleid.apple.com", "login.microsoftonline.com", "login.live.com"];

const AI_ASSISTANT_HOSTS = [
  "chatgpt.com",
  "chat.openai.com",
  "perplexity.ai",
  "gemini.google.com",
  "copilot.microsoft.com",
  "claude.ai",
  "you.com",
  "phind.com",
];

const SEARCH_HOSTS = [
  "bing.com",
  "duckduckgo.com",
  "search.yahoo.com",
  "baidu.com",
  "ecosia.org",
  "search.brave.com",
  "startpage.com",
  "qwant.com",
];
/** google.com, google.co.uk, news.google.fr, yandex.ru, … */
const SEARCH_BRAND_PATTERN = /^(?:[a-z0-9-]+\.)*(?:google|yandex)\.[a-z]{2,3}(?:\.[a-z]{2})?$/;

const SOCIAL_HOSTS = [
  "reddit.com",
  "out.reddit.com",
  "t.co",
  "x.com",
  "twitter.com",
  "facebook.com",
  "l.facebook.com",
  "lnkd.in",
  "linkedin.com",
  "instagram.com",
  "tiktok.com",
  "youtube.com",
  "quora.com",
  "producthunt.com",
  "news.ycombinator.com",
  "medium.com",
  "discord.com",
  "t.me",
  "wa.me",
];

const SOCIAL_UTM_SOURCES = new Set([
  "reddit",
  "quora",
  "linkedin",
  "x",
  "twitter",
  "youtube",
  "tiktok",
  "whatsapp",
  "producthunt",
  "facebook",
  "instagram",
  "medium",
  "discord",
  "telegram",
  "threads",
  "bluesky",
  "pinterest",
  "hackernews",
]);
const PAID_MEDIUMS = new Set(["cpc", "ppc", "paid", "paidsearch", "paid_social", "display"]);
const EMAIL_VALUES = new Set(["email", "newsletter"]);
const OUTREACH_MEDIUMS = new Set(["outreach", "dm"]);
const SOCIAL_MEDIUMS = new Set(["social", "social-organic", "community"]);

function matchesDomain(host: string, domain: string): boolean {
  return host === domain || host.endsWith(`.${domain}`);
}

function matchesAny(host: string, domains: readonly string[]): boolean {
  return domains.some((d) => matchesDomain(host, d));
}

function clip(value: string | null | undefined, max: number): string | undefined {
  const v = value?.trim();
  return v ? v.slice(0, max) : undefined;
}

/** Upper-cased referral code, or undefined unless it matches ^[A-Z0-9]{6,12}$. */
export function normalizeRef(raw: string | null | undefined): string | undefined {
  const v = raw?.trim().toUpperCase();
  return v && REF_PATTERN.test(v) ? v : undefined;
}

/** Lower-case host of an external referrer (no "www."), or undefined. */
export function externalReferrerHost(
  referrer: string | null | undefined,
  ownHosts: readonly string[] = DEFAULT_OWN_HOSTS
): string | undefined {
  if (!referrer) return undefined;
  let host: string;
  try {
    const url = new URL(referrer);
    if (url.protocol !== "http:" && url.protocol !== "https:") return undefined;
    host = url.hostname.toLowerCase();
  } catch {
    return undefined;
  }
  if (!host || matchesAny(host, ownHosts) || matchesAny(host, AUTH_HOSTS)) return undefined;
  return clip(host.replace(/^www\./, ""), LIMITS.rh);
}

/** Ordered rules, first match wins (spec §4.2). */
export function classifyChannel(t: Pick<Touch, "ref" | "um" | "us" | "cid" | "rh">): Channel {
  const medium = t.um?.toLowerCase();
  const source = t.us?.toLowerCase();
  const host = t.rh?.toLowerCase();

  if (t.ref) return "referral_program";
  if ((medium && PAID_MEDIUMS.has(medium)) || t.cid) return "paid";
  if ((medium && EMAIL_VALUES.has(medium)) || (source && EMAIL_VALUES.has(source))) return "email";
  if (source === "outreach" || (medium && OUTREACH_MEDIUMS.has(medium))) return "outreach";
  if ((medium && SOCIAL_MEDIUMS.has(medium)) || (source && SOCIAL_UTM_SOURCES.has(source))) return "social";
  if (host) {
    // AI assistants first: gemini.google.com would otherwise read as Google search.
    if (matchesAny(host, AI_ASSISTANT_HOSTS)) return "ai_assistant";
    if (matchesAny(host, SEARCH_HOSTS) || SEARCH_BRAND_PATTERN.test(host)) return "organic_search";
    if (matchesAny(host, SOCIAL_HOSTS)) return "social";
    return "referral";
  }
  return "direct";
}

/** Build the touch for one page view. Never throws. */
export function buildTouch(input: {
  href: string;
  referrer?: string | null;
  now: number | Date;
  ownHosts?: readonly string[];
}): Touch {
  const ts = typeof input.now === "number" ? input.now : input.now.getTime();
  let url: URL;
  try {
    url = new URL(input.href);
  } catch {
    return { v: 1, ts, ch: "direct", lp: "/" };
  }
  const params = url.searchParams;
  const utm = (key: string) => clip(params.get(key), LIMITS.utm);
  const clickId = CLICK_ID_PARAMS.find(([param]) => !!params.get(param)?.trim());

  const touch: Touch = { v: 1, ts, ch: "direct", lp: clip(url.pathname, LIMITS.lp) ?? "/" };
  const rh = externalReferrerHost(input.referrer, input.ownHosts ?? DEFAULT_OWN_HOSTS);
  if (rh) touch.rh = rh;
  const us = utm("utm_source");
  if (us) touch.us = us;
  const um = utm("utm_medium");
  if (um) touch.um = um;
  const uc = utm("utm_campaign");
  if (uc) touch.uc = uc;
  const ut = utm("utm_term");
  if (ut) touch.ut = ut;
  const ux = utm("utm_content");
  if (ux) touch.ux = ux;
  const ref = normalizeRef(params.get("ref"));
  if (ref) touch.ref = ref;
  if (clickId) touch.cid = clickId[1];

  touch.ch = classifyChannel(touch);
  return touch;
}

/** True when the visit says something about where it came from. */
export function hasSignal(t: Touch): boolean {
  return !!(t.us || t.um || t.uc || t.ut || t.ux || t.ref || t.cid || t.rh);
}

/** The touch to store as hz_lt after this visit. */
export function mergeLastTouch(prev: Touch | null, next: Touch): Touch {
  if (prev && !hasSignal(next)) return prev;
  return next;
}

// ── Encoding ────────────────────────────────────────────────────────────────

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(encoded: string): string {
  const b64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

function withLimits(t: Touch, limits: typeof TIGHT_LIMITS): Touch {
  const out: Touch = { ...t, lp: t.lp.slice(0, limits.lp) || "/" };
  if (t.rh) out.rh = t.rh.slice(0, limits.rh);
  if (t.us) out.us = t.us.slice(0, limits.us);
  if (t.um) out.um = t.um.slice(0, limits.um);
  if (t.uc) out.uc = t.uc.slice(0, limits.uc);
  if (t.ut) out.ut = t.ut.slice(0, limits.ut);
  if (t.ux) out.ux = t.ux.slice(0, limits.ux);
  return out;
}

/** base64url(JSON), shrunk if needed so the cookie stays under 1 KB. */
export function encodeTouch(t: Touch): string {
  const full = toBase64Url(JSON.stringify(t));
  if (full.length <= MAX_ENCODED_LENGTH) return full;
  return toBase64Url(JSON.stringify(withLimits(t, TIGHT_LIMITS)));
}

function optionalString(value: unknown, max: number): string | undefined | null {
  if (value === undefined) return undefined;
  if (typeof value !== "string") return null;
  return clip(value, max);
}

/** Parse a cookie value back into a sanitized touch; null on anything malformed. */
export function decodeTouch(raw: string | null | undefined): Touch | null {
  if (!raw || raw.length > 4096) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(fromBase64Url(raw));
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const o = parsed as Record<string, unknown>;
  if (o.v !== 1) return null;
  if (typeof o.ts !== "number" || !Number.isFinite(o.ts) || o.ts <= 0) return null;
  if (typeof o.ch !== "string" || !(CHANNELS as readonly string[]).includes(o.ch)) return null;
  if (typeof o.lp !== "string" || !o.lp.startsWith("/")) return null;

  const touch: Touch = { v: 1, ts: o.ts, ch: o.ch as Channel, lp: o.lp.slice(0, LIMITS.lp) };
  const fields = [
    ["rh", LIMITS.rh],
    ["us", LIMITS.utm],
    ["um", LIMITS.utm],
    ["uc", LIMITS.utm],
    ["ut", LIMITS.utm],
    ["ux", LIMITS.utm],
  ] as const;
  for (const [key, max] of fields) {
    const value = optionalString(o[key], max);
    if (value === null) return null;
    if (value) touch[key] = value;
  }
  if (o.ref !== undefined) {
    const ref = typeof o.ref === "string" ? normalizeRef(o.ref) : undefined;
    if (!ref) return null;
    touch.ref = ref;
  }
  if (o.cid !== undefined) {
    if (typeof o.cid !== "string" || !CLICK_ID_KINDS.includes(o.cid as ClickIdKind)) return null;
    touch.cid = o.cid as ClickIdKind;
  }
  return touch;
}

/** `Set-Cookie`-style string for document.cookie: first-party, Lax, not HttpOnly. */
export function touchCookie(name: string, value: string, opts: { maxAgeSeconds: number; secure: boolean }): string {
  return `${name}=${value}; Max-Age=${opts.maxAgeSeconds}; Path=/; SameSite=Lax${opts.secure ? "; Secure" : ""}`;
}

/** Read one cookie value from a `document.cookie` / Cookie header string. */
export function readCookieValue(cookieHeader: string | null | undefined, name: string): string | undefined {
  if (!cookieHeader) return undefined;
  for (const part of cookieHeader.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() === name) return part.slice(eq + 1).trim();
  }
  return undefined;
}

/** Contact first-touch columns for a touch (lib/growth/attribution-server.ts writes them). */
export function touchToFirstTouchFields(t: Touch) {
  return {
    channel: t.ch,
    referrerHost: t.rh ?? null,
    landingPath: t.lp,
    utmSource: t.us ?? null,
    utmMedium: t.um ?? null,
    utmCampaign: t.uc ?? null,
    utmTerm: t.ut ?? null,
    utmContent: t.ux ?? null,
    refCode: t.ref ?? null,
    firstTouchAt: new Date(t.ts),
  };
}
