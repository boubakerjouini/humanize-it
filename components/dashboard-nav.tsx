"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton, useUser } from "@clerk/nextjs";
import { FileText, History, Settings, Menu, X } from "lucide-react";
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
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Close sidebar on route change
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  // Close sidebar on ESC key
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSidebarOpen(false);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  // Prevent body scroll when sidebar open on mobile
  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [sidebarOpen]);

  useEffect(() => {
    fetch("/api/usage")
      .then(r => r.json())
      .then((d: { plan?: string }) => { if (d.plan) setPlan(d.plan); })
      .catch(() => undefined);
  }, []);

  if (!isLoaded) return null;

  const planStyle = PLAN_COLORS[plan] ?? PLAN_COLORS.FREE;

  // Shared sidebar nav content
  const SidebarContent = () => (
    <>
      {/* Logo + close button (close only visible on mobile) */}
      <div style={{
        height: "56px", display: "flex", alignItems: "center",
        padding: "0 20px", gap: "8px",
        borderBottom: "1px solid rgba(255,255,255,0.05)",
        justifyContent: "space-between",
      }}>
        <Link href="/" style={{
          display: "flex", alignItems: "center", gap: "8px",
          textDecoration: "none",
        }}>
          <span style={{ fontSize: "18px", fontWeight: 800, color: "#8b5cf6" }}>H.</span>
          <span style={{ fontSize: "13px", fontWeight: 600, color: "#fafafa" }}>HumanizeIt</span>
        </Link>
        {/* Close button — only on mobile */}
        <button
          onClick={() => setSidebarOpen(false)}
          className="md:hidden"
          style={{
            background: "transparent", border: "none", cursor: "pointer",
            color: "rgba(255,255,255,0.4)", padding: "4px", borderRadius: "4px",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          <X size={18} />
        </button>
      </div>

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
                padding: "10px 12px", borderRadius: "6px",
                fontSize: "13px", fontWeight: 500,
                textDecoration: "none",
                transition: "background 0.15s, color 0.15s",
                background: active ? "rgba(139,92,246,0.1)" : "transparent",
                color: active ? "#8b5cf6" : "rgba(255,255,255,0.45)",
                borderLeft: active ? "2px solid #8b5cf6" : "2px solid transparent",
                marginLeft: "2px",
              }}
              className={cn("group", !active && "hover:bg-white/5 hover:text-white/70")}
            >
              <Icon size={15} style={{ color: active ? "#8b5cf6" : undefined, flexShrink: 0 }} />
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
          <div style={{
            fontSize: "12px", fontWeight: 500, color: "#fafafa",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
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
    </>
  );

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#09090b" }}>

      {/* ── Sidebar Desktop (md+) — always visible ─────── */}
      <aside
        className="hidden md:flex"
        style={{
          width: "220px", flexShrink: 0,
          flexDirection: "column",
          background: "#060608",
          borderRight: "1px solid rgba(255,255,255,0.05)",
        }}
      >
        <SidebarContent />
      </aside>

      {/* ── Sidebar Mobile — slide-in drawer ────────────── */}
      {/* Backdrop */}
      {sidebarOpen && (
        <div
          className="md:hidden"
          onClick={() => setSidebarOpen(false)}
          style={{
            position: "fixed", inset: 0, zIndex: 40,
            background: "rgba(0,0,0,0.6)",
            backdropFilter: "blur(2px)",
          }}
        />
      )}

      {/* Drawer */}
      <aside
        className="md:hidden"
        style={{
          position: "fixed", top: 0, left: 0, bottom: 0,
          width: "260px", zIndex: 50,
          background: "#060608",
          borderRight: "1px solid rgba(255,255,255,0.08)",
          display: "flex", flexDirection: "column",
          transform: sidebarOpen ? "translateX(0)" : "translateX(-100%)",
          transition: "transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
          boxShadow: sidebarOpen ? "4px 0 24px rgba(0,0,0,0.5)" : "none",
        }}
      >
        <SidebarContent />
      </aside>

      {/* ── Main area ────────────────────────────────────── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>

        {/* Top bar — mobile only (hidden on md+) */}
        <header className="flex md:hidden" style={{
          height: "56px", alignItems: "center",
          justifyContent: "space-between",
          borderBottom: "1px solid rgba(255,255,255,0.05)",
          background: "#060608",
          padding: "0 16px",
          position: "sticky", top: 0, zIndex: 30,
        }}>
          {/* Left: burger (mobile) + logo (mobile) */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            {/* Burger button — mobile only */}
            <button
              onClick={() => setSidebarOpen(true)}
              className="md:hidden"
              style={{
                background: "transparent", border: "none", cursor: "pointer",
                color: "rgba(255,255,255,0.6)", padding: "6px", borderRadius: "6px",
                transition: "background 0.15s",
              }}
              aria-label="Open menu"
            >
              <Menu size={20} />
            </button>

            {/* Mobile logo */}
            <div className="md:hidden" style={{ alignItems: "center", gap: "6px" }}>
              <span style={{ fontSize: "16px", fontWeight: 800, color: "#8b5cf6" }}>H.</span>
              <span style={{ fontSize: "13px", fontWeight: 600, color: "#fafafa" }}>HumanizeIt</span>
            </div>
          </div>

          {/* Desktop empty placeholder */}
          <div className="hidden md:block" />

          {/* Right: UserButton (mobile only — desktop has it in sidebar) */}
          <div className="md:hidden">
            <UserButton afterSignOutUrl="/" />
          </div>
        </header>

        {/* Page content */}
        <main className="main-content" style={{ flex: 1, overflow: "auto", padding: "24px" }}>
          {children}
        </main>
      </div>
    </div>
  );
}
