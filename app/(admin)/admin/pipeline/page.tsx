"use client";

// ===========================================================
// /admin/pipeline — the outreach board (columns = PIPELINE_STAGES) and a
// read-only lifecycle view (columns = lifecycle stages). Each card has a
// select to move it (keyboard and touch friendly; drag-and-drop was cut).
// A move PATCHes the contact, which records a pipeline_changed event.
// The header tracks today's touches against the Rule-of-100 goal.
// ===========================================================

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { MessageSquarePlus, Plus } from "lucide-react";
import { THEME } from "@/lib/theme";
import { PIPELINE_STAGES } from "@/lib/growth/constants";
import { STAGES, STAGE_COLORS, STAGE_LABELS, isStage } from "@/lib/crm/lifecycle";
import { Empty, PageHeader, ScoreBadge, StagePill, fmtRelative, ghostBtn, primaryBtn } from "@/components/admin/crm-ui";
import { Tabs, tabId, tabPanelId } from "@/components/admin/crm-dialogs";
import { Spinner, TypeBadge, contactLabel, humanizeKey, type ContactLike } from "@/components/admin/crm/contact-bits";
import { AddContactDialog, LogTouchDialog } from "@/components/admin/crm/crm-forms";
import { selectStyle, sendJson } from "@/components/admin/crm/form-dialog";

type Card = ContactLike & {
  type: string;
  stage: string;
  stageOverride: string | null;
  score: number;
  pipelineStage: string | null;
  pipelineUpdatedAt: string | null;
  lastActiveAt: string | null;
  channel: string | null;
};
type Column = { key: string; total: number; items: Card[] };
type Board = { mode: "outreach" | "lifecycle"; columns: Column[]; touchesToday: number; goal: number };

const PIPELINE_COLORS: Record<string, string> = {
  to_contact: "#64748b",
  contacted: "#2563eb",
  replied: "#7c3aed",
  trial_offered: "#f59e0b",
  trial_active: "#0d9488",
  won: "#16a34a",
  lost: "#e11d48",
};

export default function PipelinePage() {
  const [mode, setMode] = useState<"outreach" | "lifecycle">("outreach");
  const [board, setBoard] = useState<Board | null>(null);
  const [loading, setLoading] = useState(true);
  const [moving, setMoving] = useState<string | null>(null);
  /** The card to log a touch for, or "pick" to search for the contact in the dialog. */
  const [touching, setTouching] = useState<Card | "pick" | null>(null);
  const [adding, setAdding] = useState(false);

  const load = useCallback(async (m: "outreach" | "lifecycle") => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/pipeline?mode=${m}`);
      const data = (await res.json()) as Board & { error?: { message: string } };
      if (!res.ok) {
        toast.error(data.error?.message ?? "Failed to load the board.");
        return;
      }
      setBoard(data);
    } catch {
      toast.error("Network error.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(mode);
  }, [load, mode]);

  const move = async (card: Card, payload: Record<string, unknown>, ok: string) => {
    setMoving(card.id);
    try {
      await sendJson(`/api/admin/contacts/${card.id}`, "PATCH", payload);
      toast.success(ok);
      await load(mode);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setMoving(null);
    }
  };

  const touches = board?.touchesToday ?? 0;
  const goal = board?.goal ?? 30;
  const pct = Math.min(100, Math.round((touches / Math.max(1, goal)) * 100));

  return (
    <div style={{ maxWidth: 1400, margin: "0 auto", padding: "32px 28px", fontFamily: THEME.fontSans }}>
      <PageHeader
        title="Pipeline"
        description="Move people forward one honest conversation at a time."
        actions={
          <>
            <div aria-label={`Today: ${touches} of ${goal} touches`} style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 170, marginRight: 6 }}>
              <span className="tnum" style={{ fontSize: 13, fontWeight: 700, color: THEME.text }}>
                Today: {touches}/{goal} touches
              </span>
              <span style={{ height: 6, borderRadius: 999, background: THEME.surface3, overflow: "hidden" }}>
                <span style={{ display: "block", height: "100%", width: `${pct}%`, background: pct >= 100 ? THEME.human : THEME.brand }} />
              </span>
            </div>
            <button type="button" onClick={() => setTouching("pick")} style={ghostBtn}>
              <MessageSquarePlus size={14} aria-hidden="true" /> Log touch
            </button>
            <button type="button" onClick={() => setAdding(true)} style={primaryBtn}>
              <Plus size={14} aria-hidden="true" /> Add prospect
            </button>
          </>
        }
      />

      <Tabs
        idPrefix="pipeline"
        label="Board"
        value={mode}
        onChange={(v) => setMode(v as "outreach" | "lifecycle")}
        tabs={[
          { id: "outreach", label: "Outreach" },
          { id: "lifecycle", label: "Lifecycle" },
        ]}
      />

      <div role="tabpanel" id={tabPanelId("pipeline", mode)} aria-labelledby={tabId("pipeline", mode)}>
        {loading && !board ? (
          <Spinner />
        ) : board && board.mode === mode ? (
          <>
            {mode === "outreach" && board.columns.every((c) => c.total === 0) ? (
              <Empty
                title="Nobody on the outreach board yet"
                description="Add a prospect, or put contacts on the pipeline from the contacts list (bulk action) or their page."
                action={
                  <button type="button" onClick={() => setAdding(true)} style={primaryBtn}>
                    <Plus size={14} aria-hidden="true" /> Add prospect
                  </button>
                }
              />
            ) : (
              <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 12, alignItems: "flex-start", opacity: loading ? 0.6 : 1 }}>
                {board.columns.map((col) => (
                  <section
                    key={col.key}
                    aria-label={`${mode === "outreach" ? humanizeKey(col.key) : isStage(col.key) ? STAGE_LABELS[col.key] : col.key}: ${col.total}`}
                    style={{ flex: "0 0 250px", background: THEME.surface1, border: `1px solid ${THEME.border}`, borderRadius: THEME.radiusLg, padding: 10 }}
                  >
                    <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "2px 4px 10px" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 700, color: THEME.text }}>
                        <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: 999, background: mode === "outreach" ? PIPELINE_COLORS[col.key] : isStage(col.key) ? STAGE_COLORS[col.key] : THEME.textMuted }} />
                        {mode === "outreach" ? humanizeKey(col.key) : isStage(col.key) ? STAGE_LABELS[col.key] : col.key}
                      </span>
                      <span className="tnum" style={{ fontSize: 11, color: THEME.textMuted, background: THEME.surface2, borderRadius: 999, padding: "1px 8px" }}>
                        {col.total}
                      </span>
                    </header>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {col.items.length === 0 ? <div style={{ fontSize: 12, color: THEME.textMuted, padding: "8px 4px" }}>Empty</div> : null}
                      {col.items.map((card) => (
                        <PipelineCard
                          key={card.id}
                          card={card}
                          mode={mode}
                          busy={moving === card.id}
                          onMove={(value) =>
                            mode === "outreach"
                              ? move(card, { action: "setPipelineStage", stage: value || null }, value ? `Moved to ${humanizeKey(value)}` : "Removed from the pipeline")
                              : move(card, { action: "setStageOverride", stage: value || null }, value ? "Stage pinned" : "Override cleared")
                          }
                          onTouch={() => setTouching(card)}
                        />
                      ))}
                      {col.total > col.items.length ? (
                        <Link
                          href={`/admin/contacts?${mode === "outreach" ? "pipelineStage" : "stage"}=${col.key}`}
                          style={{ fontSize: 12, color: THEME.brandHi, fontWeight: 600, textAlign: "center", padding: 6 }}
                        >
                          View all {col.total}
                        </Link>
                      ) : null}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </>
        ) : (
          <Spinner />
        )}
      </div>

      <LogTouchDialog
        open={!!touching}
        contact={touching === "pick" ? null : touching}
        pipelineStage={touching === "pick" ? null : touching?.pipelineStage}
        onClose={() => setTouching(null)}
        onDone={() => {
          setTouching(null);
          void load(mode);
        }}
      />
      <AddContactDialog open={adding} onClose={() => setAdding(false)} />
    </div>
  );
}

function PipelineCard({ card, mode, busy, onMove, onTouch }: { card: Card; mode: "outreach" | "lifecycle"; busy: boolean; onMove: (value: string) => void; onTouch: () => void }) {
  const label = contactLabel(card);
  return (
    <article style={{ background: THEME.surface2, border: `1px solid ${THEME.border}`, borderRadius: THEME.radius, padding: 10, opacity: busy ? 0.6 : 1 }}>
      <Link href={`/admin/contacts/${card.id}`} style={{ display: "block", fontSize: 13, fontWeight: 600, color: THEME.text, textDecoration: "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {label}
      </Link>
      {card.company || (card.email && card.email !== label) ? (
        <div style={{ fontSize: 11, color: THEME.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{card.company || card.email}</div>
      ) : null}
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
        <TypeBadge type={card.type} />
        {mode === "outreach" ? <StagePill stage={card.stage} overridden={!!card.stageOverride} /> : null}
        <ScoreBadge score={card.score} />
      </div>
      <div style={{ fontSize: 11, color: THEME.textMuted, marginTop: 6 }}>
        {mode === "outreach" ? `Moved ${fmtRelative(card.pipelineUpdatedAt)}` : `Active ${fmtRelative(card.lastActiveAt)}`}
      </div>
      <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
        {mode === "outreach" ? (
          <select aria-label={`Move ${label}`} value={card.pipelineStage ?? ""} disabled={busy} onChange={(e) => onMove(e.target.value)} style={{ ...selectStyle, fontSize: 12, flex: 1, minWidth: 0 }}>
            {PIPELINE_STAGES.map((s) => (
              <option key={s} value={s}>
                {humanizeKey(s)}
              </option>
            ))}
            <option value="">Remove from pipeline</option>
          </select>
        ) : (
          <select aria-label={`Pin stage for ${label}`} value={card.stageOverride ?? ""} disabled={busy} onChange={(e) => onMove(e.target.value)} style={{ ...selectStyle, fontSize: 12, flex: 1, minWidth: 0 }}>
            <option value="">Automatic stage</option>
            {STAGES.map((s) => (
              <option key={s} value={s}>
                Pin: {STAGE_LABELS[s]}
              </option>
            ))}
          </select>
        )}
        {mode === "outreach" ? (
          <button type="button" onClick={onTouch} aria-label={`Log a touch with ${label}`} title="Log a touch" style={{ ...ghostBtn, padding: "6px 8px" }}>
            <MessageSquarePlus size={13} aria-hidden="true" />
          </button>
        ) : null}
      </div>
    </article>
  );
}
