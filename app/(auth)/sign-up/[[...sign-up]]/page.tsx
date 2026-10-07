// ===========================================================
// /sign-up — Clerk sign-up, plus what we'll email (account mail only; tips
// are opt-in later) and, while the referral program is on, a note for
// visitors who arrive with a valid ?ref= code.
// ===========================================================

import { SignUp } from "@clerk/nextjs";
import Link from "next/link";
import { THEME, glow } from "@/lib/theme";
import { normalizeRef } from "@/lib/growth/attribution";
import { referralsEnabled } from "@/lib/growth/flags";
import { REFERRAL_REWARD_WORDS } from "@/lib/growth/referral-rules";

const clerkAppearance = {
  variables: {
    colorPrimary: THEME.brand,
    colorBackground: THEME.surface2,
    colorInputBackground: THEME.surface1,
    colorInputText: THEME.text,
    colorText: THEME.text,
    colorTextSecondary: THEME.textDim,
    colorDanger: THEME.ai,
    colorSuccess: THEME.human,
    borderRadius: THEME.radius,
    fontFamily: THEME.fontSans,
  },
  elements: {
    card: {
      background: THEME.surface2,
      border: `1px solid ${THEME.border}`,
      boxShadow: glow(THEME.brand, 0.18),
      borderRadius: THEME.radiusLg,
    },
    headerTitle: {
      color: THEME.text,
      fontSize: "20px",
      fontWeight: "700",
      fontFamily: THEME.fontHeading,
      letterSpacing: "-0.02em",
    },
    headerSubtitle: { color: THEME.textDim },
    socialButtonsBlockButton: {
      background: THEME.surface1,
      border: `1px solid ${THEME.border}`,
      color: THEME.text,
      "&:hover": { background: THEME.surface3 },
    },
    formFieldLabel: { color: THEME.textDim },
    formFieldInput: {
      background: THEME.surface1,
      border: `1px solid ${THEME.border}`,
      color: THEME.text,
      "&:focus": { borderColor: THEME.brand },
    },
    formButtonPrimary: {
      background: THEME.brand,
      "&:hover": { background: THEME.brandHi },
    },
    footerActionLink: { color: THEME.brandHi },
    footerActionText: { color: THEME.textDim },
    dividerLine: { background: THEME.border },
    dividerText: { color: THEME.textMuted },
    identityPreviewText: { color: THEME.text },
    identityPreviewEditButton: { color: THEME.brandHi },
  },
};

type Props = { searchParams: Promise<{ ref?: string | string[] }> };

export default async function SignUpPage({ searchParams }: Props) {
  const { ref } = await searchParams;
  const invited = referralsEnabled() && normalizeRef(typeof ref === "string" ? ref : null) !== undefined;
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      minHeight: "100vh", background: THEME.bg, position: "relative", overflow: "hidden",
    }}>
      <div style={{
        position: "absolute", top: "20%", left: "50%", transform: "translateX(-50%)",
        width: "600px", height: "600px",
        background: `radial-gradient(circle, ${THEME.brand}1f 0%, transparent 70%)`,
        filter: "blur(60px)", pointerEvents: "none", zIndex: 0,
      }} />
      <div style={{
        position: "absolute", bottom: "10%", left: "30%",
        width: "400px", height: "400px",
        background: `radial-gradient(circle, ${THEME.accent}14 0%, transparent 70%)`,
        filter: "blur(80px)", pointerEvents: "none", zIndex: 0,
      }} />
      <div style={{ marginBottom: "20px", textAlign: "center", position: "relative", zIndex: 1 }}>
        <div className="kicker" style={{ marginBottom: "14px" }}>Start free</div>
        <span style={{
          fontSize: "24px", fontWeight: 800, color: THEME.brand,
          fontFamily: THEME.fontHeading, letterSpacing: "-0.02em",
        }}>H<span style={{ color: THEME.accent }}>.</span></span>
        <span style={{
          fontSize: "16px", fontWeight: 600, color: THEME.text, marginLeft: "6px",
          fontFamily: THEME.fontHeading, letterSpacing: "-0.01em",
        }}>HumanizeIt</span>
      </div>
      {invited ? (
        <div
          role="note"
          style={{
            position: "relative", zIndex: 1, maxWidth: "400px", margin: "0 16px 16px", padding: "12px 16px",
            background: THEME.accentDim, border: `1px solid ${THEME.border}`, borderRadius: THEME.radius,
            fontSize: "14px", color: THEME.text, lineHeight: 1.5, textAlign: "center",
          }}
        >
          {`You were invited: you and your friend each get ${REFERRAL_REWARD_WORDS.toLocaleString("en-US")} bonus words after your first document.`}
        </div>
      ) : null}
      <div style={{ position: "relative", zIndex: 1 }}>
        <SignUp appearance={clerkAppearance} routing="path" path="/sign-up" signInUrl="/sign-in" forceRedirectUrl="/dashboard" fallbackRedirectUrl="/dashboard" />
      </div>
      <p style={{
        position: "relative", zIndex: 1, maxWidth: "400px", margin: "16px 16px 0", textAlign: "center",
        fontSize: "13px", color: THEME.textDim, lineHeight: 1.5,
      }}>
        We&apos;ll email you about your account. Tips and offers are opt-in: you choose in your dashboard.{" "}
        <Link href="/privacy" style={{ color: THEME.brandHi }}>Privacy Policy</Link>
      </p>
      <Link href="/" style={{
        fontSize: "13px", color: THEME.textDim, textDecoration: "none", marginTop: "20px",
        position: "relative", zIndex: 1, fontWeight: 500,
      }}>
        ← Back to home
      </Link>
    </div>
  );
}
