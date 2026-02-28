"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { UserButton, useUser } from "@clerk/nextjs";
import { PenLine, History, Settings } from "lucide-react";

const NAV_ITEMS = [
  { href: "/dashboard/editor", label: "Editor", icon: PenLine },
  { href: "/dashboard/history", label: "History", icon: History },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

export function DashboardNav({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user } = useUser();
  const plan = (user?.publicMetadata?.plan as string) ?? "FREE";

  const isActive = (href: string) => pathname.startsWith(href);

  return (
    <div style={{ display: "flex", height: "100dvh", overflow: "hidden", background: "#09090b" }}>

      {/* ── Desktop Sidebar ── */}
      <aside className="hidden md:flex" style={{
        width: "220px", flexShrink: 0, flexDirection: "column",
        background: "#060608", borderRight: "1px solid rgba(255,255,255,0.05)",
      }}>
        {/* Logo */}
        <Link href="/" style={{
          display: "flex", alignItems: "center", gap: "10px",
          padding: "20px 16px 16px", textDecoration: "none",
          borderBottom: "1px solid rgba(255,255,255,0.05)",
        }}>
          <div style={{
            width: "28px", height: "28px", borderRadius: "7px",
            background: "linear-gradient(135deg, #8b5cf6, #7c3aed)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "14px", fontWeight: 800, color: "#fafafa",
          }}>H</div>
          <span style={{ fontSize: "14px", fontWeight: 700, color: "#fafafa" }}>HumanizeIt</span>
        </Link>

        {/* Nav */}
        <nav style={{ flex: 1, padding: "12px 10px", display: "flex", flexDirection: "column", gap: "2px" }}>
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = isActive(href);
            return (
              <Link key={href} href={href} style={{
                display: "flex", alignItems: "center", gap: "10px",
                padding: "9px 12px", borderRadius: "8px", textDecoration: "none",
                background: active ? "rgba(139,92,246,0.12)" : "transparent",
                color: active ? "#a78bfa" : "rgba(255,255,255,0.4)",
                fontSize: "13px", fontWeight: active ? 600 : 400,
                transition: "all 0.15s",
              }}>
                <Icon size={15} />
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Bottom */}
        <div style={{ padding: "12px 16px", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{
              fontSize: "10px", fontWeight: 700, letterSpacing: "0.5px",
              padding: "3px 8px", borderRadius: "4px", textTransform: "uppercase",
              background: plan === "FREE" ? "rgba(255,255,255,0.06)" : "rgba(139,92,246,0.15)",
              color: plan === "FREE" ? "rgba(255,255,255,0.35)" : "#a78bfa",
            }}>{plan}</span>
            <UserButton afterSignOutUrl="/" />
          </div>
        </div>
      </aside>

      {/* ── Main content ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <main style={{ flex: 1, overflow: "auto", paddingBottom: "60px" }} className="md:pb-0">
          {children}
        </main>
      </div>

      {/* ── Mobile Bottom Tabs ── */}
      <nav className="flex md:hidden" style={{
        position: "fixed", bottom: 0, left: 0, right: 0,
        height: "60px", zIndex: 50,
        background: "#060608",
        borderTop: "1px solid rgba(255,255,255,0.08)",
        alignItems: "center", justifyContent: "space-around",
      }}>
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = isActive(href);
          return (
            <Link key={href} href={href} style={{
              display: "flex", flexDirection: "column", alignItems: "center",
              gap: "3px", textDecoration: "none", flex: 1, padding: "8px 0",
              color: active ? "#8b5cf6" : "rgba(255,255,255,0.3)",
              transition: "color 0.15s",
            }}>
              <Icon size={20} />
              <span style={{ fontSize: "10px", fontWeight: active ? 600 : 400 }}>{label}</span>
            </Link>
          );
        })}
        {/* User avatar on mobile */}
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center",
          gap: "3px", flex: 1, padding: "8px 0",
        }}>
          <UserButton afterSignOutUrl="/" />
          <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)" }}>Account</span>
        </div>
      </nav>
    </div>
  );
}
