"use client";

import { useUser, SignIn } from "@clerk/nextjs";
import { useEffect, useState } from "react";
import { Zap, CheckCircle2, XCircle } from "lucide-react";
import { THEME } from "@/lib/theme";

export default function ExtensionAuthPage() {
  const { isLoaded, isSignedIn } = useUser();
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!isLoaded || !isSignedIn || status !== "idle") return;
    setStatus("loading");

    fetch("/api/extension-token", { method: "POST" })
      .then((r) => r.json())
      .then((data) => {
        if (data.token) {
          // Store token for extension to pick up via scripting API
          localStorage.setItem("humanizeit_ext_token", data.token);
          setStatus("done");
          // Also try postMessage in case window was opened by script
          if (window.opener) {
            window.opener.postMessage(
              { type: "HUMANIZE_IT_TOKEN", token: data.token },
              "*"
            );
          }
        } else {
          setErrorMsg(data.error || "Failed to generate token");
          setStatus("error");
        }
      })
      .catch((e) => {
        setErrorMsg(e.message || "Network error");
        setStatus("error");
      });
  }, [isLoaded, isSignedIn, status]);

  const containerStyle: React.CSSProperties = {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: THEME.fontSans,
    padding: "24px",
  };

  const cardStyle: React.CSSProperties = {
    background: THEME.surface2,
    border: `1px solid ${THEME.border}`,
    borderRadius: THEME.radiusXl,
    padding: "32px",
    maxWidth: "420px",
    width: "100%",
    textAlign: "center",
    boxShadow: "0 0 40px rgba(124,92,255,0.10)",
  };

  return (
    <div style={containerStyle}>
      {/* Logo */}
      <div style={{ marginBottom: "28px", textAlign: "center" }}>
        <div style={{ fontSize: "26px", fontWeight: 800, letterSpacing: "-0.5px", fontFamily: THEME.fontHeading }}>
          <span style={{ color: THEME.brand }}>H.</span>
          <span style={{ color: THEME.text }}>HumanizeIt</span>
        </div>
        <div style={{ color: THEME.textDim, fontSize: "13px", marginTop: "4px", fontFamily: THEME.fontMono }}>
          Chrome Extension · Connect your account
        </div>
      </div>

      <div style={cardStyle}>
        {/* Loading */}
        {!isLoaded && (
          <p style={{ color: THEME.textDim, fontSize: "14px", margin: 0 }}>Loading...</p>
        )}

        {/* Not signed in — show Clerk SignIn (no routing prop, no afterSignInUrl) */}
        {isLoaded && !isSignedIn && (
          <div>
            <p style={{ color: THEME.text, fontSize: "15px", fontWeight: 600, marginBottom: "8px" }}>
              Sign in to continue
            </p>
            <p style={{ color: THEME.textDim, fontSize: "13px", marginBottom: "24px" }}>
              Link your HumanizeIt account to the extension.
            </p>
            <SignIn />
          </div>
        )}

        {/* Signed in — fetching token */}
        {isLoaded && isSignedIn && status === "loading" && (
          <div aria-live="polite">
            <Zap size={36} aria-hidden="true" style={{ color: THEME.brandHi, marginBottom: "12px" }} className="pulse-dot" />
            <p style={{ color: THEME.text, fontSize: "16px", fontWeight: 600, margin: "0 0 8px" }}>
              Connecting...
            </p>
            <p style={{ color: THEME.textDim, fontSize: "13px", margin: 0 }}>
              Generating secure token for the extension.
            </p>
          </div>
        )}

        {/* Success */}
        {isLoaded && isSignedIn && status === "done" && (
          <div aria-live="polite">
            <CheckCircle2 size={48} aria-hidden="true" style={{ color: THEME.human, marginBottom: "12px" }} />
            <p style={{ color: THEME.text, fontSize: "18px", fontWeight: 700, margin: "0 0 8px" }}>
              Connected!
            </p>
            <p style={{ color: THEME.textDim, fontSize: "13px", margin: "0 0 16px" }}>
              The extension is now linked to your account.
            </p>
            <p style={{ color: THEME.brandHi, fontSize: "12px", margin: 0, fontFamily: THEME.fontMono }}>
              You can close this tab.
            </p>
          </div>
        )}

        {/* Error */}
        {isLoaded && isSignedIn && status === "error" && (
          <div aria-live="polite">
            <XCircle size={40} aria-hidden="true" style={{ color: THEME.ai, marginBottom: "12px" }} />
            <p style={{ color: THEME.ai, fontSize: "16px", fontWeight: 600, margin: "0 0 8px" }}>
              Something went wrong
            </p>
            <p style={{ color: THEME.textDim, fontSize: "13px", margin: "0 0 16px" }}>
              {errorMsg}
            </p>
            <button
              onClick={() => setStatus("idle")}
              style={{
                background: THEME.brand,
                color: "#ffffff",
                border: "none",
                borderRadius: THEME.radius,
                padding: "10px 20px",
                cursor: "pointer",
                fontWeight: 600,
                fontSize: "13px",
              }}
            >
              Retry
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
