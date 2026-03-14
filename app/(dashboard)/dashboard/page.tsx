"use client";

import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import Link from "next/link";
import { Zap, ArrowRight, FileText, Clock, TrendingUp, Sparkles } from "lucide-react";
import { OnboardingChecklist } from "@/components/ui/onboarding-checklist";

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

function scoreColor(s: number) {
  if (s >= 75) return "#dc2626";
  if (s >= 50) return "#d97706";
  if (s >= 30) return "#d97706";
  return "#16a34a";
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
    <div style={{ padding: "32px 24px", maxWidth: "860px", margin: "0 auto" }}>

      {/* Onboarding checklist */}
      <OnboardingChecklist />

      {/* Greeting */}
      <div style={{ marginBottom: "32px" }}>
        <h1 style={{ fontSize: "28px", fontWeight: 700, color: "#0a0a0a", marginBottom: "6px", letterSpacing: "-0.5px", fontFamily: "var(--font-heading)" }}>
          {getGreeting()}, {firstName}
        </h1>
        <p style={{ fontSize: "14px", color: "#737373" }}>
          {isFree ? "You're on the Free plan — upgrade anytime to unlock more." : `You're on the ${usage?.plan} plan.`}
        </p>
      </div>

      {/* Stats grid */}
      <div className="stats-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px", marginBottom: "28px" }}>

        {/* Words used */}
        <div style={{ background: "#ffffff", border: "1px solid #f0f0f0", borderRadius: "12px", padding: "20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
            <TrendingUp size={14} color="#7c3aed" />
            <span style={{ fontSize: "11px", color: "#a3a3a3", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>Words Used</span>
          </div>
          {usage ? (
            <>
              <div style={{ fontSize: "28px", fontWeight: 700, color: "#0a0a0a", lineHeight: 1, marginBottom: "8px", fontFamily: "var(--font-heading)" }}>
                {usage.wordsUsed.toLocaleString()}
              </div>
              <div style={{ fontSize: "11px", color: "#a3a3a3", marginBottom: "10px" }}>
                of {usage.wordsLimit.toLocaleString()} {isFree ? "today" : "this month"}
              </div>
              <div style={{ height: "4px", background: "#f5f5f5", borderRadius: "4px" }}>
                <div style={{ height: "4px", borderRadius: "4px", width: `${wordsPct}%`, background: wordsPct > 80 ? "#dc2626" : "#7c3aed", transition: "width 0.6s ease" }} />
              </div>
            </>
          ) : (
            <div style={{ height: "60px", background: "#f5f5f5", borderRadius: "6px" }} />
          )}
        </div>

        {/* Rewrites */}
        <div style={{ background: "#ffffff", border: "1px solid #f0f0f0", borderRadius: "12px", padding: "20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
            <Sparkles size={14} color="#7c3aed" />
            <span style={{ fontSize: "11px", color: "#a3a3a3", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>Rewrites</span>
          </div>
          {usage ? (
            <>
              <div style={{ fontSize: "28px", fontWeight: 700, color: "#0a0a0a", lineHeight: 1, marginBottom: "8px", fontFamily: "var(--font-heading)" }}>
                {usage.rewriteCount}
              </div>
              <div style={{ fontSize: "11px", color: "#a3a3a3" }}>
                of {usage.rewriteLimit === -1 ? "unlimited" : usage.rewriteLimit}
              </div>
            </>
          ) : (
            <div style={{ height: "60px", background: "#f5f5f5", borderRadius: "6px" }} />
          )}
        </div>

        {/* Quota reset */}
        <div style={{ background: "#ffffff", border: "1px solid #f0f0f0", borderRadius: "12px", padding: "20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
            <Clock size={14} color="#7c3aed" />
            <span style={{ fontSize: "11px", color: "#a3a3a3", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>Quota Resets</span>
          </div>
          {usage ? (
            <>
              <div style={{ fontSize: "16px", fontWeight: 700, color: "#0a0a0a", lineHeight: 1.3, marginBottom: "4px" }}>
                {new Date(usage.quotaResetAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </div>
              <div style={{ fontSize: "11px", color: "#a3a3a3" }}>
                {new Date(usage.quotaResetAt) > new Date() ? `in ${Math.ceil((new Date(usage.quotaResetAt).getTime() - Date.now()) / 86400000)} days` : "soon"}
              </div>
            </>
          ) : (
            <div style={{ height: "60px", background: "#f5f5f5", borderRadius: "6px" }} />
          )}
        </div>

        {/* Plan */}
        <div style={{ background: "#ffffff", border: "1px solid #f0f0f0", borderRadius: "12px", padding: "20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
            <Zap size={14} color="#7c3aed" />
            <span style={{ fontSize: "11px", color: "#a3a3a3", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>Plan</span>
          </div>
          {usage ? (
            <>
              <div style={{ fontSize: "22px", fontWeight: 700, color: isFree ? "#a3a3a3" : "#0a0a0a", lineHeight: 1, marginBottom: "8px", fontFamily: "var(--font-heading)" }}>
                {usage.plan}
              </div>
              <Link href="/dashboard/settings" style={{ fontSize: "11px", color: "#7c3aed", textDecoration: "none" }}>
                {isFree ? "Upgrade \u2192" : "Manage \u2192"}
              </Link>
            </>
          ) : (
            <div style={{ height: "60px", background: "#f5f5f5", borderRadius: "6px" }} />
          )}
        </div>
      </div>

      {/* Main CTA */}
      <Link href="/dashboard/editor" style={{ textDecoration: "none", display: "block", marginBottom: "28px" }}>
        <div style={{
          background: "linear-gradient(135deg, #faf5ff, #ede9fe)",
          border: "1px solid #ede9fe", borderRadius: "16px",
          padding: "28px 32px",
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px",
          cursor: "pointer", transition: "border-color 0.2s, box-shadow 0.2s",
        }}>
          <div>
            <div style={{ fontSize: "18px", fontWeight: 700, color: "#0a0a0a", marginBottom: "6px", fontFamily: "var(--font-heading)" }}>
              Start humanizing →
            </div>
            <div style={{ fontSize: "13px", color: "#737373", lineHeight: 1.5 }}>
              Paste your AI-generated text and get an instant score + humanization
            </div>
          </div>
          <div style={{
            width: "48px", height: "48px", borderRadius: "12px", flexShrink: 0,
            background: "linear-gradient(135deg, #7c3aed, #6d28d9)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <ArrowRight size={22} color="#ffffff" />
          </div>
        </div>
      </Link>

      {/* Upgrade banner — FREE only */}
      {usage && isFree && (
        <div style={{
          background: "linear-gradient(135deg, #faf5ff, #ede9fe)",
          border: "1px solid #ede9fe", borderRadius: "16px",
          padding: "20px 24px", marginBottom: "28px",
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px", flexWrap: "wrap",
        }}>
          <div>
            <div style={{ fontSize: "15px", fontWeight: 700, color: "#0a0a0a", marginBottom: "4px", fontFamily: "var(--font-heading)" }}>
              Unlock Pro — $9/month
            </div>
            <div style={{ fontSize: "13px", color: "#737373" }}>
              50k words/month · Unlimited rewrites · History · All tones
            </div>
          </div>
          <button
            onClick={() => void handleUpgrade()}
            disabled={checkoutLoading}
            style={{
              padding: "10px 24px", borderRadius: "12px", border: "none",
              background: "#7c3aed",
              color: "#ffffff", fontSize: "13px", fontWeight: 700,
              cursor: checkoutLoading ? "not-allowed" : "pointer",
              flexShrink: 0,
            }}
          >
            {checkoutLoading ? "Loading..." : "Upgrade Now \u2192"}
          </button>
        </div>
      )}

      {/* Recent documents — PRO/TEAM */}
      {!isFree && (
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
            <h2 style={{ fontSize: "14px", fontWeight: 600, color: "#525252" }}>Recent Documents</h2>
            <Link href="/dashboard/history" style={{ fontSize: "12px", color: "#7c3aed", textDecoration: "none" }}>View all \u2192</Link>
          </div>
          {docs.length === 0 ? (
            <div style={{
              background: "#ffffff", border: "1px dashed #e5e5e5",
              borderRadius: "16px", padding: "48px 32px", textAlign: "center",
            }}>
              <div style={{
                width: "48px", height: "48px", borderRadius: "12px",
                background: "#fafafa", border: "1px solid #f0f0f0",
                display: "flex", alignItems: "center", justifyContent: "center",
                margin: "0 auto 14px",
              }}>
                <FileText size={22} color="#d4d4d4" />
              </div>
              <p style={{ fontSize: "13px", color: "#a3a3a3", fontWeight: 500 }}>No documents yet</p>
              <p style={{ fontSize: "12px", color: "#d4d4d4", marginTop: "4px" }}>Analyze your first text to get started</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {docs.map(doc => (
                <Link key={doc.id} href={`/dashboard/editor?doc=${doc.id}`} style={{ textDecoration: "none" }}>
                  <div style={{
                    background: "#ffffff", border: "1px solid #f0f0f0",
                    borderRadius: "12px", padding: "14px 16px",
                    display: "flex", alignItems: "center", gap: "14px",
                    transition: "border-color 0.15s, box-shadow 0.15s",
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{
                        fontSize: "13px", color: "#525252", lineHeight: 1.5,
                        overflow: "hidden", display: "-webkit-box",
                        WebkitLineClamp: 1, WebkitBoxOrient: "vertical",
                      }}>
                        {doc.originalText}
                      </p>
                      <div style={{ display: "flex", gap: "10px", marginTop: "4px" }}>
                        <span style={{ fontSize: "11px", color: "#a3a3a3" }}>{doc.wordCount} words</span>
                        <span style={{ fontSize: "11px", color: "#d4d4d4" }}>{timeAgo(doc.createdAt)}</span>
                        {doc.rewrittenText && <span style={{ fontSize: "11px", color: "#16a34a", fontWeight: 600 }}>Humanized</span>}
                      </div>
                    </div>
                    <span style={{
                      fontSize: "14px", fontWeight: 800, color: scoreColor(doc.overallScore),
                      background: "#fafafa", padding: "4px 10px", borderRadius: "8px", flexShrink: 0,
                    }}>
                      {Math.round(doc.overallScore)}%
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
