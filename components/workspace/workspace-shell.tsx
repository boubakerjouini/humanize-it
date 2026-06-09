"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { useEffect, useState } from "react";
import { Wand2, History, Settings, Building2, ShieldCheck, Crown, Sparkles, Zap, ArrowUpRight } from "lucide-react";
import { THEME, glow } from "@/lib/theme";

interface PlanInfo {
  plan: string;
  isAdmin: boolean;
  organization: { id: string; name: string; role: string } | null;
}
interface Usage {
  plan: string;
  wordsUsed: number;
  wordsLimit: number; // -1 = unlimited
  quotaResetAt: string | null;
}

const PLAN_META: Record<string, { label: string; icon: typeof Crown; }> = {
  TEAM: { label: "Team", icon: Crown },
  PRO: { label: "Pro", icon: Sparkles },
  FREE: { label: "Free", icon: Zap },
};

export function WorkspaceShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [info, setInfo] = useState<PlanInfo>({ plan: "FREE", isAdmin: false, organization: null });
  const [usage, setUsage] = useState<Usage | null>(null);
  const [upgrading, setUpgrading] = useState(false);

  useEffect(() => {
    fetch("/api/user-plan").then((r) => r.json()).then((d) => setInfo({ plan: d.plan ?? "FREE", isAdmin: !!d.isAdmin, organization: d.organization ?? null })).catch(() => {});
    fetch("/api/usage").then((r) => (r.ok ? r.json() : null)).then((d) => d && setUsage(d)).catch(() => {});
  }, []);

  const nav = [
    { href: "/dashboard", label: "Humanize", icon: Wand2, exact: true },
    { href: "/dashboard/history", label: "History", icon: History },
    { href: "/dashboard/settings", label: "Settings", icon: Settings },
  ];
  if (info.plan === "TEAM" || info.organization) nav.push({ href: "/dashboard/organization", label: "Organization", icon: Building2, exact: false });
  if (info.isAdmin) nav.push({ href: "/admin", label: "Admin", icon: ShieldCheck, exact: false });

  const isActive = (href: string, exact?: boolean) => (exact ? pathname === href : pathname.startsWith(href));
  const planMeta = PLAN_META[info.plan] ?? PLAN_META.FREE;
  const isFree = info.plan === "FREE";

  async function upgrade() {
    setUpgrading(true);
    try {
      const res = await fetch("/api/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ plan: "PRO" }) });
      const data = (await res.json()) as { url?: string };
      if (data.url) window.location.href = data.url;
    } catch { /* ignore */ } finally { setUpgrading(false); }
  }

  const pct = usage && usage.wordsLimit > 0 ? Math.min(100, Math.round((usage.wordsUsed / usage.wordsLimit) * 100)) : 0;
  const wordsLeft = usage && usage.wordsLimit > 0 ? Math.max(0, usage.wordsLimit - usage.wordsUsed) : null;

  const NavLinks = ({ onNavigate }: { onNavigate?: () => void }) => (
    <>
      {nav.map(({ href, label, icon: Icon, exact }) => {
        const active = isActive(href, exact);
        return (
          <Link key={href} href={href} onClick={onNavigate} aria-current={active ? "page" : undefined}
            style={{
              display: "flex", alignItems: "center", gap: 11, padding: "9px 12px", borderRadius: 9, textDecoration: "none",
              background: active ? THEME.brandDim : "transparent",
              color: active ? THEME.brandHi : THEME.textDim,
              fontSize: 14, fontWeight: active ? 600 : 500,
              border: active ? `1px solid ${THEME.brand}33` : "1px solid transparent",
            }}>
            <Icon size={17} color={active ? THEME.brandHi : THEME.textMuted} aria-hidden="true" />
            {label}
          </Link>
        );
      })}
    </>
  );

  const PlanCard = () => (
    <div style={{ padding: 12, borderTop: `1px solid ${THEME.border}`, display: "flex", flexDirection: "column", gap: 10 }}>
      {usage && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: THEME.textMuted, marginBottom: 5 }}>
            <span>{wordsLeft === null ? "Unlimited words" : `${wordsLeft.toLocaleString()} words left`}</span>
            <span className="tnum">{usage.wordsLimit > 0 ? `${pct}%` : "∞"}</span>
          </div>
          <div style={{ height: 5, background: THEME.surface3, borderRadius: 999 }}>
            <div style={{ height: 5, width: `${pct}%`, background: pct > 90 ? THEME.warn : THEME.brand, borderRadius: 999, transition: "width .4s ease" }} />
          </div>
        </div>
      )}
      {isFree ? (
        <button onClick={upgrade} disabled={upgrading}
          style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: THEME.gradient, color: "#fff", border: "none", borderRadius: 9, padding: "9px 12px", fontSize: 13, fontWeight: 700, cursor: "pointer", boxShadow: glow(THEME.brand, 0.28), fontFamily: THEME.fontSans }}>
          {upgrading ? "Loading…" : <>Upgrade to Pro <ArrowUpRight size={14} aria-hidden="true" /></>}
        </button>
      ) : (
        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, alignSelf: "flex-start", background: THEME.brandDim, border: `1px solid ${THEME.brand}44`, borderRadius: 100, padding: "4px 10px" }}>
          <planMeta.icon size={12} color={THEME.brandHi} aria-hidden="true" />
          <span style={{ fontSize: 11, fontWeight: 700, color: THEME.brandHi }}>{planMeta.label}</span>
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 8px", borderRadius: 10, background: THEME.surface2, border: `1px solid ${THEME.border}` }}>
        <UserButton afterSignOutUrl="/" />
        <span style={{ fontSize: 12, color: THEME.textDim, fontWeight: 500 }}>Account</span>
      </div>
    </div>
  );

  return (
    <div style={{ display: "flex", minHeight: "100dvh", background: THEME.bg, fontFamily: THEME.fontSans }}>
      {/* Desktop sidebar */}
      <aside className="ws-sidebar" style={{ width: 232, flexShrink: 0, borderRight: `1px solid ${THEME.border}`, background: THEME.surface1, flexDirection: "column", position: "sticky", top: 0, height: "100dvh" }}>
        <Link href="/dashboard" style={{ display: "flex", alignItems: "center", gap: 9, padding: "18px 16px 14px", textDecoration: "none", borderBottom: `1px solid ${THEME.border}` }}>
          <span style={{ fontSize: 19, fontWeight: 800, color: THEME.brand, fontFamily: THEME.fontHeading, letterSpacing: "-0.5px" }}>H<span style={{ color: THEME.accent }}>.</span></span>
          <span style={{ fontSize: 15, fontWeight: 700, color: THEME.text, fontFamily: THEME.fontHeading, letterSpacing: "-0.01em" }}>HumanizeIt</span>
        </Link>
        <nav style={{ flex: 1, padding: "14px 10px", display: "flex", flexDirection: "column", gap: 3 }}>
          <NavLinks />
        </nav>
        <PlanCard />
      </aside>

      {/* Mobile top bar */}
      <div className="ws-topbar" style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 40, height: 52, alignItems: "center", justifyContent: "space-between", padding: "0 16px", background: "rgba(255,255,255,0.9)", backdropFilter: "blur(12px)", borderBottom: `1px solid ${THEME.border}` }}>
        <Link href="/dashboard" style={{ display: "flex", alignItems: "center", gap: 7, textDecoration: "none" }}>
          <span style={{ fontSize: 18, fontWeight: 800, color: THEME.brand, fontFamily: THEME.fontHeading }}>H<span style={{ color: THEME.accent }}>.</span></span>
        </Link>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {isFree && <button onClick={upgrade} disabled={upgrading} style={{ background: THEME.gradient, color: "#fff", border: "none", borderRadius: 8, padding: "5px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Upgrade</button>}
          <UserButton afterSignOutUrl="/" />
        </div>
      </div>

      {/* Content */}
      <main style={{ flex: 1, minWidth: 0 }} className="ws-main-pad">
        {children}
      </main>

      {/* Mobile bottom tabs */}
      <nav className="ws-bottomnav" style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 40, height: 60, background: "rgba(255,255,255,0.94)", backdropFilter: "blur(12px)", borderTop: `1px solid ${THEME.border}` }}>
        {nav.slice(0, 4).map(({ href, label, icon: Icon, exact }) => {
          const active = isActive(href, exact);
          return (
            <Link key={href} href={href} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3, textDecoration: "none", color: active ? THEME.brandHi : THEME.textMuted }}>
              <Icon size={19} aria-hidden="true" />
              <span style={{ fontSize: 10, fontWeight: active ? 700 : 500 }}>{label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
