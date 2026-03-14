"use client";

import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { ExternalLink, Zap } from "lucide-react";
import { toast } from "sonner";

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
      background: "#ffffff", border: "1px solid #e5e7eb",
      borderRadius: "8px", overflow: "hidden",
    }}>
      <div style={{ padding: "16px 20px", borderBottom: "1px solid #e5e7eb" }}>
        <h2 style={{ fontSize: "13px", fontWeight: 600, color: "#111827" }}>{title}</h2>
      </div>
      <div style={{ padding: "20px" }}>
        {children}
      </div>
    </div>
  );
}

function UsageBar({ label, used, limit, warning }: { label: string; used: number; limit: number; warning?: boolean }) {
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const barColor = warning && pct > 80 ? "#dc2626" : "#7e22ce";

  return (
    <div style={{ marginBottom: "16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
        <span style={{ fontSize: "12px", color: "#374151" }}>{label}</span>
        <span style={{ fontSize: "12px", color: "#4b5563", fontFamily: "var(--font-geist-mono), monospace" }}>
          {used.toLocaleString()} / {limit === -1 ? "∞" : limit.toLocaleString()}
        </span>
      </div>
      <div style={{ height: "3px", background: "#e5e7eb", borderRadius: "3px" }}>
        <div style={{
          height: "3px", borderRadius: "3px",
          width: `${pct}%`,
          background: barColor,
          boxShadow: `0 0 6px ${barColor}60`,
          transition: "width 0.5s ease",
        }} />
      </div>
      {warning && pct > 80 && (
        <p style={{ fontSize: "11px", color: "#7e22ce", marginTop: "5px" }}>⚠ {pct}% used — consider upgrading</p>
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
    <div style={{ maxWidth: "600px", margin: "0 auto", padding: "32px 24px", fontFamily: "var(--font-geist-sans), Inter, sans-serif" }}>

      {/* Header */}
      <div style={{ marginBottom: "24px" }}>
        <h1 style={{ fontSize: "20px", fontWeight: 700, color: "#111827", letterSpacing: "-0.5px" }}>Settings</h1>
        <p style={{ fontSize: "13px", color: "#4b5563", marginTop: "4px" }}>
          Manage your plan, usage, and account.
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>

        {/* Payment failed banner — shows when Stripe marks subscription past_due */}
        {isPastDue && (
          <div style={{
            padding: "14px 16px", borderRadius: "8px",
            background: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.3)",
            display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px",
          }}>
            <div>
              <p style={{ fontSize: "13px", fontWeight: 700, color: "#dc2626", marginBottom: "3px" }}>
                ⚠ Payment failed
              </p>
              <p style={{ fontSize: "12px", color: "#374151" }}>
                Your last payment couldn&apos;t be processed. Update your payment method to keep your plan.
              </p>
            </div>
            <button
              onClick={() => void handleBillingPortal()}
              disabled={loadingPortal}
              style={{
                padding: "8px 14px", flexShrink: 0,
                background: "#dc2626", border: "none", borderRadius: "6px",
                fontSize: "12px", fontWeight: 700, color: "#fff",
                cursor: loadingPortal ? "not-allowed" : "pointer",
                whiteSpace: "nowrap",
              }}
            >
              Fix now →
            </button>
          </div>
        )}

        {/* Plan & Usage */}
        <Section title="Current Plan">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
            <span style={{ fontSize: "14px", color: "#4b5563" }}>Your plan</span>
            <span style={{
              fontSize: "11px", fontWeight: 700, padding: "3px 10px", borderRadius: "100px",
              letterSpacing: "0.5px",
              background: isFree ? "#f3f4f6" : "linear-gradient(135deg, #f3e8ff, #faf5ff)",
              color: isFree ? "#374151" : "#7e22ce",
              border: isFree ? "1px solid #e5e7eb" : "1px solid rgba(126,34,206,0.3)",
            }}>
              {usage?.plan ?? "FREE"}
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
                <span style={{ fontSize: "12px", color: "#374151" }}>Rewrites used</span>
                <span style={{ fontSize: "12px", color: "#4b5563", fontFamily: "var(--font-geist-mono), monospace" }}>
                  {usage.rewriteCount} / {usage.rewriteLimit === -1 ? "∞" : usage.rewriteLimit}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                <span style={{ fontSize: "12px", color: "#374151" }}>Quota resets</span>
                <span style={{ fontSize: "12px", color: "#4b5563" }}>
                  {formatDate(usage.quotaResetAt)}
                </span>
              </div>
              {usage.stripeCurrentPeriodEnd && (
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: "12px", color: "#374151" }}>Renews on</span>
                  <span style={{ fontSize: "12px", color: isPastDue ? "#dc2626" : "#4b5563" }}>
                    {formatDate(usage.stripeCurrentPeriodEnd)}
                    {isPastDue && " ⚠"}
                  </span>
                </div>
              )}
            </>
          ) : (
            <div style={{ height: "80px", background: "#f3f4f6", borderRadius: "6px", animation: "pulse 2s infinite" }} />
          )}
        </Section>

        {/* Upgrade card — FREE only */}
        {isFree && (
          <div style={{
            background: "#faf5ff",
            border: "1px solid rgba(126,34,206,0.25)",
            borderRadius: "8px", padding: "24px",
            boxShadow: "0 0 40px rgba(126,34,206,0.04)",
          }}>
            <div style={{ display: "flex", gap: "14px", flexWrap: "wrap" }}>
              <div style={{
                width: "40px", height: "40px", borderRadius: "50%",
                background: "#f3e8ff", display: "flex",
                alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}>
                <Zap size={18} style={{ color: "#7e22ce" }} />
              </div>
              <div>
                <h3 style={{ fontSize: "14px", fontWeight: 700, color: "#111827", marginBottom: "8px" }}>
                  Upgrade to Pro — $9 / month
                </h3>
                <ul style={{ listStyle: "none", padding: 0, margin: "0 0 20px", display: "flex", flexDirection: "column", gap: "7px" }}>
                  {["50,000 words / month", "Unlimited rewrites", "All 4 tone modes", "30-day document history", "No watermark"].map(f => (
                    <li key={f} style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: "#4b5563" }}>
                      <span style={{ color: "#7e22ce", fontWeight: 700 }}>✓</span>
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
                className="shimmer"
                style={{
                  flex: 1, padding: "11px",
                  border: "none", borderRadius: "6px",
                  fontSize: "13px", fontWeight: 700, color: "#ffffff",
                  background: "#7e22ce",
                  cursor: loadingCheckout ? "not-allowed" : "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
                }}
              >
                <Zap size={14} />
                Upgrade to Pro →
              </button>
              <button
                onClick={() => void handleUpgrade("TEAM")}
                disabled={loadingCheckout}
                style={{
                  padding: "11px 16px",
                  background: "transparent", border: "1px solid #e5e7eb",
                  borderRadius: "6px", fontSize: "12px", fontWeight: 500, color: "#374151",
                  cursor: loadingCheckout ? "not-allowed" : "pointer",
                  flexShrink: 0,
                }}
              >
                Team $29/mo
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
                display: "flex", alignItems: "center", gap: "6px",
                background: "transparent", border: "1px solid #e5e7eb",
                color: "#4b5563", fontSize: "12px", fontWeight: 500,
                padding: "8px 14px", borderRadius: "5px", cursor: loadingPortal ? "not-allowed" : "pointer",
              }}
            >
              <ExternalLink size={13} />
              Manage Billing →
            </button>
          </Section>
        )}

        {/* Redeem Discount Code */}
        <div style={{
          background: "#ffffff", border: "1px solid #e5e7eb",
          borderRadius: "8px", overflow: "hidden",
        }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid #e5e7eb" }}>
            <h2 style={{ fontSize: "13px", fontWeight: 600, color: "#111827" }}>Have a discount code?</h2>
          </div>
          <div style={{ padding: "20px" }}>
            <p style={{ fontSize: "12px", color: "#4b5563", marginBottom: "14px" }}>
              Redeem a code to unlock a Pro or Team plan instantly.
            </p>
            <div className="redeem-row" style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <input
                type="text"
                placeholder="HUMAN-PRO-XXXXX"
                value={redeemCode}
                onChange={(e) => setRedeemCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => { if (e.key === "Enter") void handleRedeem(); }}
                style={{
                  flex: "1 1 200px", padding: "9px 12px",
                  background: "#f9fafb",
                  border: "1px solid #e5e7eb",
                  borderRadius: "6px", color: "#111827",
                  fontSize: "13px", fontFamily: "var(--font-geist-mono), monospace",
                  outline: "none",
                  letterSpacing: "0.5px",
                  minWidth: "0",
                }}
              />
              <button
                onClick={() => void handleRedeem()}
                disabled={loadingRedeem || !redeemCode.trim()}
                style={{
                  padding: "9px 18px",
                  background: loadingRedeem || !redeemCode.trim() ? "rgba(126,34,206,0.3)" : "#7e22ce",
                  border: "none", borderRadius: "6px",
                  fontSize: "13px", fontWeight: 700, color: "#fff",
                  cursor: loadingRedeem || !redeemCode.trim() ? "not-allowed" : "pointer",
                  transition: "background 0.15s",
                  whiteSpace: "nowrap",
                }}
              >
                {loadingRedeem ? "..." : "Redeem"}
              </button>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div style={{ height: "1px", background: "#e5e7eb" }} />

        {/* Profile */}
        <Section title="Profile">
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
            <div>
              <p style={{ fontSize: "14px", fontWeight: 500, color: "#111827", marginBottom: "3px" }}>
                {user?.fullName ?? "—"}
              </p>
              <p style={{ fontSize: "12px", color: "#4b5563" }}>
                {user?.primaryEmailAddress?.emailAddress ?? "—"}
              </p>
            </div>
            <span style={{ fontSize: "11px", color: "#4b5563" }}>
              To update your profile, click your avatar in the sidebar.
            </span>
          </div>
        </Section>

        {/* Plan features reference */}
        {(isPro || isTeam) && (
          <div style={{
            padding: "14px 16px", borderRadius: "6px",
            background: "#faf5ff", border: "1px solid rgba(126,34,206,0.15)",
          }}>
            <p style={{ fontSize: "12px", color: "#7e22ce", fontWeight: 600 }}>
              {isTeam
                ? "✦ Team plan active — you have access to all features + team collaboration"
                : "✦ Pro plan active — you have access to all features"}
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
