// ===========================================================
// lib/url-scrub.ts — Removes signed tokens from URLs before analytics see them.
//
// Email links carry a signed token in ?t= (preference center, double opt-in
// confirm pages). Whoever holds one can change that contact's email settings,
// so it must never reach PostHog, Vercel Analytics or Google Analytics, whose
// dashboards many people can read. Pure: safe in client and server code.
// ===========================================================

/** Query parameters that carry a credential. */
export const SENSITIVE_QUERY_PARAMS: readonly string[] = ["t"];

const SENSITIVE_PATTERN = new RegExp(`[?&](${SENSITIVE_QUERY_PARAMS.join("|")})=`);

/** The URL without its sensitive query parameters. Relative URLs stay relative; anything unparsable is returned as is. */
export function scrubUrl(url: string): string {
  if (!SENSITIVE_PATTERN.test(url)) return url;
  const absolute = /^[a-z][a-z0-9+.-]*:\/\//i.test(url);
  let parsed: URL;
  try {
    parsed = new URL(url, "http://relative.invalid");
  } catch {
    return url;
  }
  for (const param of SENSITIVE_QUERY_PARAMS) parsed.searchParams.delete(param);
  return absolute ? parsed.toString() : `${parsed.pathname}${parsed.search}${parsed.hash}`;
}

type Props = Record<string, unknown>;

function scrubStrings(props: Props | undefined): Props | undefined {
  if (!props) return props;
  let out: Props | undefined;
  for (const [key, value] of Object.entries(props)) {
    if (typeof value !== "string") continue;
    const clean = scrubUrl(value);
    if (clean !== value) {
      out ??= { ...props };
      out[key] = clean;
    }
  }
  return out ?? props;
}

/**
 * Scrub every URL-like string of an analytics event: its properties and the
 * person properties it sets ($current_url, $referrer, $initial_referrer, ...).
 */
export function scrubEvent<E extends { properties?: Props; $set?: Props; $set_once?: Props }>(event: E): E {
  return {
    ...event,
    ...(event.properties ? { properties: scrubStrings(event.properties) } : {}),
    ...(event.$set ? { $set: scrubStrings(event.$set) } : {}),
    ...(event.$set_once ? { $set_once: scrubStrings(event.$set_once) } : {}),
  };
}
