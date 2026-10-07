"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import {
  LayoutDashboard,
  Users,
  Building2,
  Ticket,
  ShieldCheck,
  ArrowLeft,
  DollarSign,
  TrendingUp,
  Gift,
  FileText,
  Tag,
  ScrollText,
  Funnel,
  ContactRound,
  SquareKanban,
  ListTodo,
  Layers,
  Share2,
  Megaphone,
  Workflow,
  MailCheck,
  type LucideIcon,
} from "lucide-react";
import { THEME, glow } from "@/lib/theme";

type NavItem = { href: string; label: string; icon: LucideIcon; exact?: boolean };

// No href is a prefix of another, so the startsWith active check stays exact.
const ADMIN_NAV: { title: string | null; items: NavItem[] }[] = [
  {
    title: null,
    items: [
      { href: "/admin", label: "Overview", icon: LayoutDashboard, exact: true },
      { href: "/admin/users", label: "Customers", icon: Users },
      { href: "/admin/organizations", label: "Organizations", icon: Building2 },
      { href: "/admin/documents", label: "Documents", icon: FileText },
    ],
  },
  {
    title: "CRM",
    items: [
      { href: "/admin/funnel", label: "Funnel", icon: Funnel },
      { href: "/admin/contacts", label: "Contacts", icon: ContactRound },
      { href: "/admin/pipeline", label: "Pipeline", icon: SquareKanban },
      { href: "/admin/tasks", label: "Tasks", icon: ListTodo },
      { href: "/admin/segments", label: "Segments", icon: Layers },
      { href: "/admin/referrals", label: "Referrals", icon: Share2 },
    ],
  },
  {
    title: "Email",
    items: [
      { href: "/admin/campaigns", label: "Campaigns", icon: Megaphone },
      { href: "/admin/sequences", label: "Sequences", icon: Workflow },
      { href: "/admin/email-log", label: "Email log", icon: MailCheck },
    ],
  },
  {
    title: "Money",
    items: [
      { href: "/admin/revenue", label: "Revenue", icon: DollarSign },
      { href: "/admin/growth", label: "Growth", icon: TrendingUp },
      { href: "/admin/codes", label: "Discount codes", icon: Ticket },
      { href: "/admin/redemptions", label: "Redemptions", icon: Gift },
    ],
  },
  {
    title: "System",
    items: [
      { href: "/admin/tags", label: "Tags", icon: Tag },
      { href: "/admin/audit", label: "Audit log", icon: ScrollText },
    ],
  },
];

export function AdminShell({ email, children }: { email: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const isActive = (href: string, exact?: boolean) => (exact ? pathname === href : pathname.startsWith(href));

  // On narrow screens the nav is one scrolling row: keep the current page's link in view.
  useEffect(() => {
    document.querySelector('.admin-nav [aria-current="page"]')?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [pathname]);

  return (
    // Below 768px the sidebar becomes a top bar with a scrolling nav row (app/globals.css, .admin-*).
    <div className="admin-shell" style={{ display: "flex", minHeight: "100dvh", background: THEME.bg, fontFamily: THEME.fontSans }}>
      {/* Sidebar */}
      <aside className="admin-aside" style={{ width: 240, flexShrink: 0, borderRight: `1px solid ${THEME.border}`, background: THEME.surface1, display: "flex", flexDirection: "column", position: "sticky", top: 0, height: "100dvh" }}>
        <div style={{ padding: "20px 18px 16px", borderBottom: `1px solid ${THEME.border}`, display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 30, height: 30, borderRadius: 9, background: THEME.gradient, display: "grid", placeItems: "center", boxShadow: glow(THEME.brand, 0.22) }}>
            <ShieldCheck size={16} color="#fff" aria-hidden="true" />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: THEME.text, fontFamily: THEME.fontHeading, lineHeight: 1.1 }}>Admin</div>
            <div style={{ fontSize: 11, color: THEME.textMuted }}>Control panel</div>
          </div>
        </div>

        <nav aria-label="Admin" className="admin-nav" style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "14px 10px", display: "flex", flexDirection: "column", gap: 2 }}>
          {ADMIN_NAV.map((group) => (
            <div key={group.title ?? "main"} role="group" aria-label={group.title ?? undefined} className="admin-nav-group" style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {group.title ? (
                <div className="admin-nav-title" style={{ padding: "14px 12px 6px", fontSize: 10, fontWeight: 600, color: THEME.textMuted, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  {group.title}
                </div>
              ) : null}
              {group.items.map(({ href, label, icon: Icon, exact }) => {
                const active = isActive(href, exact);
                return (
                  <Link key={href} href={href} aria-current={active ? "page" : undefined} className="admin-nav-link" style={{
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
            </div>
          ))}
        </nav>

        <div className="admin-aside-foot" style={{ padding: 12, borderTop: `1px solid ${THEME.border}` }}>
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
      <main className="admin-main" style={{ flex: 1, minWidth: 0, overflow: "auto" }}>{children}</main>
    </div>
  );
}
