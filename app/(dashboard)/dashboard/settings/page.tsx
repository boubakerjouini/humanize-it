"use client";

import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import Link from "next/link";
import { ExternalLink, Zap, ArrowRight, AlertTriangle, Check, Sparkles, Gift, Building2 } from "lucide-react";
import { toast } from "sonner";
import { THEME, glow } from "@/lib/theme";

interface UsageData {
  plan: string;
  wordsUsed: number;
  wordsLimit: number;
  rewriteCount: number;
  rewriteLimit: number;
  quotaResetAt: string;
  subscriptionStatus: string | null;
  stripeCurrentPeriodEnd: string | null;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: THEME.surface2, border: `1px solid ${THEME.border}`,
      borderRadius: THEME.radius, overflow: "hidden",
    }}>
      <div style={{ padding: "16px 20px", borderBottom: `1px solid ${THEME.border}` }}>
        <h2 style={{ fontSize: "14px", fontWeight: 700, color: THEME.text, fontFamily: THEME.fontHeading, letterSpacing: "-0.01em" }}>{title}</h2>
      </div>
      <div style={{ padding: "20px" }}>
        {children}
      </div>
    </div>
  );
}

function UsageBar({ label, used, limit, warning }: { label: string; used: number; limit: number; warning?: boolean }) {
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const barColor = warning && pct > 80 ? THEME.ai : THEME.brand;

  return (
    <div style={{ marginBottom: "16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
        <span style={{ fontSize: "12px", color: THEME.textDim }}>{label}</span>
        <span className="tnum" style={{ fontSize: "12px", color: THEME.text }}>
          {used.toLocaleString()} / {limit === -1 ? "∞" : limit.toLocaleString()}
        </span>
      </div>
      <div style={{ height: "6px", background: THEME.surface3, borderRadius: "100px" }}>
        <div style={{
          height: "6px", borderRadius: "100px",
          width: `${pct}%`,
          background: barColor,
          transition: "width 0.5s ease",
        }} />
      </div>
      {warning && pct > 80 && (
        <p style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "11px", color: THEME.ai, marginTop: "6px" }}>
          <AlertTriangle size={11} aria-hidden="true" /> {pct}% used — consider upgrading
        </p>
      )}
    </div>
  );
}

export default function SettingsPage() {
  const { user } = useUser();
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [loadingCheckout, setLoadingCheckout] = useState(false);
  const [loadingPortal, setLoadingPortal] = useState(false);
  const [redeemCode, setRedeemCode] = useState("");
  const [loadingRedeem, setLoadingRedeem] = useState(false);

  useEffect(() => {
    fetch("/api/usage")
      .then(r => r.json())
      .then((d: UsageData) => setUsage(d))
      .catch(() => undefined);
  }, []);

  const handleUpgrade = async (planId: "PRO" | "TEAM") => {
    setLoadingCheckout(true);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: planId }),
      });
      const data = await res.json() as { url?: string; error?: { message: string } };
      if (!res.ok || !data.url) { toast.error(data.error?.message ?? "Failed to open checkout."); return; }
      window.location.href = data.url;
    } catch { toast.error("Network error."); }
    finally { setLoadingCheckout(false); }
  };

  const handleBillingPortal = async () => {
    setLoadingPortal(true);
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      const data = await res.json() as { url?: string; error?: { message: string } };
      if (!res.ok || !data.url) { toast.error(data.error?.message ?? "Failed to open billing portal."); return; }
      window.location.href = data.url;
    } catch { toast.error("Network error."); }
    finally { setLoadingPortal(false); }
  };

  const handleRedeem = async () => {
    if (!redeemCode.trim()) { toast.error("Enter a code first."); return; }
    setLoadingRedeem(true);
    try {
      const res = await fetch("/api/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: redeemCode.trim() }),
      });
      const data = await res.json() as { success?: boolean; plan?: string; error?: { message: string } };
      if (!res.ok || !data.success) { toast.error(data.error?.message ?? "Invalid code."); return; }
      toast.success(`🎉 Code redeemed! You're now on the ${data.plan} plan.`);
      setRedeemCode("");
      // Refresh usage data
      fetch("/api/usage").then(r => r.json()).then((d: UsageData) => setUsage(d)).catch(() => undefined);
    } catch { toast.error("Network error."); }
    finally { setLoadingRedeem(false); }
  };

  const isFree    = !usage || usage.plan === "FREE";
  const isPro     = usage?.plan === "PRO";
  const isTeam    = usage?.plan === "TEAM";
  const isPastDue = usage?.subscriptionStatus === "past_due";

  return (
    <div style={{ maxWidth: "600px", margin: "0 auto", padding: "32px 24px", fontFamily: THEME.fontSans }}>

      {/* Header */}
      <div style={{ marginBottom: "24px" }}>
        <h1 style={{ fontSize: "20px", fontWeight: 700, color: THEME.text, letterSpacing: "-0.02em", fontFamily: THEME.fontHeading }}>Settings</h1>
        <p style={{ fontSize: "13px", color: THEME.textDim, marginTop: "4px" }}>
          Manage your plan, usage, and account.
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>

        {/* Payment failed banner — shows when Stripe marks subscription past_due */}
        {isPastDue && (
          <div role="alert" style={{
            padding: "14px 16px", borderRadius: THEME.radius,
            background: THEME.aiDim, border: `1px solid ${THEME.ai}55`,
            display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px",
          }}>
            <div>
              <p style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", fontWeight: 700, color: THEME.ai, marginBottom: "3px" }}>
                <AlertTriangle size={14} aria-hidden="true" /> Payment failed
              </p>
              <p style={{ fontSize: "12px", color: THEME.textDim }}>
                Your last payment couldn&apos;t be processed. Update your payment method to keep your plan.
              </p>
            </div>
            <button
              onClick={() => void handleBillingPortal()}
              disabled={loadingPortal}
              style={{
                display: "inline-flex", alignItems: "center", gap: "5px",
                padding: "9px 16px", flexShrink: 0,
                background: THEME.ai, border: "none", borderRadius: "10px",
                fontSize: "12px", fontWeight: 700, color: "#fff",
                cursor: loadingPortal ? "not-allowed" : "pointer",
                whiteSpace: "nowrap",
              }}
            >
              Fix now <ArrowRight size={13} aria-hidden="true" />
            </button>
          </div>
        )}

        {/* Plan & Usage */}
        <Section title="Current Plan">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
            <span style={{ fontSize: "14px", color: THEME.textDim }}>Your plan</span>
            <span style={{
              display: "inline-flex", alignItems: "center", gap: "5px",
              fontSize: "12px", fontWeight: 700, padding: "4px 12px", borderRadius: "100px",
              textTransform: "capitalize",
              background: isFree ? THEME.surface3 : THEME.brandDim,
              color: isFree ? THEME.textDim : THEME.brandHi,
              border: isFree ? `1px solid ${THEME.border}` : `1px solid ${THEME.brand}55`,
            }}>
              {!isFree && <Sparkles size={12} aria-hidden="true" />}
              {(usage?.plan ?? "FREE").toLowerCase()}
            </span>
          </div>

          {usage ? (
            <>
              <UsageBar
                label="Words used this period"
                used={usage.wordsUsed}
                limit={usage.wordsLimit}
                warning
              />
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "12px" }}>
                <span style={{ fontSize: "12px", color: THEME.textDim }}>Rewrites used</span>
                <span className="tnum" style={{ fontSize: "12px", color: THEME.text }}>
                  {usage.rewriteCount} / {usage.rewriteLimit === -1 ? "∞" : usage.rewriteLimit}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                <span style={{ fontSize: "12px", color: THEME.textDim }}>Quota resets</span>
                <span style={{ fontSize: "12px", fontWeight: 500, color: THEME.text }}>
                  {formatDate(usage.quotaResetAt)}
                </span>
              </div>
              {usage.stripeCurrentPeriodEnd && (
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: "12px", color: THEME.textDim }}>Renews on</span>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", fontSize: "12px", fontWeight: 500, color: isPastDue ? THEME.ai : THEME.text }}>
                    {formatDate(usage.stripeCurrentPeriodEnd)}
                    {isPastDue && <AlertTriangle size={12} aria-hidden="true" />}
                  </span>
                </div>
              )}
            </>
          ) : (
            <div style={{ height: "80px", background: THEME.surface3, borderRadius: "6px", animation: "pulse 2s infinite" }} />
          )}
        </Section>

        {/* Upgrade card — FREE only */}
        {isFree && (
          <div style={{
            background: THEME.surface2,
            border: `1px solid ${THEME.border}`,
            borderRadius: THEME.radius, padding: "24px",
            boxShadow: glow(THEME.brand, 0.16),
          }}>
            <div style={{ display: "flex", gap: "14px", flexWrap: "wrap" }}>
              <div style={{
                width: "40px", height: "40px", borderRadius: "12px",
                background: THEME.gradient, display: "flex",
                alignItems: "center", justifyContent: "center", flexShrink: 0,
                boxShadow: glow(THEME.brand, 0.3),
              }}>
                <Zap size={18} color="#ffffff" aria-hidden="true" />
              </div>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
                  <h3 style={{ fontSize: "15px", fontWeight: 700, color: THEME.text, fontFamily: THEME.fontHeading }}>
                    Upgrade to Pro
                  </h3>
                  <span style={{
                    fontSize: "11px", fontWeight: 700, color: THEME.accentHi,
                    background: THEME.accentDim, padding: "2px 8px", borderRadius: "100px",
                  }}>
                    $9 / month
                  </span>
                </div>
                <ul style={{ listStyle: "none", padding: 0, margin: "0 0 20px", display: "flex", flexDirection: "column", gap: "8px" }}>
                  {["50,000 words / month", "Unlimited rewrites", "All 4 tone modes", "30-day document history", "No watermark"].map(f => (
                    <li key={f} style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: THEME.textDim }}>
                      <Check size={14} color={THEME.human} strokeWidth={2.5} aria-hidden="true" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="upgrade-btns" style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <button
                onClick={() => void handleUpgrade("PRO")}
                disabled={loadingCheckout}
                style={{
                  flex: 1, padding: "12px",
                  border: "none", borderRadius: "10px",
                  fontSize: "13px", fontWeight: 700, color: "#ffffff",
                  background: THEME.brand,
                  boxShadow: glow(THEME.brand, 0.3),
                  cursor: loadingCheckout ? "not-allowed" : "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
                }}
              >
                <Zap size={14} aria-hidden="true" />
                Upgrade to Pro
              </button>
              <button
                onClick={() => void handleUpgrade("TEAM")}
                disabled={loadingCheckout}
                style={{
                  padding: "12px 18px",
                  background: THEME.accentDim, border: `1px solid ${THEME.accent}55`,
                  borderRadius: "10px", fontSize: "12px", fontWeight: 700, color: THEME.accentHi,
                  cursor: loadingCheckout ? "not-allowed" : "pointer",
                  flexShrink: 0,
                }}
              >
                Team · $29/mo
              </button>
            </div>
          </div>
        )}

        {/* Billing — paid users */}
        {!isFree && (
          <Section title="Billing">
            <button
              onClick={() => void handleBillingPortal()}
              disabled={loadingPortal}
              style={{
                display: "flex", alignItems: "center", gap: "7px",
                background: THEME.surface1, border: `1px solid ${THEME.border}`,
                color: THEME.text, fontSize: "13px", fontWeight: 600,
                padding: "9px 16px", borderRadius: "10px", cursor: loadingPortal ? "not-allowed" : "pointer",
              }}
            >
              <ExternalLink size={14} color={THEME.brand} aria-hidden="true" />
              Manage billing
            </button>
          </Section>
        )}

        {/* Organization — Team plan */}
        {isTeam && (
          <Link href="/dashboard/organization" style={{ textDecoration: "none" }}>
            <div style={{
              background: THEME.surface2, border: `1px solid ${THEME.border}`, borderRadius: THEME.radius,
              padding: "16px 20px", display: "flex", alignItems: "center", gap: "12px",
              boxShadow: glow(THEME.brand, 0.1),
            }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: THEME.brandDim, display: "grid", placeItems: "center", flexShrink: 0 }}>
                <Building2 size={17} color={THEME.brand} aria-hidden="true" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: "14px", fontWeight: 700, color: THEME.text, fontFamily: THEME.fontHeading }}>Organization &amp; seats</div>
                <div style={{ fontSize: "12px", color: THEME.textDim }}>Create a team workspace and invite members per seat.</div>
              </div>
              <ArrowRight size={16} color={THEME.brandHi} aria-hidden="true" />
            </div>
          </Link>
        )}

        {/* Redeem Discount Code */}
        <div style={{
          background: THEME.surface2, border: `1px solid ${THEME.border}`,
          borderRadius: THEME.radius, overflow: "hidden",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "16px 20px", borderBottom: `1px solid ${THEME.border}` }}>
            <Gift size={15} color={THEME.accent} aria-hidden="true" />
            <h2 style={{ fontSize: "14px", fontWeight: 700, color: THEME.text, fontFamily: THEME.fontHeading, letterSpacing: "-0.01em" }}>Have a discount code?</h2>
          </div>
          <div style={{ padding: "20px" }}>
            <p style={{ fontSize: "12px", color: THEME.textDim, marginBottom: "14px" }}>
              Redeem a code to unlock a Pro or Team plan instantly.
            </p>
            <div className="redeem-row" style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <input
                type="text"
                aria-label="Discount code"
                placeholder="HUMAN-PRO-XXXXX"
                value={redeemCode}
                onChange={(e) => setRedeemCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => { if (e.key === "Enter") void handleRedeem(); }}
                style={{
                  flex: "1 1 200px", padding: "10px 14px",
                  background: THEME.surface1,
                  border: `1px solid ${THEME.border}`,
                  borderRadius: "10px", color: THEME.text,
                  fontSize: "13px", fontFamily: THEME.fontMono,
                  outline: "none",
                  letterSpacing: "0.04em",
                  minWidth: "0",
                }}
              />
              <button
                onClick={() => void handleRedeem()}
                disabled={loadingRedeem || !redeemCode.trim()}
                style={{
                  padding: "10px 20px",
                  background: loadingRedeem || !redeemCode.trim() ? `${THEME.brand}55` : THEME.brand,
                  border: "none", borderRadius: "10px",
                  fontSize: "13px", fontWeight: 700, color: "#fff",
                  cursor: loadingRedeem || !redeemCode.trim() ? "not-allowed" : "pointer",
                  transition: "background 0.15s",
                  whiteSpace: "nowrap",
                }}
              >
                {loadingRedeem ? "…" : "Redeem"}
              </button>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div style={{ height: "1px", background: THEME.border }} />

        {/* Profile */}
        <Section title="Profile">
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
            <div>
              <p style={{ fontSize: "14px", fontWeight: 500, color: THEME.text, marginBottom: "3px" }}>
                {user?.fullName ?? "—"}
              </p>
              <p style={{ fontSize: "13px", color: THEME.textDim }}>
                {user?.primaryEmailAddress?.emailAddress ?? "—"}
              </p>
            </div>
            <span style={{ fontSize: "11px", color: THEME.textMuted }}>
              To update your profile, click your avatar in the sidebar.
            </span>
          </div>
        </Section>

        {/* Plan features reference */}
        {(isPro || isTeam) && (
          <div style={{
            display: "flex", alignItems: "center", gap: "8px",
            padding: "14px 16px", borderRadius: "10px",
            background: THEME.brandDim, border: `1px solid ${THEME.brand}33`,
          }}>
            <Sparkles size={14} color={THEME.brandHi} aria-hidden="true" />
            <p style={{ fontSize: "12px", color: THEME.brandHi, fontWeight: 600 }}>
              {isTeam
                ? "Team plan active — you have access to all features + team collaboration"
                : "Pro plan active — you have access to all features"}
            </p>
          </div>
        )}
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 0.7; }
        }
      `}</style>
    </div>
  );
}
