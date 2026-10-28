"use client";

import { useEffect, useState } from "react";
import { useClerk, useUser } from "@clerk/nextjs";
import { toast } from "sonner";
import { Sparkles, Crown, Zap, CreditCard, Gift, Key, User as UserIcon, AlertTriangle, ExternalLink, Mail, Users, Award, Handshake, BarChart3, LogOut, ShieldCheck, Trash2 } from "lucide-react";
import { THEME, glow } from "@/lib/theme";
import { ApiKeysSection } from "@/components/workspace/api-keys-section";
import { UpgradeModal } from "@/components/ui/upgrade-modal";
import { ReferralCard, useReferralInfo } from "@/components/growth/referral-card";
import { CONSENT_WORDING, type Topic } from "@/lib/growth/constants";
import { FOUNDING, PLANS } from "@/lib/plans";
import { FoundingBadge } from "@/components/growth/founding-badge";
import { useOffers } from "@/components/growth/founding-offers";
import { ServiceRequestCard } from "@/components/growth/service-request-card";
import { describePlan, isOnFree, longDate, planName, usageRefillLine, type PlanStatus } from "@/lib/plan-status";
import { summarizeUsage, usagePeriod } from "@/components/workspace/feedback";

interface UsageData {
  plan: string;
  /** The plan in force now: FREE once a grant has lapsed. Absent from older responses. */
  effectivePlan?: string;
  wordsUsed: number;
  wordsLimit: number;
  rewriteCount: number;
  rewriteLimit: number;
  quotaResetAt: string;
  subscriptionStatus: string | null;
  currentPeriodEnd: string | null;
  billingInterval?: "month" | "year" | null;
  planExpiresAt?: string | null;
  bonusWords?: number;
}

interface EmailPrefs {
  email: string;
  topics: string[];
  pendingTopics: string[];
  lifecycleEmails: boolean;
}

const PLAN_META: Record<string, { label: string; icon: typeof Crown; color: string }> = {
  TEAM: { label: "Team", icon: Crown, color: THEME.accent },
  PRO: { label: "Pro", icon: Sparkles, color: THEME.brand },
  FREE: { label: "Free", icon: Zap, color: THEME.textMuted },
};

const n = (v: number) => v.toLocaleString("en-US");

export default function SettingsPage() {
  const { user } = useUser();
  const { signOut, openUserProfile } = useClerk();
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [redeem, setRedeem] = useState("");
  const [busy, setBusy] = useState<"portal" | "redeem" | "signout" | null>(null);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const referral = useReferralInfo();
  const founding = useOffers()?.founding.member ?? false;
  // Back from the Founding 100 checkout (the webhook may land a moment later).
  const [foundingWelcome, setFoundingWelcome] = useState(false);
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("founding") === "welcome") setFoundingWelcome(true);
  }, []);

  const loadUsage = () => fetch("/api/usage").then((r) => (r.ok ? r.json() : null)).then((d) => d && setUsage(d)).catch(() => {});
  useEffect(() => { void loadUsage(); }, []);

  // The plan menu lets people pick monthly or annual (a straight checkout was monthly only).
  const checkout = () => setUpgradeOpen(true);
  async function portal() {
    setBusy("portal");
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      const d = await res.json();
      if (res.ok && d.url) window.location.href = d.url; else toast.error(d.error?.message ?? "Failed to open billing portal.");
    } catch { toast.error("Failed to open billing portal."); } finally { setBusy(null); }
  }
  async function applyCode() {
    if (!redeem.trim()) { toast.error("Enter a code first."); return; }
    setBusy("redeem");
    try {
      const res = await fetch("/api/redeem", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: redeem.trim() }) });
      const d = await res.json();
      if (!res.ok) { toast.error(d.error?.message ?? "Invalid code."); return; }
      toast.success(`🎉 Redeemed — you're now on ${d.plan}.`);
      setRedeem(""); void loadUsage();
    } catch { toast.error("Failed to redeem."); } finally { setBusy(null); }
  }
  async function logOut() {
    setBusy("signout");
    try { await signOut({ redirectUrl: "/" }); } catch { toast.error("Couldn't sign you out. Try again."); setBusy(null); }
  }

  const status: PlanStatus | null = usage ? describePlan(usage, { founding }) : null;
  // The plan in force: a lapsed grant is Free already, even before the row is downgraded.
  const plan = usage?.effectivePlan ?? usage?.plan ?? "FREE";
  const meta = PLAN_META[plan] ?? PLAN_META.FREE;
  const pastDue = status?.kind === "subscription" && status.status === "past_due";
  const paid = plan === "PRO" || plan === "TEAM";
  // Same reset math as the shell's usage meter, plus the plan's end date when it comes first.
  const refill = usage && status
    ? usageRefillLine(status, summarizeUsage(usage, usagePeriod(usage)).resetsAt, PLANS.FREE.wordsLimit)
    : null;

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "28px clamp(16px, 4vw, 24px) 64px", fontFamily: THEME.fontSans }}>
      <h1 style={{ fontSize: 26, fontWeight: 800, color: THEME.text, fontFamily: THEME.fontHeading, letterSpacing: "-0.02em", margin: "0 0 4px" }}>Settings</h1>
      <p style={{ fontSize: 14, color: THEME.textDim, margin: "0 0 22px" }}>Your plan, usage, billing, and account.</p>

      {pastDue && (
        <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 10, background: THEME.aiDim, border: `1px solid ${THEME.ai}55`, borderRadius: THEME.radius, padding: "12px 16px", marginBottom: 16 }}>
          <AlertTriangle size={16} color={THEME.ai} aria-hidden="true" />
          <span style={{ fontSize: 13, color: THEME.text, flex: "1 1 200px" }}>Your last payment failed. Update your billing to keep your plan.</span>
          <button onClick={portal} style={smallBtn}>Fix billing</button>
        </div>
      )}

      {foundingWelcome && (
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10, background: THEME.accentDim, border: `1px solid ${THEME.accent}55`, borderRadius: THEME.radius, padding: "12px 16px", marginBottom: 16 }}>
          <Award size={16} color={THEME.accentHi} aria-hidden="true" style={{ flexShrink: 0, marginTop: 2 }} />
          <span style={{ fontSize: 13, color: THEME.text, lineHeight: 1.6 }}>
            {`Thank you for backing HumanizeIt. Your account switches to Pro for ${FOUNDING.months} months as soon as the payment confirms, usually within a minute (refresh if it still says Free). I read every email at support@humanizeit.app. Boubaker`}
          </span>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {/* Plan: how the plan is held decides what we say and which button we show */}
        <Section title="Your plan" icon={status?.kind === "gift" ? Gift : meta.icon} accent={status?.kind === "gift" ? THEME.accent : meta.color}>
          {status ? (
            <PlanSummary status={status} founding={founding} busy={busy === "portal"} onUpgrade={checkout} onPortal={portal} />
          ) : (
            <div style={{ fontSize: 13, color: THEME.textMuted }}>Loading your plan…</div>
          )}
        </Section>

        {/* Usage: the current quota window (a day on Free, a month on paid plans) */}
        <Section title={paid ? "Usage this month" : "Usage today"} icon={BarChart3} accent={THEME.brand}
          sub={refill?.text}>
          {usage ? (
            <>
              <UsageBar label="Words" used={usage.wordsUsed} limit={usage.wordsLimit} />
              <UsageBar label="Rewrites" used={usage.rewriteCount} limit={usage.rewriteLimit} />
              {(usage.bonusWords ?? 0) > 0 && (
                <div className="tnum" style={{ fontSize: 12, color: THEME.accentHi, fontWeight: 600, marginTop: 2 }}>
                  {`+${n(usage.bonusWords ?? 0)} bonus words, used once your plan's words run out`}
                </div>
              )}
            </>
          ) : (
            <div style={{ fontSize: 13, color: THEME.textMuted }}>Loading…</div>
          )}
        </Section>

        {/* Founder bonuses: real founder time, capped per month */}
        {paid && (
          <Section title={plan === "PRO" ? "Founder's First-Document Review" : "30-minute Workflow Setup"} icon={Handshake} accent={THEME.accent}
            sub={plan === "PRO" ? "A Pro bonus. You can also request it from any document's Before/After Report." : "A Team bonus."}>
            <ServiceRequestCard kind={plan === "PRO" ? "founder_review" : "team_setup"} />
          </Section>
        )}

        {/* Redeem */}
        <Section title="Redeem a code" icon={Gift} accent={THEME.accent}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input value={redeem} onChange={(e) => setRedeem(e.target.value.toUpperCase())} placeholder="HUMAN-PRO-XXXX" aria-label="Discount code"
              style={{ flex: "1 1 180px", minWidth: 0, border: `1px solid ${THEME.border}`, borderRadius: 8, padding: "9px 12px", fontSize: 13, color: THEME.text, background: THEME.surface1, outline: "none", fontFamily: THEME.fontMono, textTransform: "uppercase" }} />
            <button onClick={applyCode} disabled={busy === "redeem" || !redeem.trim()} style={{ background: redeem.trim() ? THEME.brand : THEME.surface3, color: redeem.trim() ? "#fff" : THEME.textMuted, border: "none", borderRadius: 8, padding: "9px 18px", fontSize: 13, fontWeight: 700, cursor: redeem.trim() ? "pointer" : "not-allowed" }}>
              {busy === "redeem" ? "Redeeming…" : "Redeem"}
            </button>
          </div>
        </Section>

        {/* Invite friends (only while the referral program is on) */}
        {referral && (
          <div id="invite" style={{ scrollMarginTop: 24 }}>
            <Section title="Invite friends" icon={Users} accent={THEME.accent} sub={`You both get ${n(referral.rewardWords)} bonus words.`}>
              <ReferralCard info={referral} compact />
            </Section>
          </div>
        )}

        {/* Email preferences */}
        <Section title="Email preferences" icon={Mail} accent={THEME.brand} sub="Choose what we send you. Security and billing emails always go out.">
          <EmailPreferences />
        </Section>

        {/* API keys */}
        <Section title="API keys" icon={Key} accent={THEME.brand} sub="Developer access to the HumanizeIt API.">
          <ApiKeysSection onUpgrade={checkout} />
          <a href="/docs/api" target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 5, marginTop: 12, fontSize: 12, color: THEME.brandHi, textDecoration: "none", fontWeight: 600 }}>
            API documentation <ExternalLink size={12} aria-hidden="true" />
          </a>
        </Section>

        {/* Account */}
        <Section title="Account" icon={UserIcon} accent={THEME.textMuted}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, color: THEME.text, fontWeight: 600 }}>{user?.fullName || user?.firstName || "Your account"}</div>
              <div style={{ fontSize: 13, color: THEME.textDim, overflowWrap: "anywhere" }}>{user?.primaryEmailAddress?.emailAddress ?? "—"}</div>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button onClick={() => openUserProfile()} style={smallBtn}><ShieldCheck size={13} aria-hidden="true" /> Email & password</button>
              <button onClick={logOut} disabled={busy === "signout"} style={smallBtn}><LogOut size={13} aria-hidden="true" /> {busy === "signout" ? "Signing out…" : "Sign out"}</button>
            </div>
          </div>

          <div style={{ marginTop: 18, paddingTop: 16, borderTop: `1px solid ${THEME.border}` }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, color: THEME.text, margin: "0 0 6px" }}>Delete account</h3>
            <p style={{ fontSize: 13, color: THEME.textDim, lineHeight: 1.6, margin: "0 0 6px" }}>
              Deleting your account permanently removes your documents and their versions, voice profiles, API keys, usage and plan.
              {status?.kind === "subscription" && " Your subscription is cancelled at once and you won't be charged again."}
              {status?.kind === "gift" && " Your Pro gift ends with it."}
              {" "}This can&apos;t be undone.
            </p>
            <p style={{ fontSize: 12, color: THEME.textMuted, lineHeight: 1.6, margin: "0 0 12px" }}>
              You&apos;ll confirm in the account window, under Security. If you unsubscribed from our emails, we keep a scrambled copy of your address only so we never email it again.
            </p>
            <button onClick={() => openUserProfile({ __experimental_startPath: "/security" })}
              style={{ ...smallBtn, color: THEME.ai, borderColor: `${THEME.ai}55`, background: THEME.surface1 }}>
              <Trash2 size={13} aria-hidden="true" /> Delete account…
            </button>
          </div>
        </Section>
      </div>

      <UpgradeModal isOpen={upgradeOpen} onClose={() => setUpgradeOpen(false)} currentPlan={plan} />
    </div>
  );
}

/** One plain sentence per way of holding a plan, and the one action that fits it. */
function PlanSummary({ status, founding, busy, onUpgrade, onPortal }: { status: PlanStatus; founding: boolean; busy: boolean; onUpgrade: () => void; onPortal: () => void }) {
  const upgradeBtn = (label: string) => (
    <button onClick={onUpgrade} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", background: THEME.gradient, color: "#fff", border: "none", borderRadius: 9, padding: "9px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer", boxShadow: glow(THEME.brand, 0.28), fontFamily: THEME.fontSans }}>
      {label}
    </button>
  );
  const free = PLANS.FREE, pro = PLANS.PRO;

  let pill: { label: string; icon: typeof Crown; gift?: boolean };
  let headline: string;
  let detail: string | null = null;
  let action: React.ReactNode = null;

  switch (status.kind) {
    case "free":
      pill = { label: "Free plan", icon: Zap };
      headline = `You're on Free: ${n(free.wordsLimit)} words and ${free.rewriteLimit} rewrite a day.`;
      detail = `Pro gives you ${n(pro.wordsLimit)} words a month, unlimited rewrites, every tone, file uploads and API access.`;
      action = upgradeBtn("Upgrade to Pro");
      break;
    case "gift":
      pill = { label: `${planName(status.plan)} · gift`, icon: Gift, gift: true };
      headline = `${planName(status.plan)}, free until ${longDate(status.until)} — a gift from the HumanizeIt team.`;
      detail = "After that you're back on Free unless you upgrade. No card is on file, so nothing will be charged.";
      action = upgradeBtn("Upgrade");
      break;
    case "founding":
      pill = { label: `${planName(status.plan)} plan`, icon: Sparkles };
      headline = `${planName(status.plan)} until ${longDate(status.until)}, as a Founding member.`;
      detail = "Paid once. It doesn't renew and nothing more will be charged.";
      break;
    case "gift_expired":
      pill = { label: "Free plan", icon: Zap };
      headline = `Your ${planName(status.plan)} gift ended on ${longDate(status.endedOn)}. You're on Free now.`;
      detail = `Free is ${n(free.wordsLimit)} words and ${free.rewriteLimit} rewrite a day. Upgrade to keep ${planName(status.plan)}'s ${n(PLANS[status.plan].wordsLimit)} words a month.`;
      action = upgradeBtn(`Upgrade to ${planName(status.plan)}`);
      break;
    case "complimentary":
      pill = { label: `${planName(status.plan)} plan`, icon: status.plan === "TEAM" ? Crown : Sparkles };
      headline = status.plan === "TEAM" ? "Team, through your organization's seat." : `${planName(status.plan)}, complimentary with no end date.`;
      detail = status.plan === "TEAM" ? "Your organization's owner manages billing." : "There's no billing on this account.";
      break;
    case "subscription": {
      const name = planName(status.plan);
      const cycle = status.interval === "year" ? "Annual" : status.interval === "month" ? "Monthly" : null;
      const end = status.periodEnd ? longDate(status.periodEnd) : null;
      pill = { label: cycle ? `${name} · ${cycle.toLowerCase()}` : `${name} plan`, icon: status.plan === "TEAM" ? Crown : Sparkles };
      headline = `${name}${cycle ? `, billed ${cycle === "Annual" ? "yearly" : "monthly"}` : ""}.`;
      detail =
        status.status === "cancelled" ? (end ? `Cancelled: ${name} ends on ${end}, then you're on Free. You won't be charged again.` : `Cancelled: ${name} ends at the end of this billing period.`)
        : status.status === "past_due" ? "Your last payment failed. Update your card to keep your plan."
        : status.status === "paused" ? "Paused: no charges and no paid features until you resume."
        : status.status === "on_trial" ? (end ? `Free trial. Your first payment is on ${end}.` : "Free trial.")
        : end ? `Renews on ${end}.` : null;
      action = (
        <button onClick={onPortal} disabled={busy} style={smallBtn}>
          <CreditCard size={13} aria-hidden="true" /> {busy ? "Opening…" : "Manage subscription"}
        </button>
      );
      break;
    }
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 7, background: pill.gift ? THEME.accentDim : status.kind === "free" || status.kind === "gift_expired" ? THEME.surface3 : THEME.brandDim, border: `1px solid ${pill.gift ? THEME.accent + "44" : isOnFree(status) ? THEME.border : THEME.brand + "44"}`, borderRadius: 100, padding: "5px 12px" }}>
          <pill.icon size={13} color={pill.gift ? THEME.accentHi : isOnFree(status) ? THEME.textMuted : THEME.brand} aria-hidden="true" />
          <span style={{ fontSize: 12, fontWeight: 700, color: pill.gift ? THEME.accentHi : isOnFree(status) ? THEME.textDim : THEME.brandHi }}>{pill.label}</span>
        </span>
        {founding && <FoundingBadge size="md" />}
      </div>
      <p style={{ fontSize: 15, fontWeight: 600, color: THEME.text, lineHeight: 1.5, margin: "0 0 4px" }}>{headline}</p>
      {detail && <p style={{ fontSize: 13, color: THEME.textDim, lineHeight: 1.6, margin: 0 }}>{detail}</p>}
      {action && <div style={{ marginTop: 14 }}>{action}</div>}
      {status.kind === "subscription" && (
        <p style={{ fontSize: 12, color: THEME.textMuted, margin: "8px 0 0" }}>Change plan, update your card, get invoices or cancel.</p>
      )}
    </div>
  );
}

// onlyIfOn: offered only on the paused-checkout notice, so here it is just the way back out.
const TOPIC_ROWS: { topic: Topic; label: string; onlyIfOn?: boolean }[] = [
  { topic: "tips", label: CONSENT_WORDING["inapp-tips-v1"] },
  { topic: "extension_launch", label: CONSENT_WORDING["ext-v1"] },
  { topic: "checkout_open", label: CONSENT_WORDING["checkout-v1"], onlyIfOn: true },
];

/** Each toggle saves at once, as a delta, so it can never touch a topic it doesn't show. */
function EmailPreferences() {
  const [prefs, setPrefs] = useState<EmailPrefs | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch("/api/me/email-preferences")
      .then((r) => (r.ok ? (r.json() as Promise<EmailPrefs>) : null))
      .then((d) => { if (alive && d) setPrefs(d); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  async function save(change: { subscribe?: Topic[]; unsubscribe?: Topic[]; lifecycleEmails?: boolean }) {
    setSaving(true);
    try {
      const res = await fetch("/api/me/email-preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...change, source: "settings" }),
      });
      if (!res.ok) throw new Error(String(res.status));
      setPrefs((await res.json()) as EmailPrefs);
      toast.success("Email preferences saved");
    } catch {
      toast.error("Couldn't save your email preferences.");
    } finally {
      setSaving(false);
    }
  }

  if (!prefs) return <div style={{ fontSize: 13, color: THEME.textMuted }}>Loading…</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {TOPIC_ROWS.map(({ topic, label, onlyIfOn }) => {
        const on = prefs.topics.includes(topic);
        if (onlyIfOn && !on) return null;
        const pending = !on && prefs.pendingTopics.includes(topic);
        return (
          <PrefRow key={topic} checked={on} disabled={saving} label={label}
            hint={pending ? "Waiting for you to confirm from the email we sent. Ticking it here subscribes you now." : undefined}
            onChange={(next) => save(next ? { subscribe: [topic] } : { unsubscribe: [topic] })} />
        );
      })}
      <PrefRow checked={prefs.lifecycleEmails} disabled={saving}
        label="Account emails: getting-started tips and notices about your plan, such as before complimentary access ends."
        onChange={(next) => save({ lifecycleEmails: next })} />
      <div style={{ fontSize: 12, color: THEME.textMuted, overflowWrap: "anywhere" }}>{`Emails go to ${prefs.email}.`}</div>
    </div>
  );
}

function PrefRow({ checked, disabled, label, hint, onChange }: { checked: boolean; disabled: boolean; label: string; hint?: string; onChange: (next: boolean) => void }) {
  return (
    <label style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 13, color: THEME.text, cursor: disabled ? "wait" : "pointer", lineHeight: 1.5 }}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} style={{ marginTop: 3, accentColor: THEME.brand }} />
      <span>
        {label}
        {hint && <span style={{ display: "block", fontSize: 12, color: THEME.textMuted }}>{hint}</span>}
      </span>
    </label>
  );
}

function Section({ title, icon: Icon, accent, sub, children }: { title: string; icon: typeof Crown; accent: string; sub?: string; children: React.ReactNode }) {
  return (
    <section style={{ background: THEME.surface2, border: `1px solid ${THEME.border}`, borderRadius: THEME.radiusLg, overflow: "hidden" }}>
      <div style={{ padding: "14px clamp(14px, 4vw, 18px)", borderBottom: `1px solid ${THEME.border}`, display: "flex", alignItems: "center", gap: 9 }}>
        <Icon size={15} color={accent} aria-hidden="true" style={{ flexShrink: 0 }} />
        <div>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: THEME.text, fontFamily: THEME.fontHeading, letterSpacing: "-0.01em", margin: 0 }}>{title}</h2>
          {sub && <p style={{ fontSize: 12, color: THEME.textMuted, margin: "2px 0 0" }}>{sub}</p>}
        </div>
      </div>
      <div style={{ padding: "clamp(14px, 4vw, 18px)" }}>{children}</div>
    </section>
  );
}

function UsageBar({ label, used, limit }: { label: string; used: number; limit: number }) {
  const unlimited = limit < 0;
  const pct = unlimited || limit === 0 ? 0 : Math.min(100, Math.round((used / limit) * 100));
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 12, marginBottom: 5 }}>
        <span style={{ color: THEME.textDim, fontWeight: 500 }}>{label}</span>
        <span className="tnum" style={{ color: THEME.textMuted }}>{unlimited ? `${n(used)} used · unlimited` : `${n(used)} of ${n(limit)} used`}</span>
      </div>
      <div role="progressbar" aria-label={`${label} used`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={unlimited ? undefined : pct}
        style={{ height: 6, background: THEME.surface3, borderRadius: 999 }}>
        <div style={{ height: 6, width: `${unlimited ? 6 : pct}%`, background: pct > 90 ? THEME.warn : THEME.brand, borderRadius: 999, transition: "width .4s ease" }} />
      </div>
    </div>
  );
}

const smallBtn: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 6, background: THEME.surface3, color: THEME.text, border: `1px solid ${THEME.border}`, borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: THEME.fontSans };
