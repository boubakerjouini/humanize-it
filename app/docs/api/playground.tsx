"use client";

import { useState } from "react";
import { Loader2, Play, Copy, CheckCircle2 } from "lucide-react";
import { THEME } from "@/lib/theme";

type Endpoint = "analyze" | "humanize";

const TONES = ["standard", "formal", "casual", "academic", "storytelling", "professional"] as const;
const INTENSITIES = ["light", "medium", "heavy"] as const;

export default function Playground() {
  const [apiKey, setApiKey] = useState("");
  const [endpoint, setEndpoint] = useState<Endpoint>("analyze");
  const [text, setText] = useState("");
  const [tone, setTone] = useState("standard");
  const [intensity, setIntensity] = useState("medium");

  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [response, setResponse] = useState<string>("");
  const [copied, setCopied] = useState(false);

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";

  const buildCurl = () => {
    const url = `${baseUrl}/api/v1/${endpoint}`;
    if (endpoint === "analyze") {
      return `curl -X POST ${url} \\\n  -H "Authorization: Bearer ${apiKey || "YOUR_API_KEY"}" \\\n  -H "Content-Type: application/json" \\\n  -d '${JSON.stringify({ text: text || "Your text here..." })}'`;
    }
    return `curl -X POST ${url} \\\n  -H "Authorization: Bearer ${apiKey || "YOUR_API_KEY"}" \\\n  -H "Content-Type: application/json" \\\n  -d '${JSON.stringify({ text: text || "Your text here...", tone, intensity })}'`;
  };

  const handleRun = async () => {
    if (!apiKey.startsWith("sk_live_")) {
      setResponse(JSON.stringify({ error: { code: "INVALID_KEY", message: "Enter a valid API key starting with sk_live_" } }, null, 2));
      setStatus("error");
      return;
    }
    if (!text || text.length < 11) {
      setResponse(JSON.stringify({ error: { code: "TEXT_TOO_SHORT", message: "Text must be at least 11 characters." } }, null, 2));
      setStatus("error");
      return;
    }

    setStatus("loading");
    setResponse("");

    try {
      const body: Record<string, string> = { text };
      if (endpoint === "humanize") {
        body.tone = tone;
        body.intensity = intensity;
      }

      const res = await fetch(`/api/v1/${endpoint}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      setResponse(JSON.stringify(data, null, 2));
      setStatus(res.ok ? "success" : "error");
    } catch {
      setResponse(JSON.stringify({ error: { code: "NETWORK_ERROR", message: "Failed to reach the API." } }, null, 2));
      setStatus("error");
    }
  };

  const handleCopy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      {/* ── Left: Inputs ──────────────────────────────── */}
      <div className="space-y-4">
        <div>
          <label htmlFor="pg-api-key" className="block text-xs text-muted-foreground mb-1.5 font-medium font-mono">API Key</label>
          <input
            id="pg-api-key"
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk_live_..."
            className="w-full px-3 py-2.5 rounded-lg bg-[var(--surface-1)] border border-border text-sm font-mono text-foreground placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--brand)] transition-all"
          />
          <p className="text-[10px] text-[var(--text-muted)] mt-1">Not stored — only used in-memory for this request</p>
        </div>

        <div>
          <label className="block text-xs text-muted-foreground mb-1.5 font-medium font-mono">Endpoint</label>
          <div className="flex gap-2">
            {(["analyze", "humanize"] as const).map((ep) => (
              <button
                key={ep}
                onClick={() => setEndpoint(ep)}
                className={`flex-1 px-3 py-2 rounded-lg text-xs font-semibold transition-all border font-mono ${
                  endpoint === ep
                    ? "bg-[var(--brand-dim)] border-[var(--brand)]/40 text-[var(--brand-hi)]"
                    : "bg-[var(--surface-3)] border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                POST /api/v1/{ep}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label htmlFor="pg-text" className="block text-xs text-muted-foreground mb-1.5 font-medium font-mono">Text</label>
          <textarea
            id="pg-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Enter text to analyze or humanize..."
            aria-label="Text to send to the API"
            rows={6}
            className="w-full px-3 py-2.5 rounded-lg bg-[var(--surface-1)] border border-border text-sm text-foreground placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--brand)] resize-y transition-all"
          />
        </div>

        {endpoint === "humanize" && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="pg-tone" className="block text-xs text-muted-foreground mb-1.5 font-medium font-mono">Tone</label>
              <select
                id="pg-tone"
                value={tone}
                onChange={(e) => setTone(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[var(--surface-1)] border border-border text-sm text-foreground outline-none focus:border-[var(--brand)]"
              >
                {TONES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="pg-intensity" className="block text-xs text-muted-foreground mb-1.5 font-medium font-mono">Intensity</label>
              <select
                id="pg-intensity"
                value={intensity}
                onChange={(e) => setIntensity(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[var(--surface-1)] border border-border text-sm text-foreground outline-none focus:border-[var(--brand)]"
              >
                {INTENSITIES.map((i) => <option key={i} value={i}>{i}</option>)}
              </select>
            </div>
          </div>
        )}

        <button
          onClick={() => void handleRun()}
          disabled={status === "loading"}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-primary hover:bg-[var(--brand-hi)] disabled:bg-[var(--surface-3)] disabled:text-muted-foreground text-white text-sm font-semibold transition-all"
        >
          {status === "loading" ? (
            <><Loader2 size={14} className="animate-spin" aria-hidden="true" /> Running...</>
          ) : (
            <><Play size={14} aria-hidden="true" /> Run request</>
          )}
        </button>
      </div>

      {/* ── Right: Output ─────────────────────────────── */}
      <div className="space-y-3">
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs text-muted-foreground font-medium font-mono">Response</label>
            {response && (
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded font-mono ${
                status === "success" ? "bg-[var(--human-dim)] text-[var(--human)]" : status === "error" ? "bg-[var(--ai-dim)] text-[var(--ai)]" : "bg-[var(--surface-3)] text-muted-foreground"
              }`}>
                {status === "success" ? "200 OK" : status === "error" ? "Error" : ""}
              </span>
            )}
          </div>
          <div className="relative rounded-lg bg-[var(--surface-1)] border border-border min-h-[260px] overflow-hidden" aria-live="polite">
            {status === "loading" ? (
              <div className="flex items-center justify-center h-[260px]">
                <span className="text-[var(--human)] text-sm font-mono animate-pulse" aria-hidden="true">▌</span>
              </div>
            ) : response ? (
              <>
                <pre className="p-4 text-xs font-mono text-muted-foreground overflow-auto max-h-[400px] leading-relaxed whitespace-pre-wrap">
                  <JsonHighlight json={response} />
                </pre>
                <button
                  onClick={() => void handleCopy(response)}
                  className={`absolute top-2 right-2 flex items-center gap-1 px-2 py-1 rounded text-[10px] transition-all ${
                    copied ? "bg-[var(--human-dim)] text-[var(--human)]" : "bg-[var(--surface-3)] text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {copied ? <><CheckCircle2 size={9} aria-hidden="true" /> Copied</> : <><Copy size={9} aria-hidden="true" /> Copy</>}
                </button>
              </>
            ) : (
              <div className="flex items-center justify-center h-[260px] text-xs text-[var(--text-muted)]">
                Response will appear here
              </div>
            )}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs text-muted-foreground font-medium font-mono">cURL command</label>
          </div>
          <div className="relative rounded-lg bg-[var(--surface-1)] border border-border overflow-hidden">
            <pre className="p-4 text-xs font-mono text-muted-foreground overflow-auto max-h-[200px] leading-relaxed whitespace-pre-wrap">{buildCurl()}</pre>
            <button
              onClick={() => void handleCopy(buildCurl())}
              className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 rounded text-[10px] bg-[var(--surface-3)] text-muted-foreground hover:text-foreground transition-all"
            >
              <Copy size={9} aria-hidden="true" /> Copy
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Simple JSON syntax highlighting ─────────────────────────

function JsonHighlight({ json }: { json: string }) {
  // Map JSON token types to Midnight Terminal palette tokens.
  const highlighted = json
    .replace(/"([^"]+)":/g, `<span style="color:${THEME.brandHi}">"$1"</span>:`)
    .replace(/: "([^"]*)"/g, `: <span style="color:${THEME.human}">"$1"</span>`)
    .replace(/: (\d+\.?\d*)/g, `: <span style="color:${THEME.warn}">$1</span>`)
    .replace(/: (true|false|null)/g, `: <span style="color:${THEME.brand}">$1</span>`);

  return <span dangerouslySetInnerHTML={{ __html: highlighted }} />;
}
