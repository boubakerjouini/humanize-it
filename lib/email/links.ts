// ===========================================================
// lib/email/links.ts — Absolute URLs that go into emails: signed unsubscribe,
// preference and double opt-in links, lead-magnet downloads, and UTM tagging.
// First-party click tracking was cut, so links point straight at their target.
// GET links never change state (scanners prefetch them); the one-click
// unsubscribe endpoint acts on POST only.
// ===========================================================

import type { MagnetSlug } from "@/lib/growth/constants";
import { appUrl } from "@/lib/growth/flags";
import { signToken, type UnsubScope } from "@/lib/email/tokens";

type LinkOpts = { now?: number };

/** Absolute URL on our site for a path ("/dashboard") or an already absolute URL. */
export function absoluteUrl(pathOrUrl: string): string {
  return new URL(pathOrUrl, `${appUrl()}/`).toString();
}

function withToken(path: string, token: string, extra: Record<string, string> = {}): string {
  const url = new URL(path, `${appUrl()}/`);
  url.searchParams.set("t", token);
  for (const [key, value] of Object.entries(extra)) url.searchParams.set(key, value);
  return url.toString();
}

/** RFC 8058 one-click target (List-Unsubscribe header). POST only. */
export function oneClickUrl(contactId: string, scope: UnsubScope): string {
  return withToken("/api/email/unsubscribe", signToken({ p: "unsub", c: contactId, s: scope }));
}

/** The visible "Unsubscribe" footer link: the preference center with the unsubscribe action highlighted. */
export function unsubscribePageUrl(contactId: string, scope: UnsubScope): string {
  return withToken("/email/preferences", signToken({ p: "prefs", c: contactId, s: scope }), { u: "1" });
}

export function preferencesUrl(contactId: string): string {
  return withToken("/email/preferences", signToken({ p: "prefs", c: contactId }));
}

/** Thanks page that shows the download and confirms tips only on an explicit click. */
export function magnetConfirmUrl(contactId: string, slug: MagnetSlug, opts: LinkOpts = {}): string {
  return withToken(`/free/${slug}/thanks`, signToken({ p: "confirm", c: contactId, m: slug }, { now: opts.now }));
}

export function waitlistConfirmUrl(contactId: string, opts: LinkOpts = {}): string {
  return withToken("/extension/confirmed", signToken({ p: "confirm", c: contactId }, { now: opts.now }));
}

export function genericConfirmUrl(contactId: string, opts: LinkOpts = {}): string {
  return withToken("/free/confirmed", signToken({ p: "confirm", c: contactId }, { now: opts.now }));
}

/** Public PDF of a lead magnet (committed under public/lead-magnets). */
export function magnetDownloadUrl(slug: MagnetSlug): string {
  return absoluteUrl(`/lead-magnets/${slug}.pdf`);
}

function isOwnSite(url: URL): boolean {
  const own = new URL(appUrl());
  return url.host === own.host;
}

/**
 * Add utm_source=email, utm_medium and utm_campaign to a link on our own site.
 * Relative paths are made absolute. External links and links that already
 * carry UTMs are returned untouched.
 */
export function withUtm(pathOrUrl: string, utm: { medium: string; campaign: string; content?: string }): string {
  let url: URL;
  try {
    url = new URL(pathOrUrl, `${appUrl()}/`);
  } catch {
    return pathOrUrl;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return pathOrUrl;
  if (!isOwnSite(url) || url.searchParams.has("utm_source")) return url.toString();
  url.searchParams.set("utm_source", "email");
  url.searchParams.set("utm_medium", utm.medium);
  url.searchParams.set("utm_campaign", utm.campaign);
  if (utm.content) url.searchParams.set("utm_content", utm.content);
  return url.toString();
}
