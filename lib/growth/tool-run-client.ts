// ===========================================================
// lib/growth/tool-run-client.ts — Browser side of the free-tool tracking:
// tells /api/public/tool-run that an instant AI check ran on this page.
// Metadata only (page, word count, score, band), never the text. Fire and
// forget: it must never slow down or break the tool.
// ===========================================================

export function sendInstantCheckRun(input: { page: string; wordCount: number; score: number; band?: string }): void {
  try {
    void fetch("/api/public/tool-run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tool: "detector_instant", ...input }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* tracking is best effort */
  }
}
