// ===========================================================
// lib/client-ip.ts — Best-effort client IP for rate-limit keys.
//
// Vercel sets x-real-ip to the address that connected to its edge, which the
// client can't spoof. The first x-forwarded-for entry can be forged by sending
// the header yourself, so it is only the fallback (other hosts, local dev).
// Never store the result as is: ConsentRecord keeps a keyed hash (hashIp).
// ===========================================================

export function clientIp(req: Request): string {
  const real = req.headers.get("x-real-ip")?.trim();
  if (real) return real;
  const xff = req.headers.get("x-forwarded-for");
  const first = xff?.split(",")[0]?.trim();
  return first || "unknown";
}

/**
 * Rate-limit bucket for an address. One IPv6 subscriber usually holds a whole
 * /64, so keying on the full address would hand them billions of fresh
 * buckets; IPv6 is bucketed by its first four groups. IPv4 stays as is.
 */
export function ipBucket(ip: string): string {
  if (!ip.includes(":") || /^::ffff:\d+\.\d+\.\d+\.\d+$/i.test(ip)) return ip.replace(/^::ffff:/i, "");
  const addr = ip.split("%")[0].toLowerCase();
  const [head, tail = ""] = addr.split("::");
  const headGroups = head ? head.split(":") : [];
  const tailGroups = addr.includes("::") ? (tail ? tail.split(":") : []) : [];
  const missing = Math.max(0, 8 - headGroups.length - tailGroups.length);
  const groups = addr.includes("::") ? [...headGroups, ...Array<string>(missing).fill("0"), ...tailGroups] : headGroups;
  return `${groups.slice(0, 4).map((g) => g.replace(/^0+(?=.)/, "") || "0").join(":")}::/64`;
}
