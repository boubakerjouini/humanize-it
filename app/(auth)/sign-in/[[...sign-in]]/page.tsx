import { SignIn } from "@clerk/nextjs";
import Link from "next/link";

const clerkAppearance = {
  variables: {
    colorPrimary: "#7e22ce",
    colorBackground: "#ffffff",
    colorInputBackground: "#f9fafb",
    colorInputText: "#111827",
    colorText: "#111827",
    colorTextSecondary: "#6b7280",
    colorDanger: "#dc2626",
    colorSuccess: "#16a34a",
    borderRadius: "8px",
    fontFamily: "system-ui, -apple-system, sans-serif",
  },
  elements: {
    card: {
      background: "#ffffff",
      border: "1px solid rgba(126,34,206,0.2)",
      boxShadow: "0 0 40px rgba(126,34,206,0.08)",
      borderRadius: "16px",
    },
    headerTitle: { color: "#111827", fontSize: "20px", fontWeight: "700" },
    headerSubtitle: { color: "#6b7280" },
    socialButtonsBlockButton: {
      background: "#f9fafb",
      border: "1px solid #e5e7eb",
      color: "#111827",
      "&:hover": { background: "#f3f4f6" },
    },
    formFieldInput: {
      background: "#f9fafb",
      border: "1px solid #e5e7eb",
      color: "#111827",
      "&:focus": { borderColor: "#7e22ce" },
    },
    formButtonPrimary: {
      background: "#7e22ce",
      "&:hover": { background: "#9333ea" },
    },
    footerActionLink: { color: "#7e22ce" },
    dividerLine: { background: "#e5e7eb" },
    dividerText: { color: "#9ca3af" },
  },
};

export default function SignInPage() {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      minHeight: "100vh", background: "#ffffff", position: "relative", overflow: "hidden",
    }}>
      <div style={{
        position: "absolute", top: "20%", left: "50%", transform: "translateX(-50%)",
        width: "600px", height: "600px",
        background: "radial-gradient(circle, rgba(126,34,206,0.08) 0%, transparent 70%)",
        filter: "blur(60px)", pointerEvents: "none", zIndex: 0,
      }} />
      <div style={{
        position: "absolute", bottom: "10%", left: "30%",
        width: "400px", height: "400px",
        background: "radial-gradient(circle, rgba(126,34,206,0.05) 0%, transparent 70%)",
        filter: "blur(80px)", pointerEvents: "none", zIndex: 0,
      }} />
      <div style={{ marginBottom: "24px", textAlign: "center", position: "relative", zIndex: 1 }}>
        <span style={{ fontSize: "24px", fontWeight: 800, color: "#7e22ce" }}>H.</span>
        <span style={{ fontSize: "16px", fontWeight: 600, color: "#111827", marginLeft: "6px" }}>HumanizeIt</span>
      </div>
      <div style={{ position: "relative", zIndex: 1 }}>
        <SignIn appearance={clerkAppearance} routing="path" path="/sign-in" signUpUrl="/sign-up" afterSignInUrl="/dashboard/editor" redirectUrl="/dashboard/editor" />
      </div>
      <Link href="/" style={{ fontSize: "12px", color: "#9ca3af", textDecoration: "none", marginTop: "20px", position: "relative", zIndex: 1 }}>
        ← Back to home
      </Link>
    </div>
  );
}
