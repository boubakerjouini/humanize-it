"use client";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { UserButton, useUser } from "@clerk/nextjs";
import { PenLine, History, Settings, Zap, Crown, Sparkles, LayoutDashboard, Code2 } from "lucide-react";
import { useEffect, useState } from "react";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard, desc: "Overview", exact: true },
  { href: "/dashboard/editor", label: "Editor", icon: PenLine, desc: "Analyze & humanize" },
  { href: "/dashboard/history", label: "History", icon: History, desc: "Past documents" },
  { href: "/dashboard/api", label: "API", icon: Code2, desc: "Developer access" },
  { href: "/dashboard/settings", label: "Settings", icon: Settings, desc: "Account & usage" },
];

function PlanBadge({ plan }: { plan: string }) {
  const isPro = plan === "PRO";
  const isTeam = plan === "TEAM";

  if (isTeam) return (
    <div style={{
      display: "flex", alignItems: "center", gap: "5px",
      background: "#ede9fe",
      border: "1px solid #ede9fe",
      borderRadius: "100px", padding: "4px 10px",
    }}>
      <Crown size={10} color="#7c3aed" />
      <span style={{ fontSize: "10px", fontWeight: 700, color: "#7c3aed", letterSpacing: "0.5px" }}>TEAM</span>
    </div>
  );

  if (isPro) return (
    <div style={{
      display: "flex", alignItems: "center", gap: "5px",
      background: "#ede9fe",
      border: "1px solid #ede9fe",
      borderRadius: "100px", padding: "4px 10px",
    }}>
      <Sparkles size={10} color="#7c3aed" />
      <span style={{ fontSize: "10px", fontWeight: 700, color: "#7c3aed", letterSpacing: "0.5px" }}>PRO</span>
    </div>
  );

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: "5px",
      background: "#f5f5f5",
      border: "1px solid #e5e5e5",
      borderRadius: "100px", padding: "4px 10px",
    }}>
      <Zap size={10} color="#a3a3a3" />
      <span style={{ fontSize: "10px", fontWeight: 600, color: "#a3a3a3", letterSpacing: "0.5px" }}>FREE</span>
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
    <div style={{ display: "flex", height: "100dvh", overflow: "hidden", background: "#ffffff" }}>

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex" style={{
        width: "240px", flexShrink: 0, flexDirection: "column",
        background: "#ffffff",
        borderRight: "1px solid #f0f0f0",
        position: "relative",
      }}>
        {/* Logo */}
        <Link href="/" style={{
          display: "flex", alignItems: "center", gap: "10px",
          padding: "22px 18px 18px", textDecoration: "none",
          borderBottom: "1px solid #f0f0f0",
        }}>
          <div style={{
            width: "30px", height: "30px", borderRadius: "10px",
            background: "linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "14px", fontWeight: 800, color: "#ffffff",
          }}>H</div>
          <div>
            <div style={{ fontSize: "14px", fontWeight: 700, lineHeight: 1.2, fontFamily: "var(--font-heading)" }}>
              <span style={{ color: "#0a0a0a" }}>Humanize</span><span style={{ color: "#7c3aed" }}>It</span>
            </div>
            <div style={{ fontSize: "10px", color: "#a3a3a3", marginTop: "1px" }}>Writing assistant</div>
          </div>
        </Link>

        {/* Nav */}
        <nav style={{ flex: 1, padding: "16px 10px", display: "flex", flexDirection: "column", gap: "2px" }}>
          <div style={{ fontSize: "10px", color: "#a3a3a3", letterSpacing: "0.8px", padding: "0 10px 8px", textTransform: "uppercase", fontWeight: 600 }}>
            Workspace
          </div>
          {NAV_ITEMS.map(({ href, label, icon: Icon, desc, exact }) => {
            const active = isActive(href, exact);
            return (
              <Link key={href} href={href} style={{
                display: "flex", alignItems: "center", gap: "12px",
                padding: "8px 12px", borderRadius: "8px", textDecoration: "none",
                background: active ? "#faf5ff" : "transparent",
                color: active ? "#7c3aed" : "#525252",
                fontSize: "13px", fontWeight: active ? 500 : 400,
                transition: "all 0.15s",
                border: active ? "1px solid #f3e8ff" : "1px solid transparent",
                position: "relative",
              }}
              onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = "#fafafa"; }}
              onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
              >
                {active && (
                  <div style={{
                    position: "absolute", left: 0, top: "50%", transform: "translateY(-50%)",
                    width: "3px", height: "20px", borderRadius: "2px",
                    background: "#7c3aed",
                  }} />
                )}
                <Icon size={15} color={active ? "#7c3aed" : "#a3a3a3"} />
                <div>
                  <div style={{ fontSize: "13px", lineHeight: 1.2 }}>{label}</div>
                  {active && <div style={{ fontSize: "10px", color: "#7c3aed", marginTop: "1px", opacity: 0.7 }}>{desc}</div>}
                </div>
              </Link>
            );
          })}
        </nav>

        {/* Bottom user section */}
        <div style={{ padding: "12px", borderTop: "1px solid #f0f0f0" }}>
          {/* Upgrade CTA — only when plan is loaded and FREE */}
          {plan === "FREE" && (
            <button
              onClick={() => void handleUpgrade()}
              disabled={checkoutLoading}
              style={{
                width: "100%",
                background: "#faf5ff",
                border: "1px solid #ede9fe",
                borderRadius: "12px", padding: "10px 12px",
                cursor: checkoutLoading ? "not-allowed" : "pointer",
                marginBottom: "10px", textAlign: "left",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
                <Zap size={11} color="#7c3aed" />
                <span style={{ fontSize: "11px", fontWeight: 700, color: "#7c3aed" }}>
                  {checkoutLoading ? "Loading..." : "Upgrade to Pro"}
                </span>
              </div>
              <div style={{ fontSize: "10px", color: "#a3a3a3", lineHeight: 1.4 }}>
                50k words/month + unlimited rewrites
              </div>
            </button>
          )}

          <div style={{
            display: "flex", alignItems: "center", gap: "10px",
            padding: "8px 10px", borderRadius: "12px",
            background: "#fafafa",
            border: "1px solid #f0f0f0",
          }}>
            <UserButton
              afterSignOutUrl="/"
              appearance={{
                elements: {
                  avatarBox: { width: "28px", height: "28px", borderRadius: "8px" },
                },
              }}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: "12px", fontWeight: 600, color: "#0a0a0a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {user?.firstName || user?.emailAddresses?.[0]?.emailAddress?.split("@")[0] || "User"}
              </div>
              <div style={{ fontSize: "10px", color: "#a3a3a3", marginTop: "1px" }}>
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
        background: "rgba(255,255,255,0.95)",
        backdropFilter: "blur(12px)",
        borderTop: "1px solid #f0f0f0",
        alignItems: "center", justifyContent: "space-around",
      }}>
        {NAV_ITEMS.map(({ href, label, icon: Icon, exact }) => {
          const active = isActive(href, exact);
          return (
            <Link key={href} href={href} style={{
              display: "flex", flexDirection: "column", alignItems: "center",
              gap: "4px", textDecoration: "none", flex: 1, padding: "8px 0",
              color: active ? "#7c3aed" : "#a3a3a3",
            }}>
              <Icon size={20} strokeWidth={active ? 2 : 1.5} />
              <span style={{ fontSize: "10px", fontWeight: active ? 600 : 400 }}>{label}</span>
            </Link>
          );
        })}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", flex: 1, padding: "8px 0" }}>
          <UserButton afterSignOutUrl="/" />
          <span style={{ fontSize: "10px", color: "#a3a3a3" }}>Account</span>
        </div>
      </nav>
    </div>
  );
}
