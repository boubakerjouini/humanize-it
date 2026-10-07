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
