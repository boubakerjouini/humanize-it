"use client";

import Link from "next/link";
import { THEME } from "@/lib/theme";

const V = {
  brand: THEME.brand,
  brandHover: THEME.brandHi,
  brandBorder: "rgba(124,92,255,0.25)",
  brandGlow: "rgba(124,92,255,0.18)",
};

const PLANS = [
  {
    name: "Starter",
    price: "$49",
    desc: "For individual writers",
    features: ["10,000 words / month", "Unlimited rewrites", "Standard tone", "Email support"],
    popular: false,
  },
  {
    name: "Pro",
    price: "$99",
    desc: "For power users",
    features: ["50,000 words / month", "Unlimited rewrites", "All 4 tone modes", "Priority support", "30-day history"],
    popular: true,
  },
  {
    name: "Agency",
    price: "$149",
    desc: "For teams & agencies",
    features: ["200,000 words / month", "Unlimited rewrites", "API access", "Unlimited history", "Dedicated support"],
    popular: false,
  },
];

export default function LifetimePage() {
  return (
    <div style={{
      background: THEME.bg,
      minHeight: "100vh",
      color: THEME.text,
      fontFamily: THEME.fontSans,
    }}>
      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @media (max-width: 768px) {
          .ltd-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      {/* Navbar */}
      <nav style={{
        height: "56px",
        display: "flex", alignItems: "center",
        borderBottom: `1px solid ${THEME.border}`,
        background: THEME.surface1,
      }}>
        <div style={{
          maxWidth: "1140px", margin: "0 auto", padding: "0 24px",
          width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: "7px", textDecoration: "none" }}>
            <span style={{ fontSize: "19px", fontWeight: 800, color: THEME.brand, letterSpacing: "-0.5px", lineHeight: 1, fontFamily: THEME.fontHeading }}>H.</span>
            <span style={{ fontSize: "14px", fontWeight: 600, color: THEME.text, fontFamily: THEME.fontHeading }}>Humanize<span style={{ color: THEME.brandHi }}>It</span></span>
          </Link>
          <Link href="/" style={{
            fontSize: "13px", color: THEME.textDim, textDecoration: "none",
          }}>
            &larr; Back to home
          </Link>
        </div>
      </nav>

      {/* Header */}
      <section style={{ padding: "80px 24px 20px", textAlign: "center" }}>
        <div style={{ maxWidth: "700px", margin: "0 auto" }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: "6px",
            background: THEME.aiDim, border: `1px solid ${THEME.ai}`,
            borderRadius: "100px", padding: "5px 14px", marginBottom: "24px",
            fontSize: "12px", color: THEME.ai, fontWeight: 600,
            fontFamily: THEME.fontMono, letterSpacing: "0.04em", textTransform: "uppercase",
          }}>
            Limited to 150 users
          </div>
          <h1 style={{
            fontSize: "clamp(32px, 5vw, 52px)",
            fontWeight: 800, letterSpacing: "-2px",
            color: THEME.text, marginBottom: "16px",
            fontFamily: THEME.fontHeading,
            lineHeight: 1.1,
          }}>
            Lifetime Deal
          </h1>
          <p style={{
            fontSize: "17px", color: THEME.textDim, lineHeight: 1.7,
            maxWidth: "520px", margin: "0 auto 48px",
          }}>
            Pay once, use forever. Lock in your lifetime access to HumanizeIt before spots run out.
          </p>
        </div>
      </section>

      {/* Pricing cards */}
      <section style={{ padding: "0 24px 80px" }}>
        <div className="ltd-grid" style={{
          maxWidth: "960px", margin: "0 auto",
          display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "20px",
        }}>
          {PLANS.map((plan, i) => (
            <div key={plan.name} style={{
              background: THEME.surface2,
              border: plan.popular ? `1px solid ${THEME.brand}` : `1px solid ${THEME.border}`,
              borderRadius: "16px",
              padding: "32px 24px",
              position: "relative",
              boxShadow: plan.popular
                ? "0 0 0 1px rgba(124,92,255,0.3), 0 8px 40px rgba(124,92,255,0.2)"
                : "0 1px 3px rgba(0,0,0,0.4)",
              opacity: 0,
              animation: `fadeInUp 0.5s ease ${i * 0.1}s forwards`,
            }}>
              {plan.popular && (
                <div style={{
                  position: "absolute", top: "-12px", left: "50%", transform: "translateX(-50%)",
                  background: THEME.brand, color: "#ffffff",
                  fontSize: "11px", fontWeight: 700,
                  padding: "3px 14px", borderRadius: "100px",
                  whiteSpace: "nowrap",
                  fontFamily: THEME.fontMono, letterSpacing: "0.04em", textTransform: "uppercase",
                  boxShadow: "0 0 18px rgba(124,92,255,0.45)",
                }}>
                  Most Popular
                </div>
              )}

              <div style={{ fontSize: "12px", color: THEME.textDim, marginBottom: "4px" }}>
                {plan.desc}
              </div>
              <div style={{ fontSize: "16px", fontWeight: 700, color: plan.popular ? THEME.brandHi : THEME.text, marginBottom: "16px", fontFamily: THEME.fontHeading }}>
                {plan.name}
              </div>

              <div style={{ display: "flex", alignItems: "baseline", gap: "4px", marginBottom: "4px" }}>
                <span style={{ fontSize: "44px", fontWeight: 800, color: THEME.text, letterSpacing: "-2px", fontFamily: THEME.fontMono, fontVariantNumeric: "tabular-nums" }}>
                  {plan.price}
                </span>
              </div>
              <div style={{ fontSize: "13px", color: THEME.textDim, marginBottom: "24px" }}>
                one-time payment
              </div>

              <ul style={{ listStyle: "none", padding: 0, margin: "0 0 28px", display: "flex", flexDirection: "column", gap: "10px" }}>
                {plan.features.map((f) => (
                  <li key={f} style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: THEME.textDim }}>
                    <span style={{ color: THEME.human, fontSize: "12px", flexShrink: 0 }}>{"\u2713"}</span>
                    {f}
                  </li>
                ))}
              </ul>

              <a
                href={`mailto:boubakerseddik.jouini@gmail.com?subject=LTD - ${plan.name.toUpperCase()}`}
                style={{
                  display: "block", width: "100%", textAlign: "center",
                  padding: "12px", borderRadius: THEME.radius,
                  fontSize: "13px", fontWeight: 700,
                  background: plan.popular ? THEME.brand : "transparent",
                  color: plan.popular ? "#ffffff" : THEME.text,
                  border: plan.popular ? "none" : `1px solid ${THEME.borderStrong}`,
                  textDecoration: "none",
                  boxSizing: "border-box",
                  cursor: "pointer",
                  boxShadow: plan.popular ? "0 0 22px rgba(124,92,255,0.4)" : "none",
                }}
              >
                Get {plan.name} Lifetime
              </a>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer style={{
        borderTop: `1px solid ${THEME.border}`,
        padding: "24px",
        textAlign: "center",
      }}>
        <p style={{ fontSize: "12px", color: THEME.textDim }}>
          &copy; 2026 HumanizeIt &middot;{" "}
          <Link href="/" style={{ color: THEME.textDim, textDecoration: "none" }}>Home</Link> &middot;{" "}
          <a href="/privacy" style={{ color: THEME.textDim, textDecoration: "none" }}>Privacy</a> &middot;{" "}
          <a href="/terms" style={{ color: THEME.textDim, textDecoration: "none" }}>Terms</a>
        </p>
      </footer>
    </div>
  );
}
