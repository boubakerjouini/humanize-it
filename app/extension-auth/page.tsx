"use client";

import { useUser, SignIn } from "@clerk/nextjs";
import { useEffect, useState } from "react";

const V = {
  bg: "#09090b",
  card: "#0e0e12",
  border: "rgba(139,92,246,0.2)",
  violet: "#8b5cf6",
  white: "#fafafa",
  muted: "#a0a0b0",
};

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
    background: V.bg,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "system-ui, -apple-system, sans-serif",
    padding: "24px",
  };

  const cardStyle: React.CSSProperties = {
    background: V.card,
    border: `1px solid ${V.border}`,
    borderRadius: "16px",
    padding: "32px",
    maxWidth: "420px",
    width: "100%",
    textAlign: "center",
  };

  return (
    <div style={containerStyle}>
      {/* Logo */}
      <div style={{ marginBottom: "28px", textAlign: "center" }}>
        <div style={{ fontSize: "26px", fontWeight: 800, letterSpacing: "-0.5px" }}>
          <span style={{ color: V.violet }}>H.</span>
          <span style={{ color: V.white }}>HumanizeIt</span>
        </div>
        <div style={{ color: V.muted, fontSize: "13px", marginTop: "4px" }}>
          Chrome Extension · Connect your account
        </div>
      </div>

      <div style={cardStyle}>
        {/* Loading */}
        {!isLoaded && (
          <p style={{ color: V.muted, fontSize: "14px", margin: 0 }}>Loading...</p>
        )}

        {/* Not signed in — show Clerk SignIn (no routing prop, no afterSignInUrl) */}
        {isLoaded && !isSignedIn && (
          <div>
            <p style={{ color: V.white, fontSize: "15px", fontWeight: 600, marginBottom: "8px" }}>
              Sign in to continue
            </p>
            <p style={{ color: V.muted, fontSize: "13px", marginBottom: "24px" }}>
              Link your HumanizeIt account to the extension.
            </p>
            <SignIn />
          </div>
        )}

        {/* Signed in — fetching token */}
        {isLoaded && isSignedIn && status === "loading" && (
          <>
            <div style={{ fontSize: "36px", marginBottom: "12px" }}>⚡</div>
            <p style={{ color: V.white, fontSize: "16px", fontWeight: 600, margin: "0 0 8px" }}>
              Connecting...
            </p>
            <p style={{ color: V.muted, fontSize: "13px", margin: 0 }}>
              Generating secure token for the extension.
            </p>
          </>
        )}

        {/* Success */}
        {isLoaded && isSignedIn && status === "done" && (
          <>
            <div style={{ fontSize: "48px", marginBottom: "12px" }}>✅</div>
            <p style={{ color: V.white, fontSize: "18px", fontWeight: 700, margin: "0 0 8px" }}>
              Connected!
            </p>
            <p style={{ color: V.muted, fontSize: "13px", margin: "0 0 16px" }}>
              The extension is now linked to your account.
            </p>
            <p style={{ color: V.violet, fontSize: "12px", margin: 0 }}>
              You can close this tab.
            </p>
          </>
        )}

        {/* Error */}
        {isLoaded && isSignedIn && status === "error" && (
          <>
            <div style={{ fontSize: "40px", marginBottom: "12px" }}>❌</div>
            <p style={{ color: "#ef4444", fontSize: "16px", fontWeight: 600, margin: "0 0 8px" }}>
              Something went wrong
            </p>
            <p style={{ color: V.muted, fontSize: "13px", margin: "0 0 16px" }}>
              {errorMsg}
            </p>
            <button
              onClick={() => setStatus("idle")}
              style={{
                background: V.violet,
                color: V.white,
                border: "none",
                borderRadius: "8px",
                padding: "10px 20px",
                cursor: "pointer",
                fontWeight: 600,
                fontSize: "13px",
              }}
            >
              Retry
            </button>
          </>
        )}
      </div>
    </div>
  );
}
