"use client";

// ===========================================================
// components/growth/founding-offers.ts — Client view of GET /api/offers:
// Founding 100 state (and whether this user is a founding member, for the
// badge) and the Word Pack, which stays hidden until its LemonSqueezy
// variant is configured. One fetch per page, shared by every caller.
// ===========================================================

import { useEffect, useState } from "react";

export type OffersInfo = {
  founding: { configured: boolean; open: boolean; left: number | null; member: boolean };
  wordPack: { available: true; priceUsd: number; words: number; days: number } | { available: false };
};

let pending: Promise<OffersInfo | null> | null = null;

function loadOffers(): Promise<OffersInfo | null> {
  pending ??= fetch("/api/offers")
    .then((r) => (r.ok ? (r.json() as Promise<OffersInfo>) : null))
    .catch(() => null);
  return pending;
}

/** Null until loaded, or when the request failed (callers then show nothing extra). */
export function useOffers(): OffersInfo | null {
  const [info, setInfo] = useState<OffersInfo | null>(null);
  useEffect(() => {
    let alive = true;
    void loadOffers().then((d) => {
      if (alive) setInfo(d);
    });
    return () => {
      alive = false;
    };
  }, []);
  return info;
}

/** Start a one-time checkout; resolves with an error message, or navigates away. */
export async function startOfferCheckout(offer: "founding" | "wordpack"): Promise<string | null> {
  try {
    const res = await fetch("/api/offers/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ offer }),
    });
    const data = (await res.json().catch(() => ({}))) as { url?: string; error?: { message?: string } };
    if (res.ok && data.url) {
      window.location.href = data.url;
      return null;
    }
    return data.error?.message ?? "Could not start checkout. Please try again.";
  } catch {
    return "Network error starting checkout.";
  }
}
