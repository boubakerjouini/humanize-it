"use client";

// ===========================================================
// components/admin/tool-runs-panel.tsx — The "Free tools" tab of the admin
// Documents page: every run of the public detector (instant check and deep
// scan, on every detector page and the blog widget) and of the free
// humanizer, per page and one by one. Free-tool text is never stored, so a
// run shows its page, words, score and who ran it, not the text.
// ===========================================================

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { THEME, humanScore, humanScoreColor } from "@/lib/theme";

type Tool = "detector_instant" | "detector_deep" | "humanizer_free";

interface ToolRunRow {
  id: string;
  tool: Tool;
  page: string;
  wordCount: number;
  score: number | null;
  scoreAfter: number | null;
  band: string | null;
  source: string | null;
  createdAt: string;
  user: { id: string; email: string; name: string | null } | null;
}

interface PageRow {
  page: string;
  total: number;
  detector_instant: number;
  detector_deep: number;
  humanizer_free: number;
  signedIn: number;
}

interface ToolRunsResponse {
  runs?: ToolRunRow[];
  total?: number;
  totalPages?: number;
  byPage?: PageRow[];
  byTool?: Record<Tool, number>;
  error?: { message: string };
}

const TOOL_LABELS: Record<Tool, string> = {
  detector_instant: "Instant check",
  detector_deep: "Deep scan",
  humanizer_free: "Free rewrite",
};

const DAY_OPTIONS = [1, 7, 30, 90] as const;

const th = { textAlign: "left" as const, padding: "10px 14px", fontSize: 11, fontWeight: 600, color: THEME.textMuted, textTransform: "uppercase" as const, letterSpacing: "0.04em", whiteSpace: "nowrap" as const };
const td = { padding: "11px 14px", color: THEME.textDim, whiteSpace: "nowrap" as const };
const card = { background: THEME.surface2, border: `1px solid ${THEME.border}`, borderRadius: THEME.radiusLg, overflow: "hidden" as const };
const select = { padding: "8px 10px", borderRadius: 9, border: `1px solid ${THEME.border}`, background: THEME.surface2, color: THEME.text, fontSize: 13 };

function HumanDot({ ai }: { ai: number }) {
  const h = humanScore(ai);
  const c = humanScoreColor(h);
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 700, color: c }}>
      <span style={{ width: 6, height: 6, borderRadius: 999, background: c }} />
      {h}
    </span>
  );
}

function when(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString(undefined, { month: "short", day: "numeric" })} ${d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}`;
}

export function ToolRunsPanel() {
  const [days, setDays] = useState<(typeof DAY_OPTIONS)[number]>(7);
  const [tool, setTool] = useState<Tool | "">("");
  const [pagePath, setPagePath] = useState("");
  const [p, setP] = useState(1);
  const [data, setData] = useState<ToolRunsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ days: String(days), p: String(p) });
      if (tool) params.set("tool", tool);
      if (pagePath) params.set("page", pagePath);
      const res = await fetch(`/api/admin/tool-runs?${params}`);
      const json = (await res.json()) as ToolRunsResponse;
      if (!res.ok) {
        toast.error(json.error?.message ?? "Failed to load free-tool runs.");
        return;
      }
      setData(json);
    } catch {
      toast.error("Network error.");
    } finally {
      setLoading(false);
    }
  }, [days, tool, pagePath, p]);

  useEffect(() => {
    void load();
  }, [load]);

  const byTool = data?.byTool;
  const pages = data?.byPage ?? [];
  const runs = data?.runs ?? [];
  const totalPages = data?.totalPages ?? 1;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <label style={{ fontSize: 13, color: THEME.textDim, display: "flex", alignItems: "center", gap: 6 }}>
          Period
          <select aria-label="Period" value={days} onChange={(e) => { setP(1); setDays(Number(e.target.value) as (typeof DAY_OPTIONS)[number]); }} style={select}>
            {DAY_OPTIONS.map((d) => <option key={d} value={d}>{d === 1 ? "Last 24 hours" : `Last ${d} days`}</option>)}
          </select>
        </label>
        <label style={{ fontSize: 13, color: THEME.textDim, display: "flex", alignItems: "center", gap: 6 }}>
          Tool
          <select aria-label="Tool" value={tool} onChange={(e) => { setP(1); setTool(e.target.value as Tool | ""); }} style={select}>
            <option value="">All tools</option>
            {(Object.keys(TOOL_LABELS) as Tool[]).map((t) => <option key={t} value={t}>{TOOL_LABELS[t]}</option>)}
          </select>
        </label>
        <label style={{ fontSize: 13, color: THEME.textDim, display: "flex", alignItems: "center", gap: 6 }}>
          Page
          <select aria-label="Page" value={pagePath} onChange={(e) => { setP(1); setPagePath(e.target.value); }} style={{ ...select, maxWidth: 240 }}>
            <option value="">All pages</option>
            {pages.map((row) => <option key={row.page} value={row.page}>{row.page}</option>)}
          </select>
        </label>
        {loading && <Loader2 size={16} color={THEME.textMuted} aria-label="Loading" style={{ animation: "spin 0.8s linear infinite" }} />}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12 }}>
        {(Object.keys(TOOL_LABELS) as Tool[]).map((t) => (
          <div key={t} style={{ ...card, padding: "14px 16px" }}>
            <div style={{ fontSize: 12, color: THEME.textMuted, fontWeight: 600 }}>{TOOL_LABELS[t]}</div>
            <div className="tnum" style={{ fontSize: 24, fontWeight: 700, color: THEME.text, marginTop: 4 }}>{byTool ? byTool[t].toLocaleString() : "–"}</div>
          </div>
        ))}
      </div>

      <section style={card} aria-labelledby="tool-runs-by-page">
        <h2 id="tool-runs-by-page" style={{ fontSize: 14, fontWeight: 700, color: THEME.text, padding: "14px 14px 0" }}>By page</h2>
        {pages.length === 0 ? (
          <div style={{ padding: 28, textAlign: "center", color: THEME.textDim, fontSize: 14 }}>{loading ? "Loading…" : "No free-tool runs in this period."}</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, marginTop: 8 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${THEME.border}`, background: THEME.surface1 }}>
                  {["Page", "Runs", "Instant checks", "Deep scans", "Free rewrites", "Signed in"].map((h) => <th key={h} style={th}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {pages.map((row) => (
                  <tr key={row.page} style={{ borderBottom: `1px solid ${THEME.border}` }}>
                    <td style={{ ...td, color: THEME.text, fontWeight: 600 }}>
                      <button type="button" onClick={() => { setP(1); setPagePath(row.page); }} style={{ background: "none", border: "none", padding: 0, color: THEME.brand, fontWeight: 600, cursor: "pointer", fontSize: 13 }}>{row.page}</button>
                    </td>
                    <td className="tnum" style={{ ...td, color: THEME.text, fontWeight: 700 }}>{row.total}</td>
                    <td className="tnum" style={td}>{row.detector_instant}</td>
                    <td className="tnum" style={td}>{row.detector_deep}</td>
                    <td className="tnum" style={td}>{row.humanizer_free}</td>
                    <td className="tnum" style={td}>{row.signedIn}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section style={card} aria-labelledby="tool-runs-recent">
        <h2 id="tool-runs-recent" style={{ fontSize: 14, fontWeight: 700, color: THEME.text, padding: "14px 14px 0" }}>
          Runs {data?.total !== undefined && <span style={{ color: THEME.textMuted, fontWeight: 500 }}>({data.total.toLocaleString()})</span>}
        </h2>
        <p style={{ fontSize: 12, color: THEME.textMuted, padding: "4px 14px 0" }}>The text people paste in the free tools is never stored; each run keeps only its page, words and score.</p>
        {runs.length === 0 ? (
          <div style={{ padding: 28, textAlign: "center", color: THEME.textDim, fontSize: 14 }}>{loading ? "Loading…" : "No runs match."}</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, marginTop: 8 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${THEME.border}`, background: THEME.surface1 }}>
                  {["When", "Tool", "Page", "Words", "Human score", "Who", "Came from"].map((h) => <th key={h} style={th}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {runs.map((run) => (
                  <tr key={run.id} style={{ borderBottom: `1px solid ${THEME.border}` }}>
                    <td style={td}>{when(run.createdAt)}</td>
                    <td style={{ ...td, color: THEME.text }}>{TOOL_LABELS[run.tool] ?? run.tool}</td>
                    <td style={{ ...td, maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis" }}>{run.page}</td>
                    <td className="tnum" style={td}>{run.wordCount.toLocaleString()}</td>
                    <td style={td}>
                      {run.score === null ? "–" : (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                          <HumanDot ai={run.score} />
                          {run.scoreAfter !== null && <><span style={{ color: THEME.textMuted }} aria-label="after the rewrite">to</span><HumanDot ai={run.scoreAfter} /></>}
                        </span>
                      )}
                    </td>
                    <td style={{ ...td, maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis" }}>
                      {run.user ? (
                        <Link href={`/admin/users/${run.user.id}`} style={{ color: THEME.brand, textDecoration: "none", fontWeight: 600 }}>{run.user.name || run.user.email}</Link>
                      ) : (
                        <span style={{ color: THEME.textMuted }}>Anonymous</span>
                      )}
                    </td>
                    <td style={td}>{run.source ?? <span style={{ color: THEME.textMuted }}>–</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {totalPages > 1 && (
        <div style={{ display: "flex", justifyContent: "center", gap: 8 }}>
          <button type="button" disabled={p <= 1} onClick={() => setP(p - 1)} style={{ padding: "7px 14px", borderRadius: 8, border: `1px solid ${THEME.border}`, background: THEME.surface2, color: THEME.textDim, fontSize: 13, cursor: p <= 1 ? "not-allowed" : "pointer", opacity: p <= 1 ? 0.5 : 1 }}>Previous</button>
          <span style={{ padding: "7px 14px", fontSize: 13, color: THEME.textDim }}>{p} / {totalPages}</span>
          <button type="button" disabled={p >= totalPages} onClick={() => setP(p + 1)} style={{ padding: "7px 14px", borderRadius: 8, border: `1px solid ${THEME.border}`, background: THEME.surface2, color: THEME.textDim, fontSize: 13, cursor: p >= totalPages ? "not-allowed" : "pointer", opacity: p >= totalPages ? 0.5 : 1 }}>Next</button>
        </div>
      )}
    </div>
  );
}
