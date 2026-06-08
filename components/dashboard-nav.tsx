"use client";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { UserButton, useUser } from "@clerk/nextjs";
import { PenLine, History, Settings, Zap, Crown, Sparkles, LayoutDashboard, Code2 } from "lucide-react";
import { useEffect, useState } from "react";
import { THEME } from "@/lib/theme";

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
      background: THEME.brandDim,
      border: `1px solid ${THEME.brand}55`,
      borderRadius: "100px", padding: "4px 10px",
    }}>
      <Crown size={10} color={THEME.brandHi} aria-hidden="true" />
      <span className="mono" style={{ fontSize: "10px", fontWeight: 700, color: THEME.brandHi, letterSpacing: "0.08em" }}>TEAM</span>
    </div>
  );

  if (isPro) return (
    <div style={{
      display: "flex", alignItems: "center", gap: "5px",
      background: THEME.brandDim,
      border: `1px solid ${THEME.brand}55`,
      borderRadius: "100px", padding: "4px 10px",
    }}>
      <Sparkles size={10} color={THEME.brandHi} aria-hidden="true" />
      <span className="mono" style={{ fontSize: "10px", fontWeight: 700, color: THEME.brandHi, letterSpacing: "0.08em" }}>PRO</span>
    </div>
  );

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: "5px",
      background: THEME.surface3,
      border: `1px solid ${THEME.border}`,
      borderRadius: "100px", padding: "4px 10px",
    }}>
      <Zap size={10} color={THEME.textMuted} aria-hidden="true" />
      <span className="mono" style={{ fontSize: "10px", fontWeight: 600, color: THEME.textDim, letterSpacing: "0.08em" }}>FREE</span>
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
    <div style={{ display: "flex", height: "100dvh", overflow: "hidden", background: THEME.bg }}>

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex" style={{
        width: "240px", flexShrink: 0, flexDirection: "column",
        background: THEME.surface1,
        borderRight: `1px solid ${THEME.border}`,
        position: "relative",
      }}>
        {/* Logo */}
        <Link href="/" style={{
          display: "flex", alignItems: "center", gap: "10px",
          padding: "22px 18px 18px", textDecoration: "none",
          borderBottom: `1px solid ${THEME.border}`,
        }}>
          <div style={{
            width: "30px", height: "30px", borderRadius: "10px",
            background: `linear-gradient(135deg, ${THEME.brand} 0%, ${THEME.brandHi} 100%)`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "14px", fontWeight: 800, color: "#ffffff",
            boxShadow: `0 0 18px ${THEME.brand}55`,
          }} aria-hidden="true">H</div>
          <div>
            <div style={{ fontSize: "14px", fontWeight: 700, lineHeight: 1.2, fontFamily: THEME.fontHeading }}>
              <span style={{ color: THEME.text }}>Humanize</span><span style={{ color: THEME.brandHi }}>It</span>
            </div>
            <div className="mono" style={{ fontSize: "10px", color: THEME.textMuted, marginTop: "1px", letterSpacing: "0.04em" }}>Writing assistant</div>
          </div>
        </Link>

        {/* Nav */}
        <nav style={{ flex: 1, padding: "16px 10px", display: "flex", flexDirection: "column", gap: "2px" }}>
          <div className="kicker" style={{ padding: "0 10px 8px" }}>
            Workspace
          </div>
          {NAV_ITEMS.map(({ href, label, icon: Icon, desc, exact }) => {
            const active = isActive(href, exact);
            return (
              <Link key={href} href={href}
                aria-current={active ? "page" : undefined}
                style={{
                  display: "flex", alignItems: "center", gap: "12px",
                  padding: "8px 12px", borderRadius: "8px", textDecoration: "none",
                  background: active ? THEME.brandDim : "transparent",
                  color: active ? THEME.brandHi : THEME.textDim,
                  fontFamily: THEME.fontMono, fontSize: "13px", fontWeight: active ? 500 : 400,
                  transition: "all 0.15s",
                  border: active ? `1px solid ${THEME.brand}44` : "1px solid transparent",
                  position: "relative",
                }}
                onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = THEME.surface3; }}
                onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
              >
                {active && (
                  <div style={{
                    position: "absolute", left: 0, top: "50%", transform: "translateY(-50%)",
                    width: "3px", height: "20px", borderRadius: "2px",
                    background: THEME.brand,
                  }} aria-hidden="true" />
                )}
                <Icon size={15} color={active ? THEME.brandHi : THEME.textMuted} aria-hidden="true" />
                <div>
                  <div style={{ fontSize: "13px", lineHeight: 1.2 }}>{label}</div>
                  {active && <div className="mono" style={{ fontSize: "10px", color: THEME.brandHi, marginTop: "1px", opacity: 0.75, letterSpacing: "0.04em" }}>{desc}</div>}
                </div>
              </Link>
            );
          })}
        </nav>

        {/* Bottom user section */}
        <div style={{ padding: "12px", borderTop: `1px solid ${THEME.border}` }}>
          {/* Upgrade CTA — only when plan is loaded and FREE */}
          {plan === "FREE" && (
            <button
              onClick={() => void handleUpgrade()}
              disabled={checkoutLoading}
              style={{
                width: "100%",
                background: THEME.brandDim,
                border: `1px solid ${THEME.brand}44`,
                borderRadius: "12px", padding: "10px 12px",
                cursor: checkoutLoading ? "not-allowed" : "pointer",
                marginBottom: "10px", textAlign: "left",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
                <Zap size={11} color={THEME.brandHi} aria-hidden="true" />
                <span style={{ fontSize: "11px", fontWeight: 700, color: THEME.brandHi, fontFamily: THEME.fontHeading }}>
                  {checkoutLoading ? "Loading..." : "Upgrade to Pro"}
                </span>
              </div>
              <div style={{ fontSize: "10px", color: THEME.textDim, lineHeight: 1.4 }}>
                50k words/month + unlimited rewrites
              </div>
            </button>
          )}

          <div style={{
            display: "flex", alignItems: "center", gap: "10px",
            padding: "8px 10px", borderRadius: "12px",
            background: THEME.surface2,
            border: `1px solid ${THEME.border}`,
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
              <div style={{ fontSize: "12px", fontWeight: 600, color: THEME.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {user?.firstName || user?.emailAddresses?.[0]?.emailAddress?.split("@")[0] || "User"}
              </div>
              <div className="mono" style={{ fontSize: "10px", color: THEME.textMuted, marginTop: "1px", letterSpacing: "0.04em" }}>
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
        background: `${THEME.surface1}f2`,
        backdropFilter: "blur(12px)",
        borderTop: `1px solid ${THEME.border}`,
        alignItems: "center", justifyContent: "space-around",
      }}>
        {NAV_ITEMS.map(({ href, label, icon: Icon, exact }) => {
          const active = isActive(href, exact);
          return (
            <Link key={href} href={href}
              aria-current={active ? "page" : undefined}
              style={{
                display: "flex", flexDirection: "column", alignItems: "center",
                gap: "4px", textDecoration: "none", flex: 1, padding: "8px 0",
                color: active ? THEME.brandHi : THEME.textMuted,
              }}>
              <Icon size={20} strokeWidth={active ? 2 : 1.5} aria-hidden="true" />
              <span className="mono" style={{ fontSize: "10px", fontWeight: active ? 600 : 400, letterSpacing: "0.04em" }}>{label}</span>
            </Link>
          );
        })}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", flex: 1, padding: "8px 0" }}>
          <UserButton afterSignOutUrl="/" />
          <span className="mono" style={{ fontSize: "10px", color: THEME.textMuted, letterSpacing: "0.04em" }}>Account</span>
        </div>
      </nav>
    </div>
  );
}
