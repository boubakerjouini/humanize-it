"use client";

import { useState, useEffect, useCallback } from "react";
import { Copy, Key, RefreshCw, Lock, CheckCircle2, Code2, Terminal, Braces } from "lucide-react";
import { toast } from "sonner";

interface ApiKeyData {
  id: string;
  key?: string;
  maskedKey: string;
  lastUsedAt: string | null;
  requestCount: number;
  createdAt: string;
}

interface ApiState {
  apiKey: ApiKeyData | null;
  usage: { requestCount: number; limit: number };
  plan: string;
  apiAccess: boolean;
}

type CodeTab = "curl" | "python" | "javascript";

const CODE_EXAMPLES: Record<CodeTab, string> = {
  curl: `# Analyze text
curl -X POST https://humanize-it.app/api/v1/analyze \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"text": "Your text to analyze..."}'

# Humanize text
curl -X POST https://humanize-it.app/api/v1/humanize \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"text": "Your text to humanize...", "tone": "standard"}'

# Check usage
curl https://humanize-it.app/api/v1/usage \\
  -H "Authorization: Bearer YOUR_API_KEY"`,

  python: `import requests

API_KEY = "YOUR_API_KEY"
BASE = "https://humanize-it.app/api/v1"
headers = {"Authorization": f"Bearer {API_KEY}"}

# Analyze text
resp = requests.post(f"{BASE}/analyze",
    headers=headers,
    json={"text": "Your text to analyze..."})
print(resp.json())
# → {"score": 78, "confidenceBand": "likely-ai", ...}

# Humanize text
resp = requests.post(f"{BASE}/humanize",
    headers=headers,
    json={"text": "Your text to humanize...", "tone": "standard"})
print(resp.json())
# → {"humanizedText": "...", "originalScore": 78}

# Check usage
resp = requests.get(f"{BASE}/usage", headers=headers)
print(resp.json())`,

  javascript: `const API_KEY = "YOUR_API_KEY";
const BASE = "https://humanize-it.app/api/v1";

// Analyze text
const analysis = await fetch(\`\${BASE}/analyze\`, {
  method: "POST",
  headers: {
    "Authorization": \`Bearer \${API_KEY}\`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ text: "Your text to analyze..." }),
}).then(r => r.json());
console.log(analysis);
// → { score: 78, confidenceBand: "likely-ai", ... }

// Humanize text
const result = await fetch(\`\${BASE}/humanize\`, {
  method: "POST",
  headers: {
    "Authorization": \`Bearer \${API_KEY}\`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ text: "Your text...", tone: "standard" }),
}).then(r => r.json());
console.log(result.humanizedText);

// Check usage
const usage = await fetch(\`\${BASE}/usage\`, {
  headers: { "Authorization": \`Bearer \${API_KEY}\` },
}).then(r => r.json());`,
};

const TAB_ICONS: Record<CodeTab, typeof Terminal> = {
  curl: Terminal,
  python: Code2,
  javascript: Braces,
};

export default function ApiPage() {
  const [state, setState] = useState<ApiState | null>(null);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [codeTab, setCodeTab] = useState<CodeTab>("curl");
  const [codeCopied, setCodeCopied] = useState(false);

  const fetchState = useCallback(async () => {
    try {
      const res = await fetch("/api/api-keys");
      const data = await res.json() as ApiState;
      setState(data);
    } catch {
      toast.error("Failed to load API key info.");
    }
  }, []);

  useEffect(() => { void fetchState(); }, [fetchState]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await fetch("/api/api-keys", { method: "POST" });
      const data = await res.json() as { apiKey?: ApiKeyData; error?: { message: string } };
      if (!res.ok) {
        toast.error(data.error?.message ?? "Failed to generate key.");
        return;
      }
      if (data.apiKey?.key) {
        setNewKey(data.apiKey.key);
        toast.success("New API key generated! Copy it now — it won't be shown again.");
      }
      void fetchState();
    } catch {
      toast.error("Network error.");
    } finally {
      setGenerating(false);
    }
  };

  const handleCopyKey = async () => {
    const keyToCopy = newKey ?? state?.apiKey?.maskedKey;
    if (!keyToCopy) return;
    await navigator.clipboard.writeText(keyToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyCode = async () => {
    const code = CODE_EXAMPLES[codeTab].replace(/YOUR_API_KEY/g, newKey ?? "sk_live_your_key_here");
    await navigator.clipboard.writeText(code);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  };

  if (!state) {
    return (
      <div style={{ padding: "40px 24px", color: "rgba(255,255,255,0.3)", fontSize: "14px" }}>
        Loading...
      </div>
    );
  }

  // FREE users see upgrade prompt
  if (!state.apiAccess) {
    return (
      <div style={{ minHeight: "100%", background: "#09090b", padding: "40px 24px" }}>
        <div style={{
          maxWidth: "480px", margin: "80px auto", textAlign: "center",
          background: "#0f0f12", borderRadius: "16px", padding: "40px 32px",
          border: "1px solid rgba(255,255,255,0.06)",
        }}>
          <Lock size={32} color="rgba(255,255,255,0.15)" style={{ margin: "0 auto 16px" }} />
          <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#fafafa", marginBottom: "8px" }}>
            API Access Required
          </h2>
          <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.4)", lineHeight: 1.6, marginBottom: "24px" }}>
            The Developer API is available on Pro (1,000 req/mo) and Team (10,000 req/mo) plans.
            Integrate AI detection and humanization directly into your workflow.
          </p>
          <a href="/dashboard/settings" style={{
            display: "inline-flex", alignItems: "center", gap: "8px",
            padding: "12px 24px", borderRadius: "10px",
            background: "linear-gradient(135deg, #8b5cf6, #7c3aed)",
            color: "#fff", fontSize: "14px", fontWeight: 700,
            textDecoration: "none",
            boxShadow: "0 4px 16px rgba(139,92,246,0.3)",
          }}>
            Upgrade Plan
          </a>
        </div>
      </div>
    );
  }

  const displayKey = newKey ?? state.apiKey?.maskedKey ?? "No key generated yet";
  const usagePercent = state.usage.limit > 0 ? Math.min(100, Math.round((state.usage.requestCount / state.usage.limit) * 100)) : 0;

  return (
    <div style={{ minHeight: "100%", background: "#09090b", padding: "24px" }}>
      <div style={{ maxWidth: "720px", margin: "0 auto" }}>

        {/* Header */}
        <div style={{ marginBottom: "28px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
            <Key size={16} color="#8b5cf6" />
            <h1 style={{ fontSize: "18px", fontWeight: 700, color: "#fafafa", margin: 0 }}>Developer API</h1>
          </div>
          <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.35)", margin: 0 }}>
            Integrate HumanizeIt detection and rewriting into your apps.
          </p>
        </div>

        {/* API Key Card */}
        <div style={{
          background: "#0f0f12", borderRadius: "14px",
          border: "1px solid rgba(255,255,255,0.06)", padding: "20px",
          marginBottom: "16px",
        }}>
          <div style={{ fontSize: "12px", fontWeight: 600, color: "rgba(255,255,255,0.5)", marginBottom: "12px" }}>
            Your API Key
          </div>

          <div style={{
            display: "flex", alignItems: "center", gap: "10px",
            background: "rgba(0,0,0,0.3)", borderRadius: "8px",
            padding: "12px 14px", border: "1px solid rgba(255,255,255,0.06)",
            marginBottom: "14px",
          }}>
            <code style={{
              flex: 1, fontSize: "13px", fontFamily: "monospace",
              color: newKey ? "#22c55e" : "rgba(255,255,255,0.5)",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {displayKey}
            </code>
            {(newKey || state.apiKey) && (
              <button onClick={() => void handleCopyKey()} style={{
                display: "flex", alignItems: "center", gap: "5px",
                background: copied ? "rgba(34,197,94,0.1)" : "rgba(255,255,255,0.05)",
                border: `1px solid ${copied ? "rgba(34,197,94,0.2)" : "rgba(255,255,255,0.08)"}`,
                borderRadius: "5px", padding: "5px 10px", cursor: "pointer",
                color: copied ? "#22c55e" : "rgba(255,255,255,0.45)", fontSize: "11px",
              }}>
                {copied ? <><CheckCircle2 size={10} /> Copied</> : <><Copy size={10} /> Copy</>}
              </button>
            )}
          </div>

          {newKey && (
            <div style={{
              fontSize: "11px", color: "#eab308", background: "rgba(234,179,8,0.08)",
              border: "1px solid rgba(234,179,8,0.15)", borderRadius: "6px",
              padding: "8px 12px", marginBottom: "14px",
            }}>
              Copy your key now — it won&apos;t be shown again after you leave this page.
            </div>
          )}

          <button
            onClick={() => void handleGenerate()}
            disabled={generating}
            style={{
              display: "flex", alignItems: "center", gap: "7px",
              padding: "10px 18px", borderRadius: "8px", border: "none",
              background: generating ? "rgba(139,92,246,0.12)" : "linear-gradient(135deg, #8b5cf6, #7c3aed)",
              color: generating ? "rgba(255,255,255,0.3)" : "#fff",
              fontSize: "13px", fontWeight: 600, cursor: generating ? "not-allowed" : "pointer",
              boxShadow: generating ? "none" : "0 2px 12px rgba(139,92,246,0.3)",
            }}
          >
            <RefreshCw size={13} className={generating ? "spin-sm" : ""} />
            {state.apiKey ? "Regenerate Key" : "Generate API Key"}
          </button>
        </div>

        {/* Usage Stats */}
        <div style={{
          background: "#0f0f12", borderRadius: "14px",
          border: "1px solid rgba(255,255,255,0.06)", padding: "20px",
          marginBottom: "16px",
        }}>
          <div style={{ fontSize: "12px", fontWeight: 600, color: "rgba(255,255,255,0.5)", marginBottom: "14px" }}>
            Usage This Month
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "14px" }}>
            <div style={{ background: "rgba(0,0,0,0.25)", borderRadius: "8px", padding: "12px" }}>
              <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.28)", marginBottom: "4px" }}>API Requests</div>
              <div style={{ fontSize: "22px", fontWeight: 800, color: "#fafafa" }}>
                {state.usage.requestCount.toLocaleString()}
              </div>
              <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.2)" }}>
                of {state.usage.limit.toLocaleString()} / month
              </div>
            </div>
            <div style={{ background: "rgba(0,0,0,0.25)", borderRadius: "8px", padding: "12px" }}>
              <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.28)", marginBottom: "4px" }}>Plan</div>
              <div style={{ fontSize: "22px", fontWeight: 800, color: "#8b5cf6" }}>
                {state.plan}
              </div>
              <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.2)" }}>
                {state.plan === "PRO" ? "1,000 req/mo" : "10,000 req/mo"}
              </div>
            </div>
          </div>
          <div style={{ height: "6px", borderRadius: "3px", background: "rgba(255,255,255,0.05)", overflow: "hidden" }}>
            <div style={{
              width: `${usagePercent}%`, height: "100%", borderRadius: "3px",
              background: usagePercent > 80 ? "#ef4444" : usagePercent > 50 ? "#eab308" : "#22c55e",
              transition: "width 0.6s ease",
            }} />
          </div>
        </div>

        {/* Code Examples */}
        <div style={{
          background: "#0f0f12", borderRadius: "14px",
          border: "1px solid rgba(255,255,255,0.06)", overflow: "hidden",
        }}>
          <div style={{
            padding: "14px 20px", borderBottom: "1px solid rgba(255,255,255,0.05)",
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "rgba(255,255,255,0.5)" }}>
              Code Examples
            </span>
            <div style={{ display: "flex", gap: "3px" }}>
              {(["curl", "python", "javascript"] as CodeTab[]).map((tab) => {
                const Icon = TAB_ICONS[tab];
                return (
                  <button key={tab} onClick={() => setCodeTab(tab)} style={{
                    display: "flex", alignItems: "center", gap: "5px",
                    padding: "5px 10px", borderRadius: "5px", fontSize: "11px", fontWeight: 500, cursor: "pointer",
                    border: `1px solid ${codeTab === tab ? "rgba(139,92,246,0.4)" : "rgba(255,255,255,0.06)"}`,
                    background: codeTab === tab ? "rgba(139,92,246,0.12)" : "transparent",
                    color: codeTab === tab ? "#8b5cf6" : "rgba(255,255,255,0.3)",
                  }}>
                    <Icon size={11} />
                    {tab}
                  </button>
                );
              })}
            </div>
          </div>
          <div style={{ position: "relative" }}>
            <pre style={{
              padding: "16px 20px", margin: 0, overflow: "auto",
              fontSize: "12px", lineHeight: 1.7, color: "rgba(255,255,255,0.6)",
              fontFamily: "'SF Mono', 'Fira Code', monospace",
              maxHeight: "400px",
            }}>
              {CODE_EXAMPLES[codeTab].replace(/YOUR_API_KEY/g, newKey ?? "sk_live_your_key_here")}
            </pre>
            <button onClick={() => void handleCopyCode()} style={{
              position: "absolute", top: "10px", right: "10px",
              display: "flex", alignItems: "center", gap: "4px",
              background: codeCopied ? "rgba(34,197,94,0.15)" : "rgba(255,255,255,0.06)",
              border: `1px solid ${codeCopied ? "rgba(34,197,94,0.2)" : "rgba(255,255,255,0.08)"}`,
              borderRadius: "5px", padding: "4px 8px", cursor: "pointer",
              color: codeCopied ? "#22c55e" : "rgba(255,255,255,0.35)", fontSize: "10px",
            }}>
              {codeCopied ? <><CheckCircle2 size={9} /> Copied</> : <><Copy size={9} /> Copy</>}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
