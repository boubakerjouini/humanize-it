"use client";

import { useState } from "react";
import { Loader2, Play, Copy, CheckCircle2 } from "lucide-react";

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
          <label className="block text-xs text-zinc-500 mb-1.5 font-medium">API Key</label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk_live_..."
            className="w-full px-3 py-2.5 rounded-lg bg-[#0d1117] border border-zinc-800 text-sm font-mono text-zinc-300 placeholder:text-zinc-700 outline-none focus:border-blue-500/50 transition-all"
          />
          <p className="text-[10px] text-zinc-600 mt-1">Not stored — only used in-memory for this request</p>
        </div>

        <div>
          <label className="block text-xs text-zinc-500 mb-1.5 font-medium">Endpoint</label>
          <div className="flex gap-2">
            {(["analyze", "humanize"] as const).map((ep) => (
              <button
                key={ep}
                onClick={() => setEndpoint(ep)}
                className={`flex-1 px-3 py-2 rounded-lg text-xs font-semibold transition-all border ${
                  endpoint === ep
                    ? "bg-blue-500/10 border-blue-500/30 text-blue-400"
                    : "bg-zinc-800/30 border-zinc-800 text-zinc-500 hover:text-zinc-300"
                }`}
              >
                POST /api/v1/{ep}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs text-zinc-500 mb-1.5 font-medium">Text</label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Enter text to analyze or humanize..."
            rows={6}
            className="w-full px-3 py-2.5 rounded-lg bg-[#0d1117] border border-zinc-800 text-sm text-zinc-300 placeholder:text-zinc-700 outline-none focus:border-blue-500/50 resize-y transition-all"
          />
        </div>

        {endpoint === "humanize" && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-zinc-500 mb-1.5 font-medium">Tone</label>
              <select
                value={tone}
                onChange={(e) => setTone(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[#0d1117] border border-zinc-800 text-sm text-zinc-300 outline-none focus:border-blue-500/50"
              >
                {TONES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-zinc-500 mb-1.5 font-medium">Intensity</label>
              <select
                value={intensity}
                onChange={(e) => setIntensity(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[#0d1117] border border-zinc-800 text-sm text-zinc-300 outline-none focus:border-blue-500/50"
              >
                {INTENSITIES.map((i) => <option key={i} value={i}>{i}</option>)}
              </select>
            </div>
          </div>
        )}

        <button
          onClick={() => void handleRun()}
          disabled={status === "loading"}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-800 disabled:text-zinc-500 text-white text-sm font-semibold transition-all"
        >
          {status === "loading" ? (
            <><Loader2 size={14} className="animate-spin" /> Running...</>
          ) : (
            <><Play size={14} /> Run request</>
          )}
        </button>
      </div>

      {/* ── Right: Output ─────────────────────────────── */}
      <div className="space-y-3">
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs text-zinc-500 font-medium">Response</label>
            {response && (
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                status === "success" ? "bg-green-500/10 text-green-400" : status === "error" ? "bg-red-500/10 text-red-400" : "bg-zinc-800 text-zinc-500"
              }`}>
                {status === "success" ? "200 OK" : status === "error" ? "Error" : ""}
              </span>
            )}
          </div>
          <div className="relative rounded-lg bg-[#0d1117] border border-zinc-800 min-h-[260px] overflow-hidden">
            {status === "loading" ? (
              <div className="flex items-center justify-center h-[260px]">
                <span className="text-zinc-600 text-sm font-mono animate-pulse">▌</span>
              </div>
            ) : response ? (
              <>
                <pre className="p-4 text-xs font-mono text-zinc-400 overflow-auto max-h-[400px] leading-relaxed whitespace-pre-wrap">
                  <JsonHighlight json={response} />
                </pre>
                <button
                  onClick={() => void handleCopy(response)}
                  className={`absolute top-2 right-2 flex items-center gap-1 px-2 py-1 rounded text-[10px] transition-all ${
                    copied ? "bg-green-500/10 text-green-400" : "bg-zinc-800/80 text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  {copied ? <><CheckCircle2 size={9} /> Copied</> : <><Copy size={9} /> Copy</>}
                </button>
              </>
            ) : (
              <div className="flex items-center justify-center h-[260px] text-xs text-zinc-700">
                Response will appear here
              </div>
            )}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs text-zinc-500 font-medium">cURL command</label>
          </div>
          <div className="relative rounded-lg bg-[#0d1117] border border-zinc-800 overflow-hidden">
            <pre className="p-4 text-xs font-mono text-zinc-500 overflow-auto max-h-[200px] leading-relaxed whitespace-pre-wrap">{buildCurl()}</pre>
            <button
              onClick={() => void handleCopy(buildCurl())}
              className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 rounded text-[10px] bg-zinc-800/80 text-zinc-500 hover:text-zinc-300 transition-all"
            >
              <Copy size={9} /> Copy
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Simple JSON syntax highlighting ─────────────────────────

function JsonHighlight({ json }: { json: string }) {
  const highlighted = json
    .replace(/"([^"]+)":/g, '<span style="color:#7dd3fc">"$1"</span>:')
    .replace(/: "([^"]*)"/g, ': <span style="color:#86efac">"$1"</span>')
    .replace(/: (\d+\.?\d*)/g, ': <span style="color:#fbbf24">$1</span>')
    .replace(/: (true|false|null)/g, ': <span style="color:#c084fc">$1</span>');

  return <span dangerouslySetInnerHTML={{ __html: highlighted }} />;
}
