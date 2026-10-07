"use client";

// ===========================================================
// /admin/sequences/[key] — One flow in detail: its steps (timing, template,
// stream, condition) with per-step results, a sandboxed preview of each step,
// the enrollments with pause / resume / exit, and Backfill (dry run first,
// then an explicit confirm) for people who qualified before it was switched on.
// ===========================================================

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Eye, Users } from "lucide-react";
import { toast } from "sonner";
import { THEME } from "@/lib/theme";
import {
  Empty,
  PageHeader,
  Panel,
  Pill,
  Row,
  StatusChip,
  dangerBtn,
  disabledStyle,
  fmtDateTime,
  fmtRelative,
  ghostBtn,
  primaryBtn,
  tableStyles,
} from "@/components/admin/crm-ui";
import { ConfirmDialog } from "@/components/admin/crm-dialogs";
import { EmailStatusBanner } from "@/components/admin/email/status-banner";
import { FlowSwitch } from "@/components/admin/email/flow-switch";
import { EmailPreview, type RenderedEmail } from "@/components/admin/email/email-preview";
import { api, fmtOffset, pct, reasonLabel } from "@/components/admin/email/api";
import { useApi } from "@/components/admin/email/use-api";
import { toggleBody, type BackfillCount } from "@/components/admin/email/flow-copy";

type Step = { key: string; offsetHours: number; template: string; stream: string; topic: string | null; condition: string | null; maxLateHours: number | null };
type StepStats = { key: string; counts: Record<string, number>; skipped: Record<string, number> };
type Enrollment = {
  id: string;
  status: string;
  cycle: string;
  stepIndex: number;
  nextStep: string | null;
  anchorAt: string;
  nextRunAt: string | null;
  enrolledAt: string;
  exitReason: string | null;
  contact: { id: string; email: string | null; name: string | null };
};
type Detail = {
  key: string;
  name: string;
  kind: string;
  description: string;
  audience: string;
  isSequence: boolean;
  swept: boolean;
  active: number;
  trigger: string;
  enabled: boolean;
  steps: Step[];
  stepStats: StepStats[];
  enrollments: Enrollment[];
  total: number;
  page: number;
  pageSize: number;
};
type DryRun = BackfillCount;

const sum = (counts: Record<string, number>, keys: string[]) => keys.reduce((n, k) => n + (counts[k] ?? 0), 0);

export default function SequenceDetailPage() {
  const { key } = useParams<{ key: string }>();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const url = key ? `/api/admin/sequences/${key}?page=${page}${statusFilter ? `&status=${statusFilter}` : ""}` : null;
  const { data, error, reload } = useApi<Detail>(url);

  const [preview, setPreview] = useState<{ step: string; email: RenderedEmail | null; error: string | null } | null>(null);
  const [toggleOpen, setToggleOpen] = useState(false);
  const [toggleDry, setToggleDry] = useState<DryRun | null | "loading">(null);
  const [dry, setDry] = useState<DryRun | null>(null);
  const [dryBusy, setDryBusy] = useState(false);
  const [backfillOpen, setBackfillOpen] = useState(false);
  const [rowBusy, setRowBusy] = useState<string | null>(null);

  const showPreview = async (stepKey: string) => {
    setPreview({ step: stepKey, email: null, error: null });
    const res = await api<RenderedEmail>("/api/admin/email/preview", { method: "POST", json: { sequenceKey: key, stepKey } });
    setPreview({ step: stepKey, email: res.ok ? res.data : null, error: res.ok ? null : res.message });
  };

  const openToggle = async () => {
    if (!data) return;
    setToggleOpen(true);
    setToggleDry(null);
    if (data.enabled || !data.isSequence) return;
    setToggleDry("loading");
    const res = await api<DryRun>(`/api/admin/sequences/${key}/backfill`, { method: "POST", json: { dryRun: true } });
    setToggleDry(res.ok ? res.data : null);
  };

  const toggle = async () => {
    if (!data) return;
    const res = await api<{ enabled: boolean }>(`/api/admin/sequences/${key}`, { method: "PATCH", json: { enabled: !data.enabled } });
    if (!res.ok) return void toast.error(res.message);
    toast.success(`${data.name} is ${res.data.enabled ? "on" : "off"}.`);
    setToggleOpen(false);
    reload();
  };

  const dryRun = async () => {
    setDryBusy(true);
    const res = await api<DryRun>(`/api/admin/sequences/${key}/backfill`, { method: "POST", json: { dryRun: true } });
    setDryBusy(false);
    if (!res.ok) return void toast.error(res.message);
    setDry(res.data);
  };

  const backfill = async () => {
    const res = await api<{ candidates: number; enrolled: number }>(`/api/admin/sequences/${key}/backfill`, { method: "POST", json: { dryRun: false } });
    if (!res.ok) return void toast.error(res.message);
    toast.success(`Enrolled ${res.data.enrolled} of ${res.data.candidates}. Due steps go out at the next run.`);
    setBackfillOpen(false);
    setDry(null);
    reload();
  };

  const act = async (id: string, action: "pause" | "resume" | "exit") => {
    setRowBusy(id);
    const res = await api(`/api/admin/enrollments/${id}`, { method: "PATCH", json: { action } });
    setRowBusy(null);
    if (!res.ok) return void toast.error(res.message);
    reload();
  };

  if (error) {
    return (
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 28px" }}>
        <Panel>
          <Empty title="Couldn't load this flow" description={error} action={<Link href="/admin/sequences">Back to sequences</Link>} />
        </Panel>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 28px", fontFamily: THEME.fontSans }}>
      <Link href="/admin/sequences" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: THEME.textDim, textDecoration: "none", marginBottom: 12 }}>
        <ArrowLeft size={14} aria-hidden="true" /> Sequences
      </Link>
      <PageHeader
        title={data?.name ?? "…"}
        description={data ? `${data.description} Audience: ${data.audience}. Trigger: ${data.trigger}.` : null}
        actions={data ? <FlowSwitch on={data.enabled} label={`${data.name} ${data.enabled ? "on" : "off"}`} onClick={() => void openToggle()} /> : null}
      />
      <EmailStatusBanner />

      {data ? (
        <>
          <Panel title="Steps" description="Counts are all-time. A step more than its late limit past due is skipped, never sent days late." flush style={{ marginBottom: 20 }}>
            <div style={{ overflowX: "auto" }}>
              <table style={tableStyles.table}>
                <thead>
                  <tr>
                    {["Step", "When", "Stream", "Condition", "Sent", "Delivered", "Bounced", "Skipped", ""].map((h) => (
                      <th key={h || "actions"} scope="col" style={tableStyles.th}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.steps.map((s) => {
                    const st = data.stepStats.find((x) => x.key === s.key) ?? { counts: {}, skipped: {} };
                    const sent = sum(st.counts, ["sent", "delivered", "bounced", "complained"]);
                    const delivered = sum(st.counts, ["delivered", "complained"]);
                    const bounced = sum(st.counts, ["bounced"]);
                    const skippedTotal = Object.values(st.skipped).reduce((a, b) => a + b, 0);
                    return (
                      <tr key={s.key} style={tableStyles.tr}>
                        <td style={tableStyles.td}>
                          <div style={{ fontWeight: 600, color: THEME.text }}>{s.key.replace(/_/g, " ")}</div>
                          <div style={{ fontSize: 11, color: THEME.textMuted, fontFamily: THEME.fontMono }}>{s.template}</div>
                        </td>
                        <td style={{ ...tableStyles.td, whiteSpace: "nowrap" }}>
                          {data.isSequence ? fmtOffset(s.offsetHours) : "on request"}
                          {s.maxLateHours && s.maxLateHours !== 48 ? <div style={{ fontSize: 11, color: THEME.textMuted }}>late after {s.maxLateHours}h</div> : null}
                        </td>
                        <td style={tableStyles.td}>
                          <Pill color={s.stream === "marketing" ? THEME.accent : THEME.brand}>{s.stream}</Pill>
                          {s.topic ? <div style={{ fontSize: 11, color: THEME.textMuted, marginTop: 2 }}>{s.topic}</div> : null}
                        </td>
                        <td style={{ ...tableStyles.td, fontSize: 12, maxWidth: 240 }}>{s.condition ?? "—"}</td>
                        <td className="tnum" style={tableStyles.td}>{sent}</td>
                        <td className="tnum" style={tableStyles.td}>{pct(delivered, sent, 0)}</td>
                        <td className="tnum" style={tableStyles.td}>{bounced}</td>
                        <td style={{ ...tableStyles.td, fontSize: 12 }}>
                          {skippedTotal === 0
                            ? "0"
                            : Object.entries(st.skipped)
                                .map(([r, n]) => `${n} ${reasonLabel(r)}`)
                                .join(", ")}
                        </td>
                        <td style={{ ...tableStyles.td, textAlign: "right" }}>
                          {data.isSequence ? (
                            <button type="button" onClick={() => void showPreview(s.key)} style={ghostBtn} aria-label={`Preview ${s.key}`}>
                              <Eye size={14} aria-hidden="true" /> Preview
                            </button>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Panel>

          {preview ? (
            <Panel
              title={`Preview: ${preview.step.replace(/_/g, " ")}`}
              description="Sample data. Footer links are signed for your own contact."
              actions={
                <button type="button" style={ghostBtn} onClick={() => setPreview(null)}>
                  Close
                </button>
              }
              style={{ marginBottom: 20 }}
            >
              {preview.error ? (
                <Empty title="No preview" description={preview.error} />
              ) : preview.email ? (
                <EmailPreview email={preview.email} />
              ) : (
                <Empty title="Rendering…" />
              )}
            </Panel>
          ) : null}

          {data.isSequence ? (
            <>
              <Panel
                title="Backfill"
                description="Enroll people who qualified before this flow was on. Nobody is enrolled until you confirm."
                style={{ marginBottom: 20 }}
              >
                <Row gap={12}>
                  <button type="button" onClick={() => void dryRun()} disabled={dryBusy} style={disabledStyle(ghostBtn, dryBusy)}>
                    <Users size={14} aria-hidden="true" /> {dryBusy ? "Counting…" : "Dry run"}
                  </button>
                  {dry ? (
                    <>
                      <span style={{ fontSize: 13, color: THEME.textDim }}>
                        {dry.candidates} would be enrolled · {dry.stepsToSend} steps would send · {dry.stepsLate} already too late (skipped)
                      </span>
                      <button
                        type="button"
                        onClick={() => setBackfillOpen(true)}
                        disabled={!data.enabled || dry.candidates === 0}
                        style={disabledStyle(primaryBtn, !data.enabled || dry.candidates === 0)}
                        title={data.enabled ? undefined : "Turn the flow on first"}
                      >
                        Enroll {dry.candidates}
                      </button>
                    </>
                  ) : null}
                </Row>
              </Panel>

              <Panel
                title={`Enrollments (${data.total})`}
                flush
                actions={
                  <select
                    aria-label="Filter enrollments by status"
                    value={statusFilter}
                    onChange={(e) => {
                      setStatusFilter(e.target.value);
                      setPage(1);
                    }}
                    style={{ ...ghostBtn, padding: "6px 10px" }}
                  >
                    <option value="">All statuses</option>
                    {["active", "paused", "completed", "exited"].map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                }
              >
                {data.enrollments.length === 0 ? (
                  <Empty title="No enrollments" description={data.enabled ? "People join when the trigger fires." : "This flow is off."} />
                ) : (
                  <div style={{ overflowX: "auto" }}>
                    <table style={tableStyles.table}>
                      <thead>
                        <tr>
                          {["Contact", "Status", "Next step", "Next run", "Enrolled", ""].map((h) => (
                            <th key={h || "actions"} scope="col" style={tableStyles.th}>
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {data.enrollments.map((e) => (
                          <tr key={e.id} style={tableStyles.tr}>
                            <td style={tableStyles.td}>
                              <Link href={`/admin/contacts/${e.contact.id}`} style={{ color: THEME.text, fontWeight: 600, textDecoration: "none" }}>
                                {e.contact.name || e.contact.email || e.contact.id}
                              </Link>
                              {e.contact.name && e.contact.email ? <div style={{ fontSize: 12, color: THEME.textMuted }}>{e.contact.email}</div> : null}
                            </td>
                            <td style={tableStyles.td}>
                              <StatusChip status={e.status} />
                              {e.exitReason ? <div style={{ fontSize: 11, color: THEME.textMuted, marginTop: 2 }}>{e.exitReason.replace(/_/g, " ")}</div> : null}
                            </td>
                            <td style={{ ...tableStyles.td, fontSize: 12 }}>{e.nextStep?.replace(/_/g, " ") ?? "—"}</td>
                            <td style={{ ...tableStyles.td, fontSize: 12 }} title={fmtDateTime(e.nextRunAt)}>
                              {e.status === "active" && e.nextRunAt ? fmtRelative(e.nextRunAt) : "—"}
                            </td>
                            <td style={{ ...tableStyles.td, fontSize: 12 }} title={fmtDateTime(e.enrolledAt)}>
                              {fmtRelative(e.enrolledAt)}
                            </td>
                            <td style={{ ...tableStyles.td, textAlign: "right", whiteSpace: "nowrap" }}>
                              {e.status === "active" ? (
                                <button type="button" disabled={rowBusy === e.id} onClick={() => void act(e.id, "pause")} style={disabledStyle(ghostBtn, rowBusy === e.id)}>
                                  Pause
                                </button>
                              ) : null}
                              {e.status === "paused" ? (
                                <button type="button" disabled={rowBusy === e.id} onClick={() => void act(e.id, "resume")} style={disabledStyle(ghostBtn, rowBusy === e.id)}>
                                  Resume
                                </button>
                              ) : null}
                              {e.status === "active" || e.status === "paused" ? (
                                <button
                                  type="button"
                                  disabled={rowBusy === e.id}
                                  onClick={() => void act(e.id, "exit")}
                                  style={{ ...disabledStyle(dangerBtn, rowBusy === e.id), marginLeft: 6 }}
                                >
                                  Exit
                                </button>
                              ) : null}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {data.total > data.pageSize ? (
                  <Row justify="space-between" style={{ padding: "10px 14px" }}>
                    <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} style={disabledStyle(ghostBtn, page <= 1)}>
                      Previous
                    </button>
                    <span style={{ fontSize: 12, color: THEME.textMuted }}>
                      Page {data.page} of {Math.ceil(data.total / data.pageSize)}
                    </span>
                    <button
                      type="button"
                      disabled={page * data.pageSize >= data.total}
                      onClick={() => setPage((p) => p + 1)}
                      style={disabledStyle(ghostBtn, page * data.pageSize >= data.total)}
                    >
                      Next
                    </button>
                  </Row>
                ) : null}
              </Panel>
            </>
          ) : null}

          <ConfirmDialog
            open={toggleOpen}
            title={`${data.enabled ? "Turn off" : "Turn on"} ${data.name}?`}
            body={toggleBody(data, toggleDry)}
            confirmLabel={data.enabled ? "Turn off" : "Turn on"}
            danger={data.enabled}
            onConfirm={toggle}
            onClose={() => setToggleOpen(false)}
          />
          <ConfirmDialog
            open={backfillOpen}
            title={`Enroll ${dry?.candidates ?? 0} people in ${data.name}?`}
            body={dry ? `${dry.stepsToSend} steps can still send; ${dry.stepsLate} are already too late and will be skipped. Each step re-checks consent before sending.` : null}
            confirmLabel="Enroll"
            onConfirm={backfill}
            onClose={() => setBackfillOpen(false)}
          />
        </>
      ) : (
        <Panel>
          <Empty title="Loading…" />
        </Panel>
      )}
    </div>
  );
}
