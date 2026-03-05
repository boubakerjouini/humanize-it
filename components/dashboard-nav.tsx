"use client";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { UserButton, useUser } from "@clerk/nextjs";
import { PenLine, History, Settings, Zap, Crown, Sparkles, LayoutDashboard } from "lucide-react";
import { useEffect, useState } from "react";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard, desc: "Overview", exact: true },
  { href: "/dashboard/editor", label: "Editor", icon: PenLine, desc: "Analyze & humanize" },
  { href: "/dashboard/history", label: "History", icon: History, desc: "Past documents" },
  { href: "/dashboard/settings", label: "Settings", icon: Settings, desc: "Account & usage" },
];

function PlanBadge({ plan }: { plan: string }) {
  const isPro = plan === "PRO";
  const isTeam = plan === "TEAM";

  if (isTeam) return (
    <div style={{
      display: "flex", alignItems: "center", gap: "5px",
      background: "linear-gradient(135deg, rgba(139,92,246,0.2), rgba(167,139,250,0.15))",
      border: "1px solid rgba(139,92,246,0.4)",
      borderRadius: "6px", padding: "4px 10px",
    }}>
      <Crown size={10} color="#a78bfa" />
      <span style={{ fontSize: "10px", fontWeight: 700, color: "#a78bfa", letterSpacing: "0.5px" }}>TEAM</span>
    </div>
  );

  if (isPro) return (
    <div style={{
      display: "flex", alignItems: "center", gap: "5px",
      background: "linear-gradient(135deg, rgba(139,92,246,0.18), rgba(124,58,237,0.12))",
      border: "1px solid rgba(139,92,246,0.35)",
      borderRadius: "6px", padding: "4px 10px",
    }}>
      <Sparkles size={10} color="#8b5cf6" />
      <span style={{ fontSize: "10px", fontWeight: 700, color: "#8b5cf6", letterSpacing: "0.5px" }}>PRO</span>
    </div>
  );

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: "5px",
      background: "rgba(255,255,255,0.04)",
      border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: "6px", padding: "4px 10px",
    }}>
      <Zap size={10} color="#6b6b80" />
      <span style={{ fontSize: "10px", fontWeight: 600, color: "#6b6b80", letterSpacing: "0.5px" }}>FREE</span>
    </div>
  );
}

export function DashboardNav({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user } = useUser();
  const [plan, setPlan] = useState<string | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  useEffect(() => {
    fetch("/api/user-plan")
      .then(r => r.json())
      .then(d => setPlan(d.plan ?? "FREE"))
      .catch(() => setPlan("FREE"));
  }, []);

  const isActive = (href: string, exact?: boolean) => {
    if (exact) return pathname === href;
    return pathname.startsWith(href);
  };

  const handleUpgrade = async () => {
    setCheckoutLoading(true);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: "PRO" }),
      });
      const data = await res.json() as { url?: string };
      if (data.url) window.location.href = data.url;
    } catch { /* ignore */ }
    finally { setCheckoutLoading(false); }
  };

  return (
    <div style={{ display: "flex", height: "100dvh", overflow: "hidden", background: "#09090b" }}>

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex" style={{
        width: "240px", flexShrink: 0, flexDirection: "column",
        background: "linear-gradient(180deg, #060608 0%, #07070a 100%)",
        borderRight: "1px solid rgba(255,255,255,0.04)",
        position: "relative",
      }}>
        {/* Top glow line */}
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, height: "1px",
          background: "linear-gradient(90deg, transparent, rgba(139,92,246,0.4), transparent)",
        }} />

        {/* Logo */}
        <Link href="/" style={{
          display: "flex", alignItems: "center", gap: "10px",
          padding: "22px 18px 18px", textDecoration: "none",
          borderBottom: "1px solid rgba(255,255,255,0.04)",
        }}>
          <div style={{
            width: "30px", height: "30px", borderRadius: "8px",
            background: "linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "14px", fontWeight: 800, color: "#fafafa",
            boxShadow: "0 2px 12px rgba(139,92,246,0.4)",
          }}>H</div>
          <div>
            <div style={{ fontSize: "14px", fontWeight: 700, color: "#fafafa", lineHeight: 1.2 }}>HumanizeIt</div>
            <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.25)", marginTop: "1px" }}>Writing assistant</div>
          </div>
        </Link>

        {/* Nav */}
        <nav style={{ flex: 1, padding: "16px 10px", display: "flex", flexDirection: "column", gap: "2px" }}>
          <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.2)", letterSpacing: "0.8px", padding: "0 10px 8px", textTransform: "uppercase", fontWeight: 600 }}>
            Workspace
          </div>
          {NAV_ITEMS.map(({ href, label, icon: Icon, desc, exact }) => {
            const active = isActive(href, exact);
            return (
              <Link key={href} href={href} style={{
                display: "flex", alignItems: "center", gap: "12px",
                padding: "10px 12px", borderRadius: "8px", textDecoration: "none",
                background: active ? "rgba(139,92,246,0.12)" : "transparent",
                color: active ? "#c4b5fd" : "rgba(255,255,255,0.35)",
                fontSize: "13px", fontWeight: active ? 600 : 400,
                transition: "all 0.15s",
                border: active ? "1px solid rgba(139,92,246,0.15)" : "1px solid transparent",
                position: "relative",
              }}>
                {active && (
                  <div style={{
                    position: "absolute", left: 0, top: "50%", transform: "translateY(-50%)",
                    width: "3px", height: "20px", borderRadius: "2px",
                    background: "#8b5cf6",
                  }} />
                )}
                <Icon size={15} color={active ? "#8b5cf6" : undefined} />
                <div>
                  <div style={{ fontSize: "13px", lineHeight: 1.2 }}>{label}</div>
                  {active && <div style={{ fontSize: "10px", color: "rgba(139,92,246,0.7)", marginTop: "1px" }}>{desc}</div>}
                </div>
              </Link>
            );
          })}
        </nav>

        {/* Bottom user section */}
        <div style={{ padding: "12px", borderTop: "1px solid rgba(255,255,255,0.04)" }}>
          {/* Upgrade CTA — only when plan is loaded and FREE */}
          {plan === "FREE" && (
            <button
              onClick={() => void handleUpgrade()}
              disabled={checkoutLoading}
              style={{
                width: "100%",
                background: "linear-gradient(135deg, rgba(139,92,246,0.12), rgba(124,58,237,0.08))",
                border: "1px solid rgba(139,92,246,0.2)",
                borderRadius: "10px", padding: "10px 12px",
                cursor: checkoutLoading ? "not-allowed" : "pointer",
                marginBottom: "10px", textAlign: "left",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
                <Zap size={11} color="#8b5cf6" />
                <span style={{ fontSize: "11px", fontWeight: 700, color: "#8b5cf6" }}>
                  {checkoutLoading ? "Loading..." : "Upgrade to Pro"}
                </span>
              </div>
              <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)", lineHeight: 1.4 }}>
                50k words/month + unlimited rewrites
              </div>
            </button>
          )}

          <div style={{
            display: "flex", alignItems: "center", gap: "10px",
            padding: "8px 10px", borderRadius: "8px",
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.04)",
          }}>
            <UserButton
              afterSignOutUrl="/"
              appearance={{
                elements: {
                  avatarBox: { width: "28px", height: "28px", borderRadius: "8px" },
                  userButtonPopoverCard: { background: "#0e0e12", border: "1px solid rgba(139,92,246,0.2)" },
                },
              }}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: "12px", fontWeight: 600, color: "#fafafa", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {user?.firstName || user?.emailAddresses?.[0]?.emailAddress?.split("@")[0] || "User"}
              </div>
              <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.25)", marginTop: "1px" }}>
                {plan === null ? "..." : plan}
              </div>
            </div>
            {plan !== null && <PlanBadge plan={plan} />}
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <main style={{ flex: 1, overflow: "auto", paddingBottom: "60px" }} className="md:pb-0">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Tabs */}
      <nav className="flex md:hidden" style={{
        position: "fixed", bottom: 0, left: 0, right: 0,
        height: "64px", zIndex: 50,
        background: "rgba(6,6,8,0.95)",
        backdropFilter: "blur(12px)",
        borderTop: "1px solid rgba(255,255,255,0.06)",
        alignItems: "center", justifyContent: "space-around",
      }}>
        {NAV_ITEMS.map(({ href, label, icon: Icon, exact }) => {
          const active = isActive(href, exact);
          return (
            <Link key={href} href={href} style={{
              display: "flex", flexDirection: "column", alignItems: "center",
              gap: "4px", textDecoration: "none", flex: 1, padding: "8px 0",
              color: active ? "#8b5cf6" : "rgba(255,255,255,0.25)",
            }}>
              <Icon size={20} strokeWidth={active ? 2 : 1.5} />
              <span style={{ fontSize: "10px", fontWeight: active ? 600 : 400 }}>{label}</span>
            </Link>
          );
        })}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", flex: 1, padding: "8px 0" }}>
          <UserButton afterSignOutUrl="/" />
          <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.25)" }}>Account</span>
        </div>
      </nav>
    </div>
  );
}
