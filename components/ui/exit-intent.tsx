"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

export function ExitIntent() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem("humanizeit_exit_shown") === "true") return;

    const handler = (e: MouseEvent) => {
      if (e.clientY < 10) {
        setShow(true);
        localStorage.setItem("humanizeit_exit_shown", "true");
        document.removeEventListener("mouseout", handler);
      }
    };

    document.addEventListener("mouseout", handler);
    return () => document.removeEventListener("mouseout", handler);
  }, []);

  if (!show) return null;

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "rgba(0,0,0,0.5)",
        animation: "fadeIn 0.2s ease",
      }}
      onClick={() => setShow(false)}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#ffffff", borderRadius: "24px",
          boxShadow: "0 25px 50px rgba(0,0,0,0.25)",
          maxWidth: "420px", width: "90%",
          padding: "40px 32px", textAlign: "center",
          position: "relative",
          animation: "fadeInUp 0.3s ease",
        }}
      >
        <button
          onClick={() => setShow(false)}
          style={{
            position: "absolute", top: "14px", right: "14px",
            background: "transparent", border: "none",
            fontSize: "20px", color: "#9ca3af", cursor: "pointer",
            width: "32px", height: "32px", display: "flex",
            alignItems: "center", justifyContent: "center",
            borderRadius: "8px",
          }}
          aria-label="Close"
        >
          &times;
        </button>

        <div style={{
          fontSize: "40px", marginBottom: "16px",
        }}>
          {"\u270B"}
        </div>

        <h3 style={{
          fontSize: "22px", fontWeight: 800, color: "#3b0764",
          marginBottom: "10px", letterSpacing: "-0.5px",
          fontFamily: "var(--font-heading)",
        }}>
          Wait — Get 500 free words before you go
        </h3>

        <p style={{
          fontSize: "14px", color: "#6b7280", lineHeight: 1.6,
          marginBottom: "24px",
        }}>
          Paste any AI text, get a detection score, and humanize it — completely free. No credit card required.
        </p>

        <Link
          href="/sign-up"
          style={{
            display: "inline-block",
            background: "linear-gradient(135deg, #7e22ce, #9333ea)",
            color: "#ffffff", fontWeight: 700,
            padding: "14px 32px", borderRadius: "12px",
            fontSize: "15px", textDecoration: "none",
            boxShadow: "0 4px 12px rgba(126,34,206,0.3)",
          }}
        >
          Claim 500 Free Words
        </Link>
      </div>
    </div>
  );
}
