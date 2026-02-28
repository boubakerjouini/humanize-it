"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton, useUser } from "@clerk/nextjs";
import { FileText, History, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard/editor",   label: "Editor",   icon: FileText },
  { href: "/dashboard/history",  label: "History",  icon: History },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

const PLAN_COLORS: Record<string, { bg: string; color: string }> = {
  FREE: { bg: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.5)" },
  PRO:  { bg: "rgba(139,92,246,0.12)", color: "#8b5cf6" },
  TEAM: { bg: "rgba(245,158,11,0.12)", color: "#f59e0b" },
};

export function DashboardNav({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, isLoaded } = useUser();
  const [plan, setPlan] = useState<string>("FREE");

  useEffect(() => {
    fetch("/api/usage")
      .then(r => r.json())
      .then((d: { plan?: string }) => { if (d.plan) setPlan(d.plan); })
      .catch(() => undefined);
  }, []);

  if (!isLoaded) return null;

  const planStyle = PLAN_COLORS[plan] ?? PLAN_COLORS.FREE;

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#09090b" }}>

      {/* ── Sidebar ─────────────────────────────────────── */}
      <aside style={{
        width: "220px", flexShrink: 0,
        display: "flex", flexDirection: "column",
        background: "#060608",
        borderRight: "1px solid rgba(255,255,255,0.05)",
      }} className="hidden md:flex">

        {/* Logo */}
        <Link href="/" style={{
          height: "56px", display: "flex", alignItems: "center",
          padding: "0 20px", gap: "8px",
          borderBottom: "1px solid rgba(255,255,255,0.05)",
          textDecoration: "none",
        }}>
          <span style={{ fontSize: "18px", fontWeight: 800, color: "#8b5cf6" }}>H.</span>
          <span style={{ fontSize: "13px", fontWeight: 600, color: "#fafafa" }}>HumanizeIt</span>
        </Link>

        {/* Nav items */}
        <nav style={{ flex: 1, padding: "12px 10px", display: "flex", flexDirection: "column", gap: "2px" }}>
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                style={{
                  display: "flex", alignItems: "center", gap: "10px",
                  padding: "8px 12px", borderRadius: "6px",
                  fontSize: "13px", fontWeight: 500,
                  textDecoration: "none",
                  transition: "background 0.15s, color 0.15s",
                  background: active ? "rgba(139,92,246,0.1)" : "transparent",
                  color: active ? "#8b5cf6" : "rgba(255,255,255,0.45)",
                  borderLeft: active ? "2px solid #8b5cf6" : "2px solid transparent",
                  marginLeft: "2px",
                }}
                className={cn(
                  "group",
                  !active && "hover:bg-white/5 hover:text-white/70"
                )}
              >
                <Icon
                  size={15}
                  style={{ color: active ? "#8b5cf6" : undefined, flexShrink: 0 }}
                />
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Bottom — user info */}
        <div style={{
          padding: "14px 16px",
          borderTop: "1px solid rgba(255,255,255,0.05)",
          display: "flex", alignItems: "center", gap: "10px",
        }}>
          <UserButton afterSignOutUrl="/" />
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: "12px", fontWeight: 500, color: "#fafafa", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {user?.firstName ?? user?.primaryEmailAddress?.emailAddress?.split("@")[0] ?? "User"}
            </div>
            <div style={{
              fontSize: "10px", padding: "1px 6px", borderRadius: "4px", marginTop: "3px",
              display: "inline-block",
              background: planStyle.bg, color: planStyle.color,
              fontWeight: 600, letterSpacing: "0.5px",
            }}>
              {plan}
            </div>
          </div>
        </div>
      </aside>

      {/* ── Main area ────────────────────────────────────── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>

        {/* Top bar */}
        <header style={{
          height: "56px", display: "flex", alignItems: "center",
          justifyContent: "space-between",
          borderBottom: "1px solid rgba(255,255,255,0.05)",
          background: "#060608",
          padding: "0 20px",
        }}>
          {/* Mobile logo */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }} className="md:hidden">
            <span style={{ fontSize: "16px", fontWeight: 800, color: "#8b5cf6" }}>H.</span>
            <span style={{ fontSize: "13px", fontWeight: 600, color: "#fafafa" }}>HumanizeIt</span>
          </div>

          {/* Desktop — empty left */}
          <div className="hidden md:block" />

          {/* Mobile nav tabs */}
          <nav className="hidden sm:flex md:hidden" style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            {navItems.map(({ href, label, icon: Icon }) => {
              const active = pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  style={{
                    display: "flex", alignItems: "center", gap: "5px",
                    padding: "5px 10px", borderRadius: "5px",
                    fontSize: "12px", fontWeight: 500, textDecoration: "none",
                    background: active ? "rgba(139,92,246,0.1)" : "transparent",
                    color: active ? "#8b5cf6" : "rgba(255,255,255,0.45)",
                  }}
                >
                  <Icon size={12} />
                  {label}
                </Link>
              );
            })}
          </nav>

          {/* Right — user button on mobile only (desktop has it in sidebar) */}
          <div className="md:hidden">
            <UserButton afterSignOutUrl="/" />
          </div>
        </header>

        {/* Page content */}
        <main className="main-content" style={{ flex: 1, overflow: "auto", padding: "24px" }}>
          {children}
        </main>

        {/* Mobile bottom nav */}
        <nav className="flex sm:hidden" style={{
          borderTop: "1px solid rgba(255,255,255,0.05)",
          background: "#060608", display: "flex",
        }}>
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                style={{
                  flex: 1, display: "flex", flexDirection: "column",
                  alignItems: "center", gap: "4px", padding: "10px",
                  textDecoration: "none", fontSize: "10px",
                  color: active ? "#8b5cf6" : "rgba(255,255,255,0.35)",
                }}
              >
                <Icon size={16} />
                {label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
