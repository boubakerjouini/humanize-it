import { SignIn } from "@clerk/nextjs";
import Link from "next/link";
import { THEME, glow } from "@/lib/theme";

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

export default function SignInPage() {
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
        <div className="kicker" style={{ marginBottom: "14px" }}>Welcome back</div>
        <span style={{
          fontSize: "24px", fontWeight: 800, color: THEME.brand,
          fontFamily: THEME.fontHeading, letterSpacing: "-0.02em",
        }}>H<span style={{ color: THEME.accent }}>.</span></span>
        <span style={{
          fontSize: "16px", fontWeight: 600, color: THEME.text, marginLeft: "6px",
          fontFamily: THEME.fontHeading, letterSpacing: "-0.01em",
        }}>HumanizeIt</span>
      </div>
      <div style={{ position: "relative", zIndex: 1 }}>
        <SignIn appearance={clerkAppearance} routing="path" path="/sign-in" signUpUrl="/sign-up" forceRedirectUrl="/dashboard" fallbackRedirectUrl="/dashboard" />
      </div>
      <Link href="/" style={{
        fontSize: "13px", color: THEME.textDim, textDecoration: "none", marginTop: "20px",
        position: "relative", zIndex: 1, fontWeight: 500,
      }}>
        ← Back to home
      </Link>
    </div>
  );
}
