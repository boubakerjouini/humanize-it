"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { useEffect, useState } from "react";
import { Wand2, Settings, Building2, ShieldCheck, Crown, Sparkles, Zap, Gift, AudioLines } from "lucide-react";
import { THEME, glow } from "@/lib/theme";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { UpgradeModal, type UpgradeTrigger } from "@/components/ui/upgrade-modal";
import { ReferralCard, useReferralInfo } from "@/components/growth/referral-card";
import { FoundingBadge } from "@/components/growth/founding-badge";
import { useOffers } from "@/components/growth/founding-offers";
import { readCheckoutIntent, withoutCheckoutIntent, type CheckoutIntent } from "@/lib/checkout-intent";
import { UsageChip, UsageMeter } from "@/components/workspace/usage-meter";
import { Skeleton } from "@/components/workspace/skeleton";
import { USAGE_CHANGED_EVENT, type UsageSnapshot } from "@/components/workspace/feedback";
import { describePlan, isOnFree, planShortLabel } from "@/lib/plan-status";

interface PlanInfo {
  plan: string;
  isAdmin: boolean;
  organization: { id: string; name: string; role: string } | null;
}

const PLAN_META: Record<string, { label: string; icon: typeof Crown; }> = {
  TEAM: { label: "Team", icon: Crown },
  PRO: { label: "Pro", icon: Sparkles },
  FREE: { label: "Free", icon: Zap },
};

export function WorkspaceShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [info, setInfo] = useState<PlanInfo>({ plan: "FREE", isAdmin: false, organization: null });
  // Until /api/user-plan answers, paying users must not see "Upgrade" flash.
  const [planLoaded, setPlanLoaded] = useState(false);
  const [usage, setUsage] = useState<UsageSnapshot | null>(null);
  // The first /api/usage answer (or failure): it decides gift vs lapsed-gift labels.
  const [usageSettled, setUsageSettled] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  // "quota" when opened from the out-of-words meter: the modal then leads with the limit and the word pack.
  const [upgradeTrigger, setUpgradeTrigger] = useState<UpgradeTrigger>("upgrade");
  // A paid plan picked on the pricing page before sign-up (lib/checkout-intent.ts).
  const [pickedPlan, setPickedPlan] = useState<CheckoutIntent | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  // Null while the referral program is off: the invite entry stays hidden.
  const referral = useReferralInfo();
  const founding = useOffers()?.founding.member ?? false;

  useEffect(() => {
    // Take the picked plan out of the address so a reload or Back doesn't reopen the menu.
    const picked = readCheckoutIntent(window.location.search);
    if (picked) window.history.replaceState(null, "", withoutCheckoutIntent(window.location.href));
    fetch("/api/user-plan").then((r) => r.json()).then((d) => setInfo({ plan: d.plan ?? "FREE", isAdmin: !!d.isAdmin, organization: d.organization ?? null })).catch(() => {})
      // Then open the plan menu on it, once the menu knows the current plan.
      .finally(() => {
        setPlanLoaded(true);
        if (!picked) return;
        setPickedPlan(picked);
        setUpgradeOpen(true);
      });
  }, []);

  // The meter refetches whenever the editor reports a spend (or a quota hit).
  useEffect(() => {
    const load = () => {
      fetch("/api/usage").then((r) => (r.ok ? r.json() : null)).then((d: UsageSnapshot | null) => d && setUsage(d)).catch(() => {})
        .finally(() => setUsageSettled(true));
    };
    load();
    window.addEventListener(USAGE_CHANGED_EVENT, load);
    return () => window.removeEventListener(USAGE_CHANGED_EVENT, load);
  }, []);

  const nav = [
    { href: "/dashboard", label: "Humanize", icon: Wand2, exact: true },
    { href: "/dashboard/voice", label: "Voice", icon: AudioLines },
    { href: "/dashboard/settings", label: "Settings", icon: Settings },
  ];
  if (info.plan === "TEAM" || info.organization) nav.push({ href: "/dashboard/organization", label: "Organization", icon: Building2, exact: false });
  if (info.isAdmin) nav.push({ href: "/admin", label: "Admin", icon: ShieldCheck, exact: false });

  const isActive = (href: string, exact?: boolean) => (exact ? pathname === href : pathname.startsWith(href));
  const planMeta = PLAN_META[info.plan] ?? PLAN_META.FREE;
  // /api/usage knows how the plan is held: a gift shows its end date, a lapsed one reads as Free.
  const planStatus = usage ? describePlan(usage, { founding }) : null;
  const isFree = planStatus ? isOnFree(planStatus) : info.plan === "FREE";
  const planLabel = planStatus ? planShortLabel(planStatus) : planMeta.label;
  // Both answers in before any plan UI: no "Upgrade" flash for payers, no "Pro" flash for a lapsed gift.
  const planKnown = planLoaded && usageSettled;

  // The plan menu (monthly or annual) rather than a straight monthly checkout.
  const upgrade = () => { setUpgradeTrigger("upgrade"); setUpgradeOpen(true); };
  const moreWords = () => { setUpgradeTrigger("quota"); setUpgradeOpen(true); };

  // Render helpers (not components): defining components inside render remounts them every time.
  const renderNavLinks = (onNavigate?: () => void) => (
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

  const renderPlanCard = () => (
    <div style={{ padding: 12, borderTop: `1px solid ${THEME.border}`, display: "flex", flexDirection: "column", gap: 10 }}>
      <UsageMeter usage={usage} founding={founding} onUpgrade={moreWords} />
      {referral && (
        <button onClick={() => setInviteOpen(true)}
          style={{ display: "flex", alignItems: "center", gap: 8, background: THEME.accentDim, color: THEME.accentHi, border: `1px solid ${THEME.accent}33`, borderRadius: 9, padding: "8px 10px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: THEME.fontSans, textAlign: "left" }}>
          <Gift size={14} aria-hidden="true" />
          {`Invite friends · +${referral.rewardWords.toLocaleString("en-US")} words`}
        </button>
      )}
      {!planKnown ? (
        <Skeleton height={36} radius={9} />
      ) : isFree ? (
        <button onClick={upgrade}
          style={{ display: "flex", alignItems: "center", justifyContent: "center", background: THEME.gradient, color: "#fff", border: "none", borderRadius: 9, padding: "9px 12px", fontSize: 13, fontWeight: 700, cursor: "pointer", boxShadow: glow(THEME.brand, 0.28), fontFamily: THEME.fontSans }}>
          Upgrade to Pro
        </button>
      ) : (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, alignSelf: "flex-start", background: THEME.brandDim, border: `1px solid ${THEME.brand}44`, borderRadius: 100, padding: "4px 10px" }}>
            <planMeta.icon size={12} color={THEME.brandHi} aria-hidden="true" />
            <span style={{ fontSize: 11, fontWeight: 700, color: THEME.brandHi }}>{planLabel}</span>
          </div>
          {founding && <FoundingBadge />}
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
      <style href="ws-shell-mobile" precedence="default">{SHELL_MOBILE_CSS}</style>
      {/* Desktop sidebar */}
      <aside className="ws-sidebar" style={{ width: 232, flexShrink: 0, borderRight: `1px solid ${THEME.border}`, background: THEME.surface1, flexDirection: "column", position: "sticky", top: 0, height: "100dvh" }}>
        <Link href="/dashboard" style={{ display: "flex", alignItems: "center", gap: 9, padding: "18px 16px 14px", textDecoration: "none", borderBottom: `1px solid ${THEME.border}` }}>
          <span style={{ fontSize: 19, fontWeight: 800, color: THEME.brand, fontFamily: THEME.fontHeading, letterSpacing: "-0.5px" }}>H<span style={{ color: THEME.accent }}>.</span></span>
          <span style={{ fontSize: 15, fontWeight: 700, color: THEME.text, fontFamily: THEME.fontHeading, letterSpacing: "-0.01em" }}>HumanizeIt</span>
        </Link>
        <nav style={{ flex: 1, padding: "14px 10px", display: "flex", flexDirection: "column", gap: 3 }}>
          {renderNavLinks()}
        </nav>
        {renderPlanCard()}
      </aside>

      {/* Mobile top bar */}
      <div className="ws-topbar" style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 40, height: 52, alignItems: "center", justifyContent: "space-between", padding: "0 16px", background: "rgba(255,255,255,0.9)", backdropFilter: "blur(12px)", borderBottom: `1px solid ${THEME.border}` }}>
        <Link href="/dashboard" style={{ display: "flex", alignItems: "center", gap: 7, textDecoration: "none" }}>
          <span style={{ fontSize: 18, fontWeight: 800, color: THEME.brand, fontFamily: THEME.fontHeading }}>H<span style={{ color: THEME.accent }}>.</span></span>
        </Link>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <UsageChip usage={usage} onUpgrade={moreWords} />
          {planKnown && isFree && <button onClick={upgrade} style={{ background: THEME.gradient, color: "#fff", border: "none", borderRadius: 8, padding: "5px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Upgrade</button>}
          <UserButton afterSignOutUrl="/" />
        </div>
      </div>

      {/* Content */}
      <main style={{ flex: 1, minWidth: 0 }} className="ws-main-pad">
        {children}
      </main>

      <UpgradeModal
        isOpen={upgradeOpen}
        onClose={() => { setUpgradeOpen(false); setPickedPlan(null); }}
        currentPlan={info.plan}
        trigger={upgradeTrigger}
        intent={pickedPlan}
      />
      {referral && (
        <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
          <DialogContent style={{ background: THEME.surface2, fontFamily: THEME.fontSans }}>
            <DialogTitle style={{ fontFamily: THEME.fontHeading, color: THEME.text }}>Invite friends</DialogTitle>
            <DialogDescription style={{ color: THEME.textDim }}>
              {`When a friend signs up with your link and runs their first check, you each get ${referral.rewardWords.toLocaleString("en-US")} bonus words.`}
            </DialogDescription>
            <ReferralCard info={referral} compact />
          </DialogContent>
        </Dialog>
      )}

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

// Phone fixes that only make sense while the shell's fixed bars are on screen:
// sticky editor bars clear the 52px top bar and 60px bottom tabs, and toasts
// sit above the tabs instead of covering them.
const SHELL_MOBILE_CSS = `
@media (max-width: 768px) {
  .ws-editor-toolbar { top: 52px !important; }
  .ws-editor-footer { bottom: 60px !important; }
  [data-sonner-toaster] { --offset-bottom: 72px !important; --mobile-offset-bottom: 72px !important; }
}
`;
