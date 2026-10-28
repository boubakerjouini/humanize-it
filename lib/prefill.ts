// ============================================================
// Prefill handoff: carries text a visitor typed on a public tool
// (home hero, compare, AI detector, free humanizer) to the next
// tool or the dashboard editor, in this tab's sessionStorage only.
// Never a query param: the text would land in logs and analytics.
// Client-only; storage can throw (private mode, blocked site data).
// ============================================================

export const PREFILL_KEY = "prefill-text";
/** Text from an abandoned signup must not resurface in a later session of the tab. */
export const PREFILL_TTL_MS = 30 * 60 * 1000;

export function savePrefill(text: string): void {
  if (!text.trim()) return;
  try {
    sessionStorage.setItem(PREFILL_KEY, JSON.stringify({ text, at: Date.now() }));
  } catch {}
}

/** Reads and removes the handoff: one tool opens it once, a refresh starts empty. */
export function takePrefill(): string | null {
  try {
    const raw = sessionStorage.getItem(PREFILL_KEY);
    if (raw === null) return null;
    sessionStorage.removeItem(PREFILL_KEY);
    const parsed = JSON.parse(raw) as { text?: unknown; at?: unknown };
    if (typeof parsed?.text !== "string" || typeof parsed.at !== "number") return null;
    if (Date.now() - parsed.at > PREFILL_TTL_MS) return null;
    return parsed.text.trim() ? parsed.text : null;
  } catch {
    return null;
  }
}
