"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth, SignInButton } from "@clerk/nextjs";
import { Building2, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { THEME, glow } from "@/lib/theme";

interface InviteInfo {
  organizationName: string;
  email: string;
  role: string;
  status: string;
  usable: boolean;
}

export default function InviteAcceptPage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const { isSignedIn, isLoaded } = useAuth();
  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/invitations/${token}`)
      .then(async r => {
        const d = await r.json();
        if (!r.ok) { setError(d.error?.message ?? "Invalid invitation."); return; }
        setInfo(d as InviteInfo);
      })
      .catch(() => setError("Could not load this invitation."))
      .finally(() => setLoading(false));
  }, [token]);

  const accept = useCallback(async () => {
    setAccepting(true);
    try {
      const res = await fetch(`/api/invitations/${token}/accept`, { method: "POST" });
      const d = await res.json() as { error?: { message: string } };
      if (!res.ok) { setError(d.error?.message ?? "Could not accept the invitation."); return; }
      router.push("/dashboard/organization");
    } catch { setError("Network error. Please try again."); }
    finally { setAccepting(false); }
  }, [token, router]);

  return (
    <div style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: 24, background: THEME.bg, fontFamily: THEME.fontSans }}>
      <div style={{ width: "100%", maxWidth: 440, background: THEME.surface2, border: `1px solid ${THEME.border}`, borderRadius: THEME.radiusXl, padding: "36px 32px", textAlign: "center", boxShadow: glow(THEME.brand, 0.16) }}>
        {loading ? (
          <Loader2 size={24} color={THEME.brand} style={{ animation: "spin 0.8s linear infinite" }} aria-hidden="true" />
        ) : error ? (
          <>
            <XCircle size={40} color={THEME.ai} style={{ marginBottom: 14 }} aria-hidden="true" />
            <h1 style={{ fontSize: 18, fontWeight: 700, color: THEME.text, marginBottom: 8, fontFamily: THEME.fontHeading }}>Invitation problem</h1>
            <p style={{ fontSize: 14, color: THEME.textDim, marginBottom: 20 }}>{error}</p>
            <Link href="/dashboard" style={{ fontSize: 13, fontWeight: 600, color: THEME.brandHi, textDecoration: "none" }}>Go to dashboard →</Link>
          </>
        ) : info ? (
          <>
            <div style={{ width: 52, height: 52, borderRadius: 15, background: THEME.gradient, display: "grid", placeItems: "center", margin: "0 auto 18px", boxShadow: glow(THEME.brand, 0.28) }}>
              <Building2 size={24} color="#fff" aria-hidden="true" />
            </div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: THEME.text, marginBottom: 8, fontFamily: THEME.fontHeading, letterSpacing: "-0.02em" }}>
              Join {info.organizationName}
            </h1>
            <p style={{ fontSize: 14, color: THEME.textDim, lineHeight: 1.6, marginBottom: 24 }}>
              You&apos;ve been invited as {info.role === "ADMIN" ? "an admin" : "a member"}. Accepting takes a seat and unlocks full features.
            </p>

            {!info.usable ? (
              <div style={{ padding: "12px 16px", borderRadius: 10, background: THEME.warnDim, color: THEME.warn, fontSize: 13, fontWeight: 600 }}>
                This invitation is {info.status.toLowerCase()}.
              </div>
            ) : !isLoaded ? (
              <Loader2 size={18} style={{ animation: "spin 0.8s linear infinite" }} aria-hidden="true" />
            ) : isSignedIn ? (
              <button onClick={accept} disabled={accepting} style={{
                width: "100%", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7,
                padding: "12px", borderRadius: 12, border: "none", background: THEME.brand, color: "#fff",
                fontSize: 14, fontWeight: 700, cursor: accepting ? "not-allowed" : "pointer", boxShadow: glow(THEME.brand, 0.3),
              }}>
                {accepting ? <Loader2 size={16} style={{ animation: "spin 0.8s linear infinite" }} aria-hidden="true" /> : <CheckCircle2 size={16} aria-hidden="true" />}
                Accept invitation
              </button>
            ) : (
              <SignInButton mode="modal" forceRedirectUrl={`/invite/${token}`}>
                <button style={{
                  width: "100%", padding: "12px", borderRadius: 12, border: "none", background: THEME.brand, color: "#fff",
                  fontSize: 14, fontWeight: 700, cursor: "pointer", boxShadow: glow(THEME.brand, 0.3),
                }}>
                  Sign in to accept
                </button>
              </SignInButton>
            )}
          </>
        ) : null}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
