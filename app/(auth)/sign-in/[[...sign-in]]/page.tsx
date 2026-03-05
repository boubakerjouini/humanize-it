import { SignIn } from "@clerk/nextjs";
import Link from "next/link";

const clerkAppearance = {
  variables: {
    colorPrimary: "#8b5cf6",
    colorBackground: "#0e0e12",
    colorInputBackground: "#09090b",
    colorInputText: "#fafafa",
    colorText: "#fafafa",
    colorTextSecondary: "#a0a0b0",
    colorDanger: "#ef4444",
    colorSuccess: "#22c55e",
    borderRadius: "8px",
    fontFamily: "system-ui, -apple-system, sans-serif",
  },
  elements: {
    card: {
      background: "#0e0e12",
      border: "1px solid rgba(139,92,246,0.2)",
      boxShadow: "0 0 40px rgba(139,92,246,0.08)",
      borderRadius: "16px",
    },
    headerTitle: { color: "#fafafa", fontSize: "20px", fontWeight: "700" },
    headerSubtitle: { color: "#a0a0b0" },
    socialButtonsBlockButton: {
      background: "#1a1a2e",
      border: "1px solid rgba(255,255,255,0.08)",
      color: "#fafafa",
      "&:hover": { background: "#22223a" },
    },
    formFieldInput: {
      background: "#09090b",
      border: "1px solid rgba(255,255,255,0.1)",
      color: "#fafafa",
      "&:focus": { borderColor: "#8b5cf6" },
    },
    formButtonPrimary: {
      background: "#8b5cf6",
      "&:hover": { background: "#7c3aed" },
    },
    footerActionLink: { color: "#8b5cf6" },
    dividerLine: { background: "rgba(255,255,255,0.06)" },
    dividerText: { color: "#6b6b80" },
  },
};

export default function SignInPage() {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      minHeight: "100vh", background: "#09090b", position: "relative", overflow: "hidden",
    }}>
      <div style={{
        position: "absolute", top: "20%", left: "50%", transform: "translateX(-50%)",
        width: "600px", height: "600px",
        background: "radial-gradient(circle, rgba(139,92,246,0.12) 0%, transparent 70%)",
        filter: "blur(60px)", pointerEvents: "none", zIndex: 0,
      }} />
      <div style={{
        position: "absolute", bottom: "10%", left: "30%",
        width: "400px", height: "400px",
        background: "radial-gradient(circle, rgba(139,92,246,0.08) 0%, transparent 70%)",
        filter: "blur(80px)", pointerEvents: "none", zIndex: 0,
      }} />
      <div style={{ marginBottom: "24px", textAlign: "center", position: "relative", zIndex: 1 }}>
        <span style={{ fontSize: "24px", fontWeight: 800, color: "#8b5cf6" }}>H.</span>
        <span style={{ fontSize: "16px", fontWeight: 600, color: "#fafafa", marginLeft: "6px" }}>HumanizeIt</span>
      </div>
      <div style={{ position: "relative", zIndex: 1 }}>
        <SignIn appearance={clerkAppearance} routing="path" path="/sign-in" signUpUrl="/sign-up" afterSignInUrl="/dashboard/editor" redirectUrl="/dashboard/editor" />
      </div>
      <Link href="/" style={{ fontSize: "12px", color: "rgba(255,255,255,0.35)", textDecoration: "none", marginTop: "20px", position: "relative", zIndex: 1 }}>
        ← Back to home
      </Link>
    </div>
  );
}
