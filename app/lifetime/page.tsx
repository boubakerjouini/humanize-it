"use client";

import Link from "next/link";

const V = {
  brand: "#7e22ce",
  brandHover: "#9333ea",
  brandBorder: "rgba(126,34,206,0.15)",
  brandGlow: "rgba(126,34,206,0.1)",
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
      background: "#ffffff",
      minHeight: "100vh",
      color: "#111827",
      fontFamily: "Inter, -apple-system, sans-serif",
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
        borderBottom: "1px solid #e5e7eb",
        background: "#ffffff",
      }}>
        <div style={{
          maxWidth: "1140px", margin: "0 auto", padding: "0 24px",
          width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: "7px", textDecoration: "none" }}>
            <span style={{ fontSize: "19px", fontWeight: 800, color: "#3b0764", letterSpacing: "-0.5px", lineHeight: 1 }}>H.</span>
            <span style={{ fontSize: "14px", fontWeight: 600, color: "#3b0764" }}>Humanize<span style={{ color: "#9333ea" }}>It</span></span>
          </Link>
          <Link href="/" style={{
            fontSize: "13px", color: "#6b7280", textDecoration: "none",
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
            background: "#fef2f2", border: "1px solid #fecaca",
            borderRadius: "100px", padding: "5px 14px", marginBottom: "24px",
            fontSize: "12px", color: "#dc2626", fontWeight: 600,
          }}>
            Limited to 150 users
          </div>
          <h1 style={{
            fontSize: "clamp(32px, 5vw, 52px)",
            fontWeight: 800, letterSpacing: "-2px",
            color: "#3b0764", marginBottom: "16px",
            fontFamily: "var(--font-heading)",
            lineHeight: 1.1,
          }}>
            Lifetime Deal
          </h1>
          <p style={{
            fontSize: "17px", color: "#6b7280", lineHeight: 1.7,
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
              background: plan.popular ? V.brand : "#ffffff",
              border: plan.popular ? `1px solid ${V.brand}` : "1px solid #e5e7eb",
              borderRadius: "16px",
              padding: "32px 24px",
              position: "relative",
              boxShadow: plan.popular ? "0 4px 12px rgba(126,34,206,0.2)" : "0 1px 3px rgba(0,0,0,0.06)",
              opacity: 0,
              animation: `fadeInUp 0.5s ease ${i * 0.1}s forwards`,
            }}>
              {plan.popular && (
                <div style={{
                  position: "absolute", top: "-12px", left: "50%", transform: "translateX(-50%)",
                  background: "#ffffff", color: V.brand,
                  fontSize: "11px", fontWeight: 700,
                  padding: "3px 14px", borderRadius: "100px",
                  whiteSpace: "nowrap",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                }}>
                  Most Popular
                </div>
              )}

              <div style={{ fontSize: "12px", color: plan.popular ? "rgba(255,255,255,0.7)" : "#6b7280", marginBottom: "4px" }}>
                {plan.desc}
              </div>
              <div style={{ fontSize: "16px", fontWeight: 700, color: plan.popular ? "#ffffff" : "#111827", marginBottom: "16px" }}>
                {plan.name}
              </div>

              <div style={{ display: "flex", alignItems: "baseline", gap: "4px", marginBottom: "4px" }}>
                <span style={{ fontSize: "44px", fontWeight: 800, color: plan.popular ? "#ffffff" : "#111827", letterSpacing: "-2px" }}>
                  {plan.price}
                </span>
              </div>
              <div style={{ fontSize: "13px", color: plan.popular ? "rgba(255,255,255,0.7)" : "#6b7280", marginBottom: "24px" }}>
                one-time payment
              </div>

              <ul style={{ listStyle: "none", padding: 0, margin: "0 0 28px", display: "flex", flexDirection: "column", gap: "10px" }}>
                {plan.features.map((f) => (
                  <li key={f} style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: plan.popular ? "rgba(255,255,255,0.85)" : "#4b5563" }}>
                    <span style={{ color: plan.popular ? "#ffffff" : V.brand, fontSize: "12px", flexShrink: 0 }}>{"\u2713"}</span>
                    {f}
                  </li>
                ))}
              </ul>

              <a
                href={`mailto:boubakerseddik.jouini@gmail.com?subject=LTD - ${plan.name.toUpperCase()}`}
                style={{
                  display: "block", width: "100%", textAlign: "center",
                  padding: "12px", borderRadius: "12px",
                  fontSize: "13px", fontWeight: 700,
                  background: plan.popular ? "#ffffff" : "transparent",
                  color: plan.popular ? V.brand : "#4b5563",
                  border: plan.popular ? "none" : "1px solid #e5e7eb",
                  textDecoration: "none",
                  boxSizing: "border-box",
                  cursor: "pointer",
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
        borderTop: "1px solid #e5e7eb",
        padding: "24px",
        textAlign: "center",
      }}>
        <p style={{ fontSize: "12px", color: "#9ca3af" }}>
          &copy; 2026 HumanizeIt &middot;{" "}
          <Link href="/" style={{ color: "#6b7280", textDecoration: "none" }}>Home</Link> &middot;{" "}
          <a href="/privacy" style={{ color: "#6b7280", textDecoration: "none" }}>Privacy</a> &middot;{" "}
          <a href="/terms" style={{ color: "#6b7280", textDecoration: "none" }}>Terms</a>
        </p>
      </footer>
    </div>
  );
}
