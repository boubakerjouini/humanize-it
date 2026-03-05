"use client";

import { useUser, SignIn } from "@clerk/nextjs";
import { useState, useEffect } from "react";

export default function ExtensionAuthPage() {
  const { isSignedIn, isLoaded } = useUser();
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;

    async function fetchToken() {
      setStatus("loading");
      try {
        const res = await fetch("/api/extension-token", { method: "POST" });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Failed to get token");
        }
        const { token } = await res.json();
        localStorage.setItem("humanizeit_ext_token", token);
        setStatus("success");
        setTimeout(() => window.close(), 2000);
      } catch (e: any) {
        setErrorMsg(e.message || "Something went wrong");
        setStatus("error");
      }
    }

    fetchToken();
  }, [isLoaded, isSignedIn]);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#09090b",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      <div style={{ marginBottom: 32, textAlign: "center" }}>
        <span style={{ fontSize: 32, fontWeight: 700, color: "#8b5cf6" }}>H.</span>
        <span style={{ fontSize: 32, fontWeight: 700, color: "#fafafa", marginLeft: 4 }}>
          HumanizeIt
        </span>
      </div>

      <div
        style={{
          background: "#0e0e12",
          borderRadius: 16,
          padding: 32,
          minWidth: 380,
          textAlign: "center",
        }}
      >
        {!isLoaded && (
          <p style={{ color: "#a0a0b0", fontSize: 14 }}>Loading...</p>
        )}

        {isLoaded && !isSignedIn && (
          <div>
            <p style={{ color: "#fafafa", fontSize: 16, marginBottom: 20 }}>
              Sign in to connect the extension
            </p>
            <SignIn routing="hash" afterSignInUrl="/extension-auth" />
          </div>
        )}

        {isLoaded && isSignedIn && status === "loading" && (
          <p style={{ color: "#a0a0b0", fontSize: 14 }}>Generating token...</p>
        )}

        {isLoaded && isSignedIn && status === "success" && (
          <div>
            <div style={{ fontSize: 48, marginBottom: 12 }}>&#10003;</div>
            <p style={{ color: "#fafafa", fontSize: 18, fontWeight: 600 }}>
              Extension connected!
            </p>
            <p style={{ color: "#a0a0b0", fontSize: 14, marginTop: 8 }}>
              This tab will close automatically...
            </p>
          </div>
        )}

        {isLoaded && isSignedIn && status === "error" && (
          <div>
            <p style={{ color: "#ef4444", fontSize: 16 }}>{errorMsg}</p>
            <button
              onClick={() => window.location.reload()}
              style={{
                marginTop: 16,
                padding: "10px 24px",
                background: "#8b5cf6",
                color: "#fafafa",
                border: "none",
                borderRadius: 8,
                cursor: "pointer",
                fontSize: 14,
                fontWeight: 600,
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
