"use client";

// ===========================================================
// /admin/tasks — the founder's follow-up list: Today (due today or undated),
// Overdue, Upcoming and Done. Rule-generated tasks carry a "rule" badge;
// founder_review and team_setup tasks come from in-app service requests.
// "Run rules now" runs the same auto rules as the daily job (idempotent).
// ===========================================================

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Check, Play, Plus, RotateCcw, Trash2, X } from "lucide-react";
import { THEME } from "@/lib/theme";
import { STAGE_LABELS, isStage } from "@/lib/crm/lifecycle";
import { TASK_KINDS, TASK_KIND_LABELS, TASK_RULE_LABELS, TASK_VIEWS, type TaskKind, type TaskView } from "@/app/api/admin/tasks/shared";
import { Empty, PageHeader, Panel, Pill, disabledStyle, fmtDate, fmtRelative, ghostBtn, primaryBtn } from "@/components/admin/crm-ui";
import { ConfirmDialog, Tabs, tabId, tabPanelId } from "@/components/admin/crm-dialogs";
import { Spinner, contactLabel } from "@/components/admin/crm/contact-bits";
import { TaskDialog } from "@/components/admin/crm/crm-forms";
import { selectStyle, sendJson } from "@/components/admin/crm/form-dialog";

type Task = {
  id: string;
  title: string;
  body: string | null;
  kind: string;
  priority: string;
  status: string;
  dueAt: string | null;
  source: string;
  ruleKey: string | null;
  createdBy: string;
  completedAt: string | null;
  completedBy: string | null;
  createdAt: string;
  contact: { id: string; name: string | null; email: string | null; stage: string; userId: string | null } | null;
};

const VIEW_LABELS: Record<TaskView, string> = { today: "Today", overdue: "Overdue", upcoming: "Upcoming", done: "Done" };
const PRIORITY_COLORS: Record<string, string> = { high: THEME.ai, normal: THEME.brand, low: THEME.textMuted };

export default function TasksPage() {
  const [view, setView] = useState<TaskView>("today");
  const [kind, setKind] = useState("");
  const [items, setItems] = useState<Task[]>([]);
  const [counts, setCounts] = useState<Partial<Record<TaskView, number>>>({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [running, setRunning] = useState(false);
  const [deleting, setDeleting] = useState<Task | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/tasks?view=${view}${kind ? `&kind=${kind}` : ""}`);
      const data = (await res.json()) as { items?: Task[]; counts?: Record<TaskView, number>; error?: { message: string } };
      if (!res.ok) {
        toast.error(data.error?.message ?? "Failed to load tasks.");
        return;
      }
      setItems(data.items ?? []);
      setCounts(data.counts ?? {});
    } catch {
      toast.error("Network error.");
    } finally {
      setLoading(false);
    }
  }, [view, kind]);

  useEffect(() => {
    void load();
  }, [load]);

  const update = async (task: Task, status: "done" | "dismissed" | "open") => {
    setBusyId(task.id);
    try {
      await sendJson(`/api/admin/tasks/${task.id}`, "PATCH", { status });
      toast.success(status === "done" ? "Done" : status === "dismissed" ? "Dismissed" : "Reopened");
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  const runRules = async () => {
    setRunning(true);
    try {
      const res = await sendJson<{ created: number }>("/api/admin/tasks/run", "POST");
      toast.success(res.created ? `${res.created} new ${res.created === 1 ? "task" : "tasks"} from the rules` : "No new tasks: the rules found nothing new");
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: "32px 28px", fontFamily: THEME.fontSans }}>
      <PageHeader
        title="Tasks"
        description="Personal follow-ups. The rules suggest; you decide."
        actions={
          <>
            <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: THEME.textMuted }}>
              Kind
              <select value={kind} onChange={(e) => setKind(e.target.value)} style={selectStyle}>
                <option value="">All</option>
                {TASK_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {TASK_KIND_LABELS[k]}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" onClick={runRules} disabled={running} style={disabledStyle(ghostBtn, running)} title="Run the auto task rules now (the daily job runs them too)">
              <Play size={14} aria-hidden="true" /> Run rules now
            </button>
            <button type="button" onClick={() => setAdding(true)} style={primaryBtn}>
              <Plus size={14} aria-hidden="true" /> Add task
            </button>
          </>
        }
      />

      <Tabs idPrefix="tasks" label="Task lists" value={view} onChange={(v) => setView(v as TaskView)} tabs={TASK_VIEWS.map((v) => ({ id: v, label: VIEW_LABELS[v], count: counts[v] }))} />

      <div role="tabpanel" id={tabPanelId("tasks", view)} aria-labelledby={tabId("tasks", view)}>
        <Panel flush>
          {loading && items.length === 0 ? (
            <Spinner />
          ) : items.length === 0 ? (
            <Empty
              title={view === "done" ? "Nothing finished yet" : view === "overdue" ? "Nothing overdue" : "Nothing here"}
              description={view === "today" ? "Add a task, or run the rules to see who needs a personal follow-up." : undefined}
            />
          ) : (
            <ul style={{ listStyle: "none", margin: 0, padding: 0, opacity: loading ? 0.6 : 1 }}>
              {items.map((t) => (
                <li key={t.id} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "14px 18px", borderTop: `1px solid ${THEME.border}` }}>
                  <span aria-hidden="true" title={`${t.priority} priority`} style={{ width: 8, height: 8, borderRadius: 999, marginTop: 6, flexShrink: 0, background: PRIORITY_COLORS[t.priority] ?? THEME.textMuted }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, color: THEME.text, fontWeight: 600, textDecoration: t.status === "done" ? "line-through" : undefined }}>{t.title}</div>
                    {t.body ? <div style={{ fontSize: 12, color: THEME.textDim, marginTop: 2, whiteSpace: "pre-wrap" }}>{t.body}</div> : null}
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginTop: 6, fontSize: 12, color: THEME.textMuted }}>
                      <Pill color={THEME.textDim}>{TASK_KIND_LABELS[t.kind as TaskKind] ?? t.kind}</Pill>
                      {t.source === "rule" ? (
                        <Pill color={THEME.accent} title={t.ruleKey ? `Created by the ${t.ruleKey} rule` : "Created by a rule"}>
                          rule{t.ruleKey && TASK_RULE_LABELS[t.ruleKey] ? `: ${TASK_RULE_LABELS[t.ruleKey]}` : ""}
                        </Pill>
                      ) : null}
                      {t.source === "request" ? <Pill color={THEME.human}>requested in app</Pill> : null}
                      {t.priority === "high" ? <Pill color={THEME.ai}>high</Pill> : null}
                      {t.contact ? (
                        <Link href={`/admin/contacts/${t.contact.id}`} style={{ color: THEME.brandHi, fontWeight: 600, textDecoration: "none" }}>
                          {contactLabel(t.contact)}
                          {isStage(t.contact.stage) ? <span style={{ color: THEME.textMuted, fontWeight: 400 }}> · {STAGE_LABELS[t.contact.stage]}</span> : null}
                        </Link>
                      ) : null}
                      <span>
                        {t.status === "open"
                          ? t.dueAt
                            ? `due ${fmtDate(t.dueAt)}`
                            : "no due date"
                          : `${t.status} ${fmtRelative(t.completedAt)}${t.completedBy ? ` by ${t.completedBy}` : ""}`}
                      </span>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                    {t.status === "open" ? (
                      <>
                        <button type="button" disabled={busyId === t.id} onClick={() => update(t, "done")} style={disabledStyle({ ...ghostBtn, padding: "6px 10px" }, busyId === t.id)}>
                          <Check size={13} aria-hidden="true" /> Done
                        </button>
                        <button type="button" disabled={busyId === t.id} onClick={() => update(t, "dismissed")} aria-label={`Dismiss ${t.title}`} title="Dismiss" style={disabledStyle({ ...ghostBtn, padding: "6px 9px" }, busyId === t.id)}>
                          <X size={13} aria-hidden="true" />
                        </button>
                      </>
                    ) : (
                      <button type="button" disabled={busyId === t.id} onClick={() => update(t, "open")} style={disabledStyle({ ...ghostBtn, padding: "6px 10px" }, busyId === t.id)}>
                        <RotateCcw size={13} aria-hidden="true" /> Reopen
                      </button>
                    )}
                    <button type="button" onClick={() => setDeleting(t)} aria-label={`Delete ${t.title}`} title="Delete" style={{ ...ghostBtn, padding: "6px 9px", color: THEME.textMuted }}>
                      <Trash2 size={13} aria-hidden="true" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <TaskDialog
        open={adding}
        onClose={() => setAdding(false)}
        onDone={() => {
          setAdding(false);
          void load();
        }}
      />
      <ConfirmDialog
        open={!!deleting}
        title="Delete this task?"
        body={deleting?.source === "rule" ? "A rule task deleted now can come back in the same cycle. Dismiss it instead to keep it away." : "It is removed for good."}
        confirmLabel="Delete"
        danger
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return;
          try {
            await sendJson(`/api/admin/tasks/${deleting.id}`, "DELETE");
            toast.success("Task deleted");
            setDeleting(null);
            await load();
          } catch (err) {
            toast.error((err as Error).message);
          }
        }}
      />
    </div>
  );
}
