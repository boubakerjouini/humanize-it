"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { LayoutDashboard, Users, Building2, Ticket, ShieldCheck, ArrowLeft, DollarSign, TrendingUp, Gift, FileText, Tag, ScrollText } from "lucide-react";
import { THEME, glow } from "@/lib/theme";

const ADMIN_NAV = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/admin/users", label: "Customers", icon: Users },
  { href: "/admin/organizations", label: "Organizations", icon: Building2 },
  { href: "/admin/documents", label: "Documents", icon: FileText },
  { href: "/admin/revenue", label: "Revenue", icon: DollarSign },
  { href: "/admin/growth", label: "Growth", icon: TrendingUp },
  { href: "/admin/codes", label: "Discount codes", icon: Ticket },
  { href: "/admin/redemptions", label: "Redemptions", icon: Gift },
  { href: "/admin/tags", label: "Tags", icon: Tag },
  { href: "/admin/audit", label: "Audit log", icon: ScrollText },
];

export function AdminShell({ email, children }: { email: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const isActive = (href: string, exact?: boolean) => (exact ? pathname === href : pathname.startsWith(href));

  return (
    <div style={{ display: "flex", minHeight: "100dvh", background: THEME.bg, fontFamily: THEME.fontSans }}>
      {/* Sidebar */}
      <aside style={{ width: 240, flexShrink: 0, borderRight: `1px solid ${THEME.border}`, background: THEME.surface1, display: "flex", flexDirection: "column", position: "sticky", top: 0, height: "100dvh" }}>
        <div style={{ padding: "20px 18px 16px", borderBottom: `1px solid ${THEME.border}`, display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 30, height: 30, borderRadius: 9, background: THEME.gradient, display: "grid", placeItems: "center", boxShadow: glow(THEME.brand, 0.22) }}>
            <ShieldCheck size={16} color="#fff" aria-hidden="true" />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: THEME.text, fontFamily: THEME.fontHeading, lineHeight: 1.1 }}>Admin</div>
            <div style={{ fontSize: 11, color: THEME.textMuted }}>Control panel</div>
          </div>
        </div>

        <nav style={{ flex: 1, padding: "14px 10px", display: "flex", flexDirection: "column", gap: 2 }}>
          {ADMIN_NAV.map(({ href, label, icon: Icon, exact }) => {
            const active = isActive(href, exact);
            return (
              <Link key={href} href={href} aria-current={active ? "page" : undefined} style={{
                display: "flex", alignItems: "center", gap: 11, padding: "9px 12px", borderRadius: 8, textDecoration: "none",
                background: active ? THEME.brandDim : "transparent",
                color: active ? THEME.brandHi : THEME.textDim,
                fontSize: 13, fontWeight: active ? 600 : 500,
                border: active ? `1px solid ${THEME.brand}44` : "1px solid transparent",
              }}>
                <Icon size={15} color={active ? THEME.brandHi : THEME.textMuted} aria-hidden="true" />
                {label}
              </Link>
            );
          })}
        </nav>

        <div style={{ padding: 12, borderTop: `1px solid ${THEME.border}` }}>
          <Link href="/dashboard" style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600, color: THEME.textDim, textDecoration: "none", marginBottom: 8 }}>
            <ArrowLeft size={14} aria-hidden="true" /> Back to app
          </Link>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 10, background: THEME.surface2, border: `1px solid ${THEME.border}` }}>
            <UserButton afterSignOutUrl="/" />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 11, color: THEME.text, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{email}</div>
              <div style={{ fontSize: 10, color: THEME.textMuted }}>Admin</div>
            </div>
          </div>
        </div>
      </aside>

      {/* Content */}
      <main style={{ flex: 1, minWidth: 0, overflow: "auto" }}>{children}</main>
    </div>
  );
}
