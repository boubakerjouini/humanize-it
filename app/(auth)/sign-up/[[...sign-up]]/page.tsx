import { SignUp } from "@clerk/nextjs";
import Link from "next/link";

export default function SignUpPage() {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      minHeight: "100vh", background: "#09090b",
    }}>
      <div style={{ marginBottom: "24px", textAlign: "center" }}>
        <span style={{ fontSize: "24px", fontWeight: 800, color: "#8b5cf6" }}>H.</span>
        <span style={{ fontSize: "16px", fontWeight: 600, color: "#fafafa", marginLeft: "6px" }}>HumanizeIt</span>
      </div>
      <SignUp routing="path" path="/sign-up" signInUrl="/sign-in" />
      <Link href="/" style={{ fontSize: "12px", color: "rgba(255,255,255,0.35)", textDecoration: "none", marginTop: "20px" }}>
        ← Back to home
      </Link>
    </div>
  );
}
