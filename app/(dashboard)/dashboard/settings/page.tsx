"use client";

import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { toast } from "sonner";
import { Sparkles, Crown, Zap, CreditCard, Gift, Key, User as UserIcon, AlertTriangle, ArrowUpRight, ExternalLink, Mail, Users } from "lucide-react";
import { THEME, glow } from "@/lib/theme";
import { ApiKeysSection } from "@/components/workspace/api-keys-section";
import { UpgradeModal } from "@/components/ui/upgrade-modal";
import { ReferralCard, useReferralInfo } from "@/components/growth/referral-card";
import { CONSENT_WORDING, type Topic } from "@/lib/growth/constants";

interface UsageData {
  plan: string;
  wordsUsed: number;
  wordsLimit: number;
  rewriteCount: number;
  rewriteLimit: number;
  quotaResetAt: string;
  subscriptionStatus: string | null;
  stripeCurrentPeriodEnd: string | null;
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

function fmt(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "—";
}

/** quotaResetAt is the last reset: Free resets 24 hours later, paid plans a month later (lib/quota.ts). */
function nextReset(usage: UsageData): string {
  const at = new Date(usage.quotaResetAt);
  if (Number.isNaN(at.getTime())) return "—";
  if (usage.plan === "FREE") {
    at.setDate(at.getDate() + 1);
    return at.toLocaleString("en-US", { month: "long", day: "numeric", hour: "numeric", minute: "2-digit" });
  }
  at.setMonth(at.getMonth() + 1);
  return fmt(at.toISOString());
}

export default function SettingsPage() {
  const { user } = useUser();
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [redeem, setRedeem] = useState("");
  const [busy, setBusy] = useState<"portal" | "redeem" | null>(null);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const referral = useReferralInfo();

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

  const plan = usage?.plan ?? "FREE";
  const meta = PLAN_META[plan] ?? PLAN_META.FREE;
  const isFree = plan === "FREE";
  const pastDue = usage?.subscriptionStatus === "past_due";

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "28px 24px 64px", fontFamily: THEME.fontSans }}>
      <h1 style={{ fontSize: 26, fontWeight: 800, color: THEME.text, fontFamily: THEME.fontHeading, letterSpacing: "-0.02em", margin: "0 0 4px" }}>Settings</h1>
      <p style={{ fontSize: 14, color: THEME.textDim, margin: "0 0 22px" }}>Your plan, usage, billing, and developer access.</p>

      {pastDue && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, background: THEME.aiDim, border: `1px solid ${THEME.ai}55`, borderRadius: THEME.radius, padding: "12px 16px", marginBottom: 16 }}>
          <AlertTriangle size={16} color={THEME.ai} aria-hidden="true" />
          <span style={{ fontSize: 13, color: THEME.text, flex: 1 }}>Your last payment failed. Update your billing to keep Pro features.</span>
          <button onClick={portal} style={smallBtn}>Fix billing</button>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {/* Plan & usage */}
        <Section title="Plan & usage" icon={meta.icon} accent={meta.color}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18, flexWrap: "wrap", gap: 10 }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 7, background: isFree ? THEME.surface3 : THEME.brandDim, border: `1px solid ${isFree ? THEME.border : THEME.brand + "44"}`, borderRadius: 100, padding: "5px 12px" }}>
              <meta.icon size={13} color={meta.color} aria-hidden="true" />
              <span style={{ fontSize: 12, fontWeight: 700, color: isFree ? THEME.textDim : THEME.brandHi }}>{meta.label} plan</span>
            </span>
            {isFree ? (
              <button onClick={checkout} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: THEME.gradient, color: "#fff", border: "none", borderRadius: 9, padding: "9px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer", boxShadow: glow(THEME.brand, 0.28) }}>
                Upgrade to Pro <ArrowUpRight size={14} aria-hidden="true" />
              </button>
            ) : (
              <button onClick={portal} disabled={busy === "portal"} style={smallBtn}><CreditCard size={13} aria-hidden="true" /> Manage billing</button>
            )}
          </div>
          {usage && (
            <>
              <UsageBar label="Words" used={usage.wordsUsed} limit={usage.wordsLimit} />
              <UsageBar label="Rewrites" used={usage.rewriteCount} limit={usage.rewriteLimit} />
              {(usage.bonusWords ?? 0) > 0 && (
                <div className="tnum" style={{ fontSize: 12, color: THEME.accentHi, fontWeight: 600, marginTop: 2 }}>
                  {`+${(usage.bonusWords ?? 0).toLocaleString("en-US")} bonus words, used once your plan's words run out`}
                </div>
              )}
              <div style={{ fontSize: 12, color: THEME.textMuted, marginTop: 10 }}>
                Words reset {nextReset(usage)}{usage.stripeCurrentPeriodEnd ? ` · renews ${fmt(usage.stripeCurrentPeriodEnd)}` : ""}
              </div>
            </>
          )}
        </Section>

        {/* Redeem */}
        <Section title="Redeem a code" icon={Gift} accent={THEME.accent}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input value={redeem} onChange={(e) => setRedeem(e.target.value.toUpperCase())} placeholder="HUMAN-PRO-XXXX" aria-label="Discount code"
              style={{ flex: 1, minWidth: 200, border: `1px solid ${THEME.border}`, borderRadius: 8, padding: "9px 12px", fontSize: 13, color: THEME.text, background: THEME.surface1, outline: "none", fontFamily: THEME.fontMono, textTransform: "uppercase" }} />
            <button onClick={applyCode} disabled={busy === "redeem" || !redeem.trim()} style={{ background: redeem.trim() ? THEME.brand : THEME.surface3, color: redeem.trim() ? "#fff" : THEME.textMuted, border: "none", borderRadius: 8, padding: "9px 18px", fontSize: 13, fontWeight: 700, cursor: redeem.trim() ? "pointer" : "not-allowed" }}>
              {busy === "redeem" ? "Redeeming…" : "Redeem"}
            </button>
          </div>
        </Section>

        {/* Invite friends (only while the referral program is on) */}
        {referral && (
          <div id="invite" style={{ scrollMarginTop: 24 }}>
            <Section title="Invite friends" icon={Users} accent={THEME.accent} sub={`You both get ${referral.rewardWords.toLocaleString("en-US")} bonus words.`}>
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
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
            <div>
              <div style={{ fontSize: 13, color: THEME.text, fontWeight: 600 }}>{user?.fullName || user?.firstName || "Your account"}</div>
              <div style={{ fontSize: 13, color: THEME.textDim }}>{user?.primaryEmailAddress?.emailAddress ?? "—"}</div>
            </div>
          </div>
        </Section>
      </div>

      <UpgradeModal isOpen={upgradeOpen} onClose={() => setUpgradeOpen(false)} currentPlan={plan} />
    </div>
  );
}

const TOPIC_ROWS: { topic: Topic; label: string }[] = [
  { topic: "tips", label: CONSENT_WORDING["inapp-tips-v1"] },
  { topic: "extension_launch", label: CONSENT_WORDING["ext-v1"] },
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
      {TOPIC_ROWS.map(({ topic, label }) => {
        const on = prefs.topics.includes(topic);
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
      <div style={{ fontSize: 12, color: THEME.textMuted }}>{`Emails go to ${prefs.email}.`}</div>
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
    <div style={{ background: THEME.surface2, border: `1px solid ${THEME.border}`, borderRadius: THEME.radiusLg, overflow: "hidden" }}>
      <div style={{ padding: "14px 18px", borderBottom: `1px solid ${THEME.border}`, display: "flex", alignItems: "center", gap: 9 }}>
        <Icon size={15} color={accent} aria-hidden="true" />
        <div>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: THEME.text, fontFamily: THEME.fontHeading, letterSpacing: "-0.01em", margin: 0 }}>{title}</h2>
          {sub && <p style={{ fontSize: 12, color: THEME.textMuted, margin: "2px 0 0" }}>{sub}</p>}
        </div>
      </div>
      <div style={{ padding: 18 }}>{children}</div>
    </div>
  );
}

function UsageBar({ label, used, limit }: { label: string; used: number; limit: number }) {
  const unlimited = limit < 0;
  const pct = unlimited || limit === 0 ? 0 : Math.min(100, Math.round((used / limit) * 100));
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 5 }}>
        <span style={{ color: THEME.textDim, fontWeight: 500 }}>{label}</span>
        <span className="tnum" style={{ color: THEME.textMuted }}>{unlimited ? `${used.toLocaleString()} · unlimited` : `${used.toLocaleString()} / ${limit.toLocaleString()}`}</span>
      </div>
      <div style={{ height: 6, background: THEME.surface3, borderRadius: 999 }}>
        <div style={{ height: 6, width: `${unlimited ? 6 : pct}%`, background: pct > 90 ? THEME.warn : THEME.brand, borderRadius: 999, transition: "width .4s ease" }} />
      </div>
    </div>
  );
}

const smallBtn: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 6, background: THEME.surface3, color: THEME.text, border: `1px solid ${THEME.border}`, borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: THEME.fontSans };
