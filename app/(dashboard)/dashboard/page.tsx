"use client";

import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import Link from "next/link";
import { Zap, ArrowRight, FileText, Clock, TrendingUp, Sparkles } from "lucide-react";
import { OnboardingChecklist } from "@/components/ui/onboarding-checklist";
import { THEME, humanScore, humanScoreColor, glow } from "@/lib/theme";

interface UsageData {
  plan: string;
  wordsUsed: number;
  wordsLimit: number;
  rewriteCount: number;
  rewriteLimit: number;
  quotaResetAt: string;
}

interface Document {
  id: string;
  originalText: string;
  overallScore: number;
  wordCount: number;
  rewrittenText: string | null;
  createdAt: string;
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (mins > 0) return `${mins}m ago`;
  return "just now";
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export default function DashboardHomePage() {
  const { user } = useUser();
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [docs, setDocs] = useState<Document[]>([]);
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  useEffect(() => {
    fetch("/api/usage").then(r => r.json()).then(setUsage).catch(() => null);
  }, []);

  useEffect(() => {
    if (usage?.plan && usage.plan !== "FREE") {
      fetch("/api/documents?limit=3").then(r => r.json()).then(d => setDocs(d.documents ?? [])).catch(() => null);
    }
  }, [usage?.plan]);

  const handleUpgrade = async () => {
    setCheckoutLoading(true);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: "PRO" }),
      });
      const data = await res.json() as { url?: string };
      if (data.url) window.location.href = data.url;
    } catch { /* ignore */ }
    finally { setCheckoutLoading(false); }
  };

  const isFree = !usage || usage.plan === "FREE";
  const firstName = user?.firstName || user?.emailAddresses?.[0]?.emailAddress?.split("@")[0] || "there";
  const wordsPct = usage ? Math.min(100, Math.round((usage.wordsUsed / usage.wordsLimit) * 100)) : 0;

  return (
    <div style={{ padding: "32px 24px", maxWidth: "860px", margin: "0 auto", fontFamily: THEME.fontSans }}>

      {/* Onboarding checklist */}
      <OnboardingChecklist />

      {/* Greeting */}
      <div style={{ marginBottom: "32px" }}>
        <h1 style={{ fontSize: "28px", fontWeight: 700, color: THEME.text, marginBottom: "6px", letterSpacing: "-0.02em", fontFamily: THEME.fontHeading }}>
          {getGreeting()}, {firstName}
        </h1>
        <p style={{ fontSize: "14px", color: THEME.textDim }}>
          {isFree ? "You're on the Free plan — upgrade anytime to unlock more." : `You're on the ${usage?.plan} plan.`}
        </p>
      </div>

      {/* Stats grid */}
      <div className="stats-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px", marginBottom: "28px" }}>

        {/* Words used */}
        <div style={{ background: THEME.surface2, border: `1px solid ${THEME.border}`, borderRadius: THEME.radiusLg, padding: "20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
            <TrendingUp size={15} color={THEME.brand} aria-hidden="true" />
            <span style={{ fontSize: "12px", color: THEME.textDim, fontWeight: 600 }}>Words used</span>
          </div>
          {usage ? (
            <>
              <div className="tnum" style={{ fontSize: "28px", fontWeight: 700, color: THEME.text, lineHeight: 1, marginBottom: "8px" }}>
                {usage.wordsUsed.toLocaleString()}
              </div>
              <div style={{ fontSize: "11px", color: THEME.textDim, marginBottom: "10px" }}>
                of {usage.wordsLimit.toLocaleString()} {isFree ? "today" : "this month"}
              </div>
              <div style={{ height: "4px", background: THEME.surface3, borderRadius: "4px" }}>
                <div style={{ height: "4px", borderRadius: "4px", width: `${wordsPct}%`, background: wordsPct > 80 ? THEME.ai : THEME.brand, transition: "width 0.6s ease" }} />
              </div>
            </>
          ) : (
            <div style={{ height: "60px", background: THEME.surface3, borderRadius: "6px" }} />
          )}
        </div>

        {/* Rewrites */}
        <div style={{ background: THEME.surface2, border: `1px solid ${THEME.border}`, borderRadius: THEME.radiusLg, padding: "20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
            <Sparkles size={15} color={THEME.brand} aria-hidden="true" />
            <span style={{ fontSize: "12px", color: THEME.textDim, fontWeight: 600 }}>Rewrites</span>
          </div>
          {usage ? (
            <>
              <div className="tnum" style={{ fontSize: "28px", fontWeight: 700, color: THEME.text, lineHeight: 1, marginBottom: "8px" }}>
                {usage.rewriteCount}
              </div>
              <div style={{ fontSize: "11px", color: THEME.textDim }}>
                of {usage.rewriteLimit === -1 ? "unlimited" : usage.rewriteLimit}
              </div>
            </>
          ) : (
            <div style={{ height: "60px", background: THEME.surface3, borderRadius: "6px" }} />
          )}
        </div>

        {/* Quota reset */}
        <div style={{ background: THEME.surface2, border: `1px solid ${THEME.border}`, borderRadius: THEME.radiusLg, padding: "20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
            <Clock size={15} color={THEME.brand} aria-hidden="true" />
            <span style={{ fontSize: "12px", color: THEME.textDim, fontWeight: 600 }}>Quota resets</span>
          </div>
          {usage ? (
            <>
              <div className="tnum" style={{ fontSize: "16px", fontWeight: 700, color: THEME.text, lineHeight: 1.3, marginBottom: "4px" }}>
                {new Date(usage.quotaResetAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </div>
              <div style={{ fontSize: "11px", color: THEME.textDim }}>
                {new Date(usage.quotaResetAt) > new Date() ? `in ${Math.ceil((new Date(usage.quotaResetAt).getTime() - Date.now()) / 86400000)} days` : "soon"}
              </div>
            </>
          ) : (
            <div style={{ height: "60px", background: THEME.surface3, borderRadius: "6px" }} />
          )}
        </div>

        {/* Plan */}
        <div style={{ background: THEME.surface2, border: `1px solid ${THEME.border}`, borderRadius: THEME.radiusLg, padding: "20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
            <Zap size={15} color={THEME.accent} aria-hidden="true" />
            <span style={{ fontSize: "12px", color: THEME.textDim, fontWeight: 600 }}>Plan</span>
          </div>
          {usage ? (
            <>
              <div style={{ fontSize: "22px", fontWeight: 700, color: isFree ? THEME.textDim : THEME.text, lineHeight: 1, marginBottom: "8px", fontFamily: THEME.fontHeading, textTransform: "capitalize" }}>
                {usage.plan.toLowerCase()}
              </div>
              <Link href="/dashboard/settings" style={{
                display: "inline-flex", alignItems: "center", gap: "4px",
                fontSize: "12px", fontWeight: 600,
                color: isFree ? THEME.accentHi : THEME.brandHi, textDecoration: "none",
              }}>
                {isFree ? "Upgrade" : "Manage"} <ArrowRight size={12} aria-hidden="true" />
              </Link>
            </>
          ) : (
            <div style={{ height: "60px", background: THEME.surface3, borderRadius: "6px" }} />
          )}
        </div>
      </div>

      {/* Main CTA */}
      <Link href="/dashboard/editor" style={{ textDecoration: "none", display: "block", marginBottom: "28px" }}>
        <div style={{
          background: THEME.surface2,
          border: `1px solid ${THEME.border}`, borderRadius: THEME.radiusXl,
          padding: "28px 32px",
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px",
          cursor: "pointer", transition: "border-color 0.2s, box-shadow 0.2s, transform 0.2s",
          boxShadow: glow(THEME.brand, 0.16),
        }}>
          <div>
            <div style={{ fontSize: "18px", fontWeight: 700, color: THEME.text, marginBottom: "6px", fontFamily: THEME.fontHeading }}>
              Start humanizing
            </div>
            <div style={{ fontSize: "13px", color: THEME.textDim, lineHeight: 1.5 }}>
              Paste your AI-generated text and get an instant score + humanization
            </div>
          </div>
          <div style={{
            width: "48px", height: "48px", borderRadius: "14px", flexShrink: 0,
            background: THEME.gradient,
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: glow(THEME.brand, 0.32),
          }}>
            <ArrowRight size={22} color="#ffffff" aria-hidden="true" />
          </div>
        </div>
      </Link>

      {/* Upgrade banner — FREE only */}
      {usage && isFree && (
        <div style={{
          background: THEME.surface2,
          border: `1px solid ${THEME.border}`, borderRadius: THEME.radiusXl,
          padding: "20px 24px", marginBottom: "28px",
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px", flexWrap: "wrap",
          boxShadow: glow(THEME.accent, 0.14),
        }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
              <span style={{ fontSize: "15px", fontWeight: 700, color: THEME.text, fontFamily: THEME.fontHeading }}>
                Unlock Pro
              </span>
              <span style={{
                fontSize: "11px", fontWeight: 700, color: THEME.accentHi,
                background: THEME.accentDim, padding: "2px 8px", borderRadius: "100px",
              }}>
                $9/month
              </span>
            </div>
            <div style={{ fontSize: "13px", color: THEME.textDim }}>
              50k words/month · Unlimited rewrites · History · All tones
            </div>
          </div>
          <button
            onClick={() => void handleUpgrade()}
            disabled={checkoutLoading}
            style={{
              display: "inline-flex", alignItems: "center", gap: "6px",
              padding: "11px 22px", borderRadius: "12px", border: "none",
              background: THEME.accent,
              color: "#ffffff", fontSize: "13px", fontWeight: 700,
              cursor: checkoutLoading ? "not-allowed" : "pointer",
              flexShrink: 0,
              boxShadow: glow(THEME.accent, 0.34),
            }}
          >
            {checkoutLoading ? "Loading…" : <>Upgrade now <ArrowRight size={15} aria-hidden="true" /></>}
          </button>
        </div>
      )}

      {/* Recent documents — PRO/TEAM */}
      {!isFree && (
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
            <h2 style={{ fontSize: "15px", fontWeight: 700, color: THEME.text, fontFamily: THEME.fontHeading, letterSpacing: "-0.01em" }}>Recent documents</h2>
            <Link href="/dashboard/history" style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "12px", fontWeight: 600, color: THEME.brandHi, textDecoration: "none" }}>View all <ArrowRight size={12} aria-hidden="true" /></Link>
          </div>
          {docs.length === 0 ? (
            <div style={{
              background: THEME.surface2, border: `1px dashed ${THEME.borderStrong}`,
              borderRadius: THEME.radiusXl, padding: "48px 32px", textAlign: "center",
            }}>
              <div style={{
                width: "48px", height: "48px", borderRadius: "12px",
                background: THEME.surface3, border: `1px solid ${THEME.border}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                margin: "0 auto 14px",
              }}>
                <FileText size={22} color={THEME.textMuted} aria-hidden="true" />
              </div>
              <p style={{ fontSize: "13px", color: THEME.textDim, fontWeight: 500 }}>No documents yet</p>
              <p style={{ fontSize: "12px", color: THEME.textMuted, marginTop: "4px" }}>Analyze your first text to get started</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {docs.map(doc => {
                const human = humanScore(doc.overallScore);
                return (
                <Link key={doc.id} href={`/dashboard/editor?doc=${doc.id}`} style={{ textDecoration: "none" }}>
                  <div style={{
                    background: THEME.surface2, border: `1px solid ${THEME.border}`,
                    borderRadius: THEME.radiusLg, padding: "14px 16px",
                    display: "flex", alignItems: "center", gap: "14px",
                    transition: "border-color 0.15s, box-shadow 0.15s",
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{
                        fontSize: "13px", color: THEME.textDim, lineHeight: 1.5,
                        overflow: "hidden", display: "-webkit-box",
                        WebkitLineClamp: 1, WebkitBoxOrient: "vertical",
                      }}>
                        {doc.originalText}
                      </p>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "5px" }}>
                        <span style={{ fontSize: "11px", color: THEME.textMuted }}>{doc.wordCount} words</span>
                        <span style={{ fontSize: "11px", color: THEME.textMuted }}>{timeAgo(doc.createdAt)}</span>
                        {doc.rewrittenText && (
                          <span style={{
                            display: "inline-flex", alignItems: "center", gap: "4px",
                            fontSize: "10px", fontWeight: 600, color: THEME.human,
                            background: THEME.humanDim, padding: "2px 8px", borderRadius: "100px",
                          }}>
                            <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: THEME.human }} aria-hidden="true" />
                            Humanized
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="tnum" style={{
                      fontSize: "14px", fontWeight: 700, color: humanScoreColor(human),
                      background: THEME.surface3, padding: "4px 10px", borderRadius: "8px", flexShrink: 0,
                    }}>
                      {human}
                    </span>
                  </div>
                </Link>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
