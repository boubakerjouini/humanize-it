import { Metadata } from "next";
import Playground from "./playground";

export const metadata: Metadata = {
  title: "HumanizeIt API Documentation",
  description: "Integrate AI text humanization into your apps with the HumanizeIt API.",
};

// ── Code block helper ──────────────────────────────────────

function Code({ children, lang }: { children: string; lang?: string }) {
  return (
    <div className="relative group rounded-lg bg-[#0d1117] border border-zinc-800 overflow-hidden">
      {lang && (
        <div className="px-4 py-1.5 border-b border-zinc-800/50 text-[10px] font-mono text-zinc-600 uppercase tracking-wider">{lang}</div>
      )}
      <pre className="p-4 text-[13px] font-mono text-zinc-400 overflow-x-auto leading-relaxed">
        {children}
      </pre>
    </div>
  );
}

function Table({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-800">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-zinc-900/50 border-b border-zinc-800">
            {headers.map((h) => (
              <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800/50">
          {rows.map((row, i) => (
            <tr key={i} className="hover:bg-zinc-800/20 transition-colors">
              {row.map((cell, j) => (
                <td key={j} className={`px-4 py-2.5 text-zinc-400 ${j === 0 ? "font-mono text-blue-300 text-xs" : "text-sm"}`}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Sidebar nav items ──────────────────────────────────────

const NAV = [
  { id: "introduction", label: "Introduction" },
  { id: "quickstart", label: "Quick Start" },
  { id: "authentication", label: "Authentication" },
  { id: "endpoints", label: "Endpoints" },
  { id: "rate-limits", label: "Rate Limits" },
  { id: "errors", label: "Errors" },
  { id: "playground", label: "Playground" },
  { id: "changelog", label: "Changelog" },
];

// ── Page ───────────────────────────────────────────────────

export default function ApiDocsPage() {
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 lg:py-12">
      <div className="lg:grid lg:grid-cols-[200px_1fr] lg:gap-12">

        {/* ── Sidebar ──────────────────────────────────── */}
        <aside className="hidden lg:block">
          <nav className="sticky top-20 space-y-1">
            {NAV.map((item) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                className="block px-3 py-1.5 text-sm text-zinc-500 hover:text-zinc-200 rounded-md hover:bg-zinc-800/30 transition-colors"
              >
                {item.label}
              </a>
            ))}
          </nav>
        </aside>

        {/* ── Mobile nav ───────────────────────────────── */}
        <div className="lg:hidden mb-8 flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-none">
          {NAV.map((item) => (
            <a
              key={item.id}
              href={`#${item.id}`}
              className="shrink-0 px-3 py-1.5 text-xs text-zinc-500 hover:text-zinc-200 rounded-full border border-zinc-800 hover:border-zinc-700 transition-colors"
            >
              {item.label}
            </a>
          ))}
        </div>

        {/* ── Content ──────────────────────────────────── */}
        <main className="min-w-0 space-y-16">

          {/* 1. HERO / INTRODUCTION */}
          <section id="introduction">
            <div className="mb-8">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">v1</span>
                <span className="flex items-center gap-1.5 text-[10px] text-green-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                  Operational
                </span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-extrabold text-zinc-100 tracking-tight mb-3">
                HumanizeIt API
              </h1>
              <p className="text-lg text-zinc-400 max-w-xl leading-relaxed">
                Make any text undetectable. Programmatically.
              </p>
              <div className="flex gap-3 mt-6">
                <a
                  href="/dashboard/api"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-colors"
                >
                  Get API Key
                </a>
                <a
                  href="#playground"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-medium border border-zinc-700/50 transition-colors"
                >
                  Try the playground
                </a>
              </div>
            </div>
          </section>

          {/* 2. QUICK START */}
          <section id="quickstart">
            <h2 className="text-xl font-bold text-zinc-100 mb-6">Quick Start</h2>
            <div className="grid sm:grid-cols-3 gap-4">
              {[
                { n: "1", title: "Get your API key", desc: "Create a key in the dashboard. It's shown only once — save it securely." },
                { n: "2", title: "Make a request", desc: "Send text to analyze or humanize via a simple POST request." },
                { n: "3", title: "Get results back", desc: "Receive human-sounding text or an AI detection score as JSON." },
              ].map((step) => (
                <div key={step.n} className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-5">
                  <div className="flex items-center justify-center w-7 h-7 rounded-full bg-blue-500/10 text-blue-400 text-xs font-bold mb-3">
                    {step.n}
                  </div>
                  <h3 className="text-sm font-semibold text-zinc-200 mb-1">{step.title}</h3>
                  <p className="text-xs text-zinc-500 leading-relaxed">{step.desc}</p>
                </div>
              ))}
            </div>

            <div className="mt-6 space-y-4">
              <Code lang="curl">{`curl -X POST https://humanize-it.app/api/v1/analyze \\
  -H "Authorization: Bearer sk_live_your_key_here" \\
  -H "Content-Type: application/json" \\
  -d '{"text": "The mitochondria is the powerhouse of the cell."}'`}</Code>

              <Code lang="response">{`{
  "score": 72,
  "confidenceBand": "likely-ai",
  "patterns": [...],
  "stats": { "avgSentenceLength": 8, "vocabularyRichness": 0.85, ... },
  "wordCount": 8
}`}</Code>
            </div>
          </section>

          {/* 3. AUTHENTICATION */}
          <section id="authentication">
            <h2 className="text-xl font-bold text-zinc-100 mb-4">Authentication</h2>
            <p className="text-sm text-zinc-400 leading-relaxed mb-4">
              All API requests require a Bearer token in the <code className="text-xs font-mono text-blue-300 bg-blue-500/5 px-1.5 py-0.5 rounded">Authorization</code> header.
              Keys are generated in your dashboard and shown only once at creation.
            </p>

            <Code lang="http">{`Authorization: Bearer sk_live_aBcDeFgHiJkLmNoPqRsT...`}</Code>

            <div className="mt-4 p-4 rounded-lg bg-amber-500/5 border border-amber-500/10">
              <p className="text-xs text-amber-300/80 leading-relaxed">
                <strong className="text-amber-300">Security:</strong> Never expose API keys in client-side code, public repositories, or browser requests. Always use keys server-side.
              </p>
            </div>
          </section>

          {/* 4. ENDPOINTS */}
          <section id="endpoints">
            <h2 className="text-xl font-bold text-zinc-100 mb-6">Endpoints</h2>

            {/* 4a. Analyze */}
            <div className="mb-12">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-green-500/10 text-green-400 uppercase">POST</span>
                <code className="text-sm font-mono text-zinc-200">/api/v1/analyze</code>
              </div>
              <p className="text-sm text-zinc-400 mb-4">Analyze text for AI-generated patterns and return a detection score.</p>

              <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Request Body</h4>
              <Table
                headers={["Field", "Type", "Required", "Description"]}
                rows={[
                  ["text", "string", "Yes", "The text to analyze (10–10,000 chars)"],
                ]}
              />

              <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mt-6 mb-2">Request</h4>
              <Code lang="curl">{`curl -X POST https://humanize-it.app/api/v1/analyze \\
  -H "Authorization: Bearer sk_live_..." \\
  -H "Content-Type: application/json" \\
  -d '{"text": "Your text to analyze..."}'`}</Code>

              <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mt-6 mb-2">JavaScript</h4>
              <Code lang="javascript">{`const res = await fetch("https://humanize-it.app/api/v1/analyze", {
  method: "POST",
  headers: {
    "Authorization": "Bearer sk_live_...",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ text: "Your text to analyze..." }),
});
const data = await res.json();`}</Code>

              <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mt-6 mb-2">Response</h4>
              <Code lang="json">{`{
  "score": 72,
  "confidenceBand": "likely-ai",
  "patterns": [
    { "name": "uniformSentenceLength", "score": 0.8, "weight": 1.5 },
    { "name": "repetitiveTransitions", "score": 0.6, "weight": 1.2 }
  ],
  "stats": {
    "avgSentenceLength": 18.5,
    "vocabularyRichness": 0.72,
    "sentenceCount": 12
  },
  "wordCount": 222
}`}</Code>

              <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mt-6 mb-2">Response Schema</h4>
              <Table
                headers={["Field", "Type", "Description"]}
                rows={[
                  ["score", "number", "AI detection score 0–100 (higher = more likely AI)"],
                  ["confidenceBand", "string", "human / mixed / likely-ai / ai-generated"],
                  ["patterns", "array", "Detected AI patterns with scores and weights"],
                  ["stats", "object", "Text statistics (sentence length, vocabulary, etc.)"],
                  ["wordCount", "number", "Word count of the input text"],
                ]}
              />
            </div>

            {/* 4b. Humanize */}
            <div className="mb-12">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-green-500/10 text-green-400 uppercase">POST</span>
                <code className="text-sm font-mono text-zinc-200">/api/v1/humanize</code>
              </div>
              <p className="text-sm text-zinc-400 mb-4">Rewrite text to sound more natural and human-written.</p>

              <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Request Body</h4>
              <Table
                headers={["Field", "Type", "Required", "Description"]}
                rows={[
                  ["text", "string", "Yes", "The text to humanize (10–10,000 chars)"],
                  ["tone", "string", "No", "Tone of the output (default: standard)"],
                  ["intensity", "string", "No", "How aggressively to rewrite (default: medium)"],
                  ["passes", "number", "No", "Number of humanization passes, 1–3 (default: 1). Higher passes auto-escalate intensity to reduce AI score below 45%."],
                ]}
              />

              <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mt-6 mb-2">Tone Options</h4>
              <Table
                headers={["Value", "Description"]}
                rows={[
                  ["standard", "Natural, balanced rewriting"],
                  ["formal", "Professional, polished tone"],
                  ["casual", "Conversational, relaxed style"],
                  ["academic", "Scholarly, structured language"],
                  ["storytelling", "Narrative, engaging voice"],
                  ["professional", "Business-appropriate communication"],
                ]}
              />

              <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mt-6 mb-2">Intensity Options</h4>
              <Table
                headers={["Value", "Description"]}
                rows={[
                  ["light", "Minimal changes — preserves most of the original structure"],
                  ["medium", "Balanced rewriting — natural-sounding with moderate changes"],
                  ["heavy", "Aggressive rewriting — maximizes undetectability"],
                ]}
              />

              <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mt-6 mb-2">Request</h4>
              <Code lang="curl">{`curl -X POST https://humanize-it.app/api/v1/humanize \\
  -H "Authorization: Bearer sk_live_..." \\
  -H "Content-Type: application/json" \\
  -d '{"text": "Your text...", "tone": "casual", "intensity": "medium", "passes": 2}'`}</Code>

              <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mt-6 mb-2">Response</h4>
              <Code lang="json">{`{
  "humanizedText": "So here's the thing about mitochondria, they're basically the engine room of every cell...",
  "originalScore": 78,
  "humanizedScore": 18,
  "scoreDelta": 60,
  "confidenceBand": "low",
  "tokensUsed": 312,
  "passes_run": 2,
  "score_history": [78, 51, 18]
}`}</Code>
            </div>

            {/* 4c. Usage */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 uppercase">GET</span>
                <code className="text-sm font-mono text-zinc-200">/api/v1/usage</code>
              </div>
              <p className="text-sm text-zinc-400 mb-4">Check your current API usage and quota.</p>

              <Code lang="curl">{`curl https://humanize-it.app/api/v1/usage \\
  -H "Authorization: Bearer sk_live_..."`}</Code>

              <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mt-6 mb-2">Response</h4>
              <Code lang="json">{`{
  "plan": "PRO",
  "wordsUsed": 12450,
  "wordsLimit": 50000,
  "apiRequestsUsed": 247,
  "apiRequestsLimit": 1000,
  "monthlyResetAt": "2026-04-01T00:00:00.000Z"
}`}</Code>
            </div>
          </section>

          {/* 5. RATE LIMITS */}
          <section id="rate-limits">
            <h2 className="text-xl font-bold text-zinc-100 mb-4">Rate Limits</h2>
            <p className="text-sm text-zinc-400 leading-relaxed mb-4">
              API requests are rate-limited per billing cycle. Every response includes rate limit headers.
            </p>

            <Table
              headers={["Plan", "Requests/month", "Keys allowed", "Max text length"]}
              rows={[
                ["FREE", "0 (no API access)", "0", "5,000 chars"],
                ["PRO", "1,000", "3", "10,000 chars"],
                ["TEAM", "10,000", "10", "10,000 chars"],
              ]}
            />

            <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mt-6 mb-2">Rate Limit Headers</h4>
            <Table
              headers={["Header", "Description"]}
              rows={[
                ["X-RateLimit-Limit", "Total requests allowed this period"],
                ["X-RateLimit-Remaining", "Requests remaining"],
                ["X-RateLimit-Reset", "Unix timestamp of next reset"],
                ["Retry-After", "Seconds until you can retry (on 429 only)"],
              ]}
            />

            <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mt-6 mb-2">429 Response</h4>
            <Code lang="json">{`{
  "error": {
    "code": "QUOTA_EXCEEDED",
    "message": "Monthly API request quota exceeded."
  }
}`}</Code>
          </section>

          {/* 6. ERROR CODES */}
          <section id="errors">
            <h2 className="text-xl font-bold text-zinc-100 mb-4">Error Codes</h2>
            <Table
              headers={["Code", "HTTP", "Description", "Solution"]}
              rows={[
                ["UNAUTHORIZED", "401", "Invalid or missing API key", "Check your Authorization header"],
                ["TEXT_TOO_SHORT", "400", "Text under 10 characters", "Provide longer text"],
                ["TEXT_TOO_LONG", "400", "Text over 10,000 characters", "Shorten your text"],
                ["QUOTA_EXCEEDED", "429", "Monthly quota reached", "Wait for reset or upgrade plan"],
                ["INVALID_JSON", "400", "Request body is not valid JSON", "Check your JSON formatting"],
                ["INTERNAL_ERROR", "500", "Server-side error", "Retry or contact support"],
              ]}
            />
          </section>

          {/* 7. PLAYGROUND */}
          <section id="playground">
            <h2 className="text-xl font-bold text-zinc-100 mb-2">Playground</h2>
            <p className="text-sm text-zinc-400 mb-6">
              Test the API directly from your browser. Enter your API key and try a request.
            </p>
            <Playground />
          </section>

          {/* 8. CHANGELOG */}
          <section id="changelog">
            <h2 className="text-xl font-bold text-zinc-100 mb-4">Changelog</h2>
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-5">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">v1.0</span>
                <span className="text-xs text-zinc-600">March 2026</span>
              </div>
              <p className="text-sm text-zinc-400">
                Initial release. Two endpoints: <code className="text-xs font-mono text-blue-300">analyze</code> and <code className="text-xs font-mono text-blue-300">humanize</code>. Rate limiting, hash-based API key authentication, and interactive playground.
              </p>
            </div>
          </section>

        </main>
      </div>
    </div>
  );
}
