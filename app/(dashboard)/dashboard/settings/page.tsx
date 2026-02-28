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
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: "#0f0f12", border: "1px solid rgba(255,255,255,0.07)",
      borderRadius: "8px", overflow: "hidden",
    }}>
      <div style={{ padding: "16px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <h2 style={{ fontSize: "13px", fontWeight: 600, color: "#fafafa" }}>{title}</h2>
      </div>
      <div style={{ padding: "20px" }}>
        {children}
      </div>
    </div>
  );
}

function UsageBar({ label, used, limit, warning }: { label: string; used: number; limit: number; warning?: boolean }) {
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const barColor = warning && pct > 80 ? "#ef4444" : "#8b5cf6";

  return (
    <div style={{ marginBottom: "16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
        <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.45)" }}>{label}</span>
        <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.6)", fontFamily: "var(--font-geist-mono), monospace" }}>
          {used.toLocaleString()} / {limit === -1 ? "∞" : limit.toLocaleString()}
        </span>
      </div>
      <div style={{ height: "3px", background: "rgba(255,255,255,0.06)", borderRadius: "3px" }}>
        <div style={{
          height: "3px", borderRadius: "3px",
          width: `${pct}%`,
          background: barColor,
          boxShadow: `0 0 6px ${barColor}60`,
          transition: "width 0.5s ease",
        }} />
      </div>
      {warning && pct > 80 && (
        <p style={{ fontSize: "11px", color: "#8b5cf6", marginTop: "5px" }}>⚠ {pct}% used — consider upgrading</p>
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

  const isFree = !usage || usage.plan === "FREE";
  const isPro  = usage?.plan === "PRO";

  return (
    <div style={{ maxWidth: "600px", margin: "0 auto", fontFamily: "var(--font-geist-sans), Inter, sans-serif" }}>

      {/* Header */}
      <div style={{ marginBottom: "24px" }}>
        <h1 style={{ fontSize: "20px", fontWeight: 700, color: "#fafafa", letterSpacing: "-0.5px" }}>Settings</h1>
        <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.35)", marginTop: "4px" }}>
          Manage your plan, usage, and account.
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>

        {/* Plan & Usage */}
        <Section title="Current Plan">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
            <span style={{ fontSize: "14px", color: "rgba(255,255,255,0.6)" }}>Your plan</span>
            <span style={{
              fontSize: "11px", fontWeight: 700, padding: "3px 10px", borderRadius: "100px",
              letterSpacing: "0.5px",
              background: isFree ? "rgba(255,255,255,0.08)" : "linear-gradient(135deg, rgba(139,92,246,0.2), rgba(167,139,250,0.2))",
              color: isFree ? "rgba(255,255,255,0.5)" : "#8b5cf6",
              border: isFree ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(139,92,246,0.3)",
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
                <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)" }}>Rewrites used</span>
                <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.6)", fontFamily: "var(--font-geist-mono), monospace" }}>
                  {usage.rewriteCount} / {usage.rewriteLimit === -1 ? "∞" : usage.rewriteLimit}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)" }}>Quota resets</span>
                <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.6)" }}>
                  {formatDate(usage.quotaResetAt)}
                </span>
              </div>
            </>
          ) : (
            <div style={{ height: "80px", background: "rgba(255,255,255,0.04)", borderRadius: "6px", animation: "pulse 2s infinite" }} />
          )}
        </Section>

        {/* Upgrade card — FREE only */}
        {isFree && (
          <div style={{
            background: "#130f0a",
            border: "1px solid rgba(139,92,246,0.25)",
            borderRadius: "8px", padding: "24px",
            boxShadow: "0 0 40px rgba(139,92,246,0.04)",
          }}>
            <div style={{ display: "flex", gap: "14px" }}>
              <div style={{
                width: "40px", height: "40px", borderRadius: "50%",
                background: "rgba(139,92,246,0.15)", display: "flex",
                alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}>
                <Zap size={18} style={{ color: "#8b5cf6" }} />
              </div>
              <div>
                <h3 style={{ fontSize: "14px", fontWeight: 700, color: "#fafafa", marginBottom: "8px" }}>
                  Upgrade to Pro — $9 / month
                </h3>
                <ul style={{ listStyle: "none", padding: 0, margin: "0 0 20px", display: "flex", flexDirection: "column", gap: "7px" }}>
                  {["50,000 words / month", "Unlimited rewrites", "All 4 tone modes", "30-day document history", "No watermark"].map(f => (
                    <li key={f} style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: "rgba(255,255,255,0.55)" }}>
                      <span style={{ color: "#8b5cf6", fontWeight: 700 }}>✓</span>
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div style={{ display: "flex", gap: "8px" }}>
              <button
                onClick={() => void handleUpgrade("PRO")}
                disabled={loadingCheckout}
                className="shimmer"
                style={{
                  flex: 1, padding: "11px",
                  border: "none", borderRadius: "6px",
                  fontSize: "13px", fontWeight: 700, color: "#09090b",
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
                  background: "transparent", border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: "6px", fontSize: "12px", fontWeight: 500, color: "rgba(255,255,255,0.5)",
                  cursor: loadingCheckout ? "not-allowed" : "pointer",
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
                background: "transparent", border: "1px solid rgba(255,255,255,0.12)",
                color: "rgba(255,255,255,0.55)", fontSize: "12px", fontWeight: 500,
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
          background: "#0f0f12", border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: "8px", overflow: "hidden",
        }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <h2 style={{ fontSize: "13px", fontWeight: 600, color: "#fafafa" }}>Have a discount code?</h2>
          </div>
          <div style={{ padding: "20px" }}>
            <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.35)", marginBottom: "14px" }}>
              Redeem a code to unlock a Pro or Team plan instantly.
            </p>
            <div style={{ display: "flex", gap: "8px" }}>
              <input
                type="text"
                placeholder="HUMAN-PRO-XXXXX"
                value={redeemCode}
                onChange={(e) => setRedeemCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => { if (e.key === "Enter") void handleRedeem(); }}
                style={{
                  flex: 1, padding: "9px 12px",
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: "6px", color: "#fafafa",
                  fontSize: "13px", fontFamily: "var(--font-geist-mono), monospace",
                  outline: "none",
                  letterSpacing: "0.5px",
                }}
              />
              <button
                onClick={() => void handleRedeem()}
                disabled={loadingRedeem || !redeemCode.trim()}
                style={{
                  padding: "9px 18px",
                  background: loadingRedeem || !redeemCode.trim() ? "rgba(139,92,246,0.3)" : "#8b5cf6",
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
        <div style={{ height: "1px", background: "rgba(255,255,255,0.06)" }} />

        {/* Profile */}
        <Section title="Profile">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <p style={{ fontSize: "14px", fontWeight: 500, color: "#fafafa", marginBottom: "3px" }}>
                {user?.fullName ?? "—"}
              </p>
              <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.35)" }}>
                {user?.primaryEmailAddress?.emailAddress ?? "—"}
              </p>
            </div>
            <button
              onClick={() => window.open("https://accounts.clerk.com", "_blank")}
              style={{
                display: "flex", alignItems: "center", gap: "6px",
                background: "transparent", border: "1px solid rgba(255,255,255,0.1)",
                color: "rgba(255,255,255,0.45)", fontSize: "12px", fontWeight: 500,
                padding: "7px 12px", borderRadius: "5px", cursor: "pointer",
              }}
            >
              <ExternalLink size={12} />
              Edit profile
            </button>
          </div>
        </Section>

        {/* Plan features reference */}
        {isPro && (
          <div style={{
            padding: "14px 16px", borderRadius: "6px",
            background: "rgba(139,92,246,0.06)", border: "1px solid rgba(139,92,246,0.15)",
          }}>
            <p style={{ fontSize: "12px", color: "#8b5cf6", fontWeight: 600 }}>
              ✦ Pro plan active — you have access to all features
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
