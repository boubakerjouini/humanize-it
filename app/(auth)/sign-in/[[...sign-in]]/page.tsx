import { SignIn } from "@clerk/nextjs";
import Link from "next/link";

export default function SignInPage() {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      minHeight: "100vh", background: "#09090b",
    }}>
      <div style={{ marginBottom: "24px", textAlign: "center" }}>
        <span style={{ fontSize: "24px", fontWeight: 800, color: "#8b5cf6" }}>H.</span>
        <span style={{ fontSize: "16px", fontWeight: 600, color: "#fafafa", marginLeft: "6px" }}>HumanizeIt</span>
      </div>
      <SignIn routing="path" path="/sign-in" signUpUrl="/sign-up" afterSignInUrl="/dashboard/editor" redirectUrl="/dashboard/editor" />
      <Link href="/" style={{ fontSize: "12px", color: "rgba(255,255,255,0.35)", textDecoration: "none", marginTop: "20px" }}>
        ← Back to home
      </Link>
    </div>
  );
}
