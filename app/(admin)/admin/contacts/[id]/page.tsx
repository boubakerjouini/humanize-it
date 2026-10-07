"use client";

// ===========================================================
// /admin/contacts/[id] — Contact 360: who they are, where they came from, what
// they agreed to, what they did, and what we sent. Header actions: personal
// email (through stream B's send path), log a touch, add a task, and the
// "More" menu. Admins can withdraw consent or suppress, never grant consent.
// ===========================================================

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Check, ChevronDown, ExternalLink, ListTodo, Mail, MessageSquarePlus, Pencil, Plus, Tag as TagIcon, Trash2, X } from "lucide-react";
import { THEME } from "@/lib/theme";
import { PIPELINE_STAGES, TOPIC_LABELS, isTopic } from "@/lib/growth/constants";
import { STAGES, STAGE_LABELS } from "@/lib/crm/lifecycle";
import { scriptVarsFor } from "@/lib/crm/scripts";
import {
  Empty,
  Field,
  Panel,
  Pill,
  Row,
  ScoreBadge,
  StagePill,
  StatusChip,
  TopicChips,
  fmtDate,
  fmtDateTime,
  fmtRelative,
  ghostBtn,
  primaryBtn,
  tableStyles,
} from "@/components/admin/crm-ui";
import { ConfirmDialog, Popover, Tabs, tabId, tabPanelId, usePopoverClose } from "@/components/admin/crm-dialogs";
import { ContactAvatar, Spinner, Timeline, TypeBadge, contactLabel, humanizeKey, type TimelineEntry } from "@/components/admin/crm/contact-bits";
import { LogTouchDialog, TaskDialog } from "@/components/admin/crm/crm-forms";
import { EmailComposer } from "@/components/admin/crm/email-composer";
import { FormDialog, FormField, inputStyle, selectStyle, sendJson } from "@/components/admin/crm/form-dialog";

type ScoreLine = { key: string; label: string; points: number; detail: string };
type Task = { id: string; title: string; kind: string; priority: string; status: string; dueAt: string | null; source: string; ruleKey: string | null; completedAt: string | null };

type Detail = {
  contact: {
    id: string;
    email: string | null;
    name: string | null;
    company: string | null;
    handle: string | null;
    phone: string | null;
    userId: string | null;
    type: string;
    stage: string;
    stageOverride: string | null;
    stageChangedAt: string | null;
    pipelineStage: string | null;
    score: number;
    scoreBreakdown: ScoreLine[];
    scoredAt: string | null;
    source: string;
    channel: string | null;
    referrerHost: string | null;
    landingPath: string | null;
    utmSource: string | null;
    utmMedium: string | null;
    utmCampaign: string | null;
    utmContent: string | null;
    firstTouchAt: string | null;
    lastTouch: { ch?: string; rh?: string; lp?: string; us?: string; um?: string; uc?: string; ts?: number } | null;
    magnets: string[];
    subscribedTopics: string[];
    pendingTopics: string[];
    lifecycleEmails: boolean;
    emailVerifiedAt: string | null;
    emailStatus: string;
    unsubscribedAt: string | null;
    lastEmailedAt: string | null;
    lastActiveAt: string | null;
    firstDocumentAt: string | null;
    createdAt: string;
  };
  stageReason: string | null;
  liveStage: string | null;
  account: {
    id: string;
    email: string;
    name: string | null;
    role: string;
    plan: string;
    effectivePlan: string | null;
    planExpiresAt: string | null;
    wordsUsed: number;
    rewriteCount: number;
    createdAt: string;
    documentCount: number;
    subscriptionStatus: string | null;
    renewsAt: string | null;
    paying: boolean;
    lastCode: string | null;
  } | null;
  emails: { id: string; template: string; stream: string; subject: string | null; status: string; skipReason: string | null; error: string | null; sequenceKey: string | null; queuedAt: string; sentAt: string | null }[];
  enrollments: { id: string; sequenceKey: string; cycle: string; status: string; stepIndex: number; nextRunAt: string | null; exitReason: string | null; enrolledAt: string }[];
  tasks: Task[];
  notes: { id: string; source: "admin_note" | "event"; body: string; author: string; createdAt: string }[];
  tags: { id: string; name: string; color: string }[];
  consents: { id: string; topic: string; action: string; method: string; wording: string | null; source: string | null; actor: string | null; createdAt: string }[];
  suppressions: { id: string; scope: string; reason: string; source: string | null; note: string | null; createdAt: string }[];
  referral: {
    enabled: boolean;
    code: string | null;
    referredBy: { status: string; code: string; referrer: { id: string; name: string | null; email: string | null } } | null;
    made: { status: string; count: number; words: number }[];
    bonusWords: number;
    bonusAvailable: number;
    bonusExpiresAt: string | null;
  };
  timeline: TimelineEntry[];
  emailMode: string;
};

type Dialog = null | "email" | "touch" | "task" | "edit" | "bonus" | "delete" | "withdraw" | "lifecycle";

export default function ContactPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [d, setD] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [tab, setTab] = useState("timeline");

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/contacts/${id}`);
      if (res.status === 404) {
        setMissing(true);
        setD(null);
        return;
      }
      // Any other failure keeps what is on screen; the empty state offers a retry.
      if (!res.ok) {
        toast.error("Failed to load the contact.");
        return;
      }
      setMissing(false);
      setD((await res.json()) as Detail);
    } catch {
      toast.error("Network error.");
    } finally {
      setLoading(false);
    }
  }, [id]);
  useEffect(() => {
    void load();
  }, [load]);

  const patch = useCallback(
    async (payload: Record<string, unknown>, ok = "Saved") => {
      setBusy(true);
      try {
        await sendJson(`/api/admin/contacts/${id}`, "PATCH", payload);
        toast.success(ok);
        await load();
        return true;
      } catch (err) {
        toast.error((err as Error).message);
        return false;
      } finally {
        setBusy(false);
      }
    },
    [id, load]
  );

  const done = () => {
    setDialog(null);
    void load();
  };

  if (loading) return <Spinner />;
  if (!d) {
    return (
      <div style={{ maxWidth: 600, margin: "60px auto", fontFamily: THEME.fontSans }}>
        {missing ? (
          <Empty title="Contact not found" description="It may have been deleted or merged into another contact." action={<Link href="/admin/contacts" style={ghostBtn}>All contacts</Link>} />
        ) : (
          <Empty
            title="Couldn't load this contact"
            action={
              <button type="button" onClick={() => void load()} style={ghostBtn}>
                Try again
              </button>
            }
          />
        )}
      </div>
    );
  }

  const c = d.contact;
  const name = contactLabel(c);
  const hasConsent = c.subscribedTopics.length > 0;
  const vars = scriptVarsFor({
    name: c.name ?? d.account?.name,
    company: c.company,
    signedUpAt: d.account?.createdAt,
    plan: d.account?.plan,
    planExpiresAt: d.account?.planExpiresAt,
    code: d.account?.lastCode,
    docCount: d.account?.documentCount,
  });
  const openTasks = d.tasks.filter((t) => t.status === "open");

  return (
    <div style={{ maxWidth: 1180, margin: "0 auto", padding: "28px 28px 64px", fontFamily: THEME.fontSans }}>
      <Link href="/admin/contacts" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: THEME.textDim, textDecoration: "none", marginBottom: 18, fontWeight: 600 }}>
        <ArrowLeft size={14} aria-hidden="true" /> All contacts
      </Link>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 16, marginBottom: 18, flexWrap: "wrap" }}>
        <ContactAvatar c={c} size={56} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <Row gap={8}>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: THEME.text, fontFamily: THEME.fontHeading, letterSpacing: "-0.02em", margin: 0 }}>{name}</h1>
            <TypeBadge type={c.type} />
            <StageMenu stage={c.stage} override={c.stageOverride} reason={d.stageReason} disabled={busy} onPick={(stage) => patch({ action: "setStageOverride", stage }, stage ? "Stage pinned" : "Override cleared")} />
            <Popover trigger={<ScoreBadge score={c.score} />} label="Why this score" width={320}>
              <ScoreBreakdown lines={c.scoreBreakdown} score={c.score} scoredAt={c.scoredAt} onRecompute={() => patch({ action: "recompute" }, "Recomputed")} />
            </Popover>
          </Row>
          <div style={{ fontSize: 13, color: THEME.textDim, marginTop: 4 }}>
            {[c.email, c.company, c.handle].filter(Boolean).join(" · ") || "No contact details yet"}
          </div>
        </div>
        <Row gap={8}>
          <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: THEME.textMuted }}>
            Pipeline
            <select
              value={c.pipelineStage ?? ""}
              disabled={busy}
              onChange={(e) => patch({ action: "setPipelineStage", stage: e.target.value || null }, "Pipeline updated")}
              style={selectStyle}
            >
              <option value="">Not on the pipeline</option>
              {PIPELINE_STAGES.map((s) => (
                <option key={s} value={s}>
                  {humanizeKey(s)}
                </option>
              ))}
            </select>
          </label>
        </Row>
      </div>

      {/* Actions */}
      <Row gap={8} style={{ marginBottom: 22, padding: 12, background: THEME.surface2, border: `1px solid ${THEME.border}`, borderRadius: THEME.radiusLg }}>
        <button type="button" onClick={() => setDialog("email")} disabled={!c.email} style={c.email ? primaryBtn : { ...primaryBtn, opacity: 0.55, cursor: "not-allowed" }} title={c.email ? undefined : "No email address"}>
          <Mail size={14} aria-hidden="true" /> Email
        </button>
        <button type="button" onClick={() => setDialog("touch")} style={ghostBtn}>
          <MessageSquarePlus size={14} aria-hidden="true" /> Log touch
        </button>
        <button type="button" onClick={() => setDialog("task")} style={ghostBtn}>
          <ListTodo size={14} aria-hidden="true" /> Add task
        </button>
        <button type="button" onClick={() => setDialog("edit")} style={ghostBtn}>
          <Pencil size={14} aria-hidden="true" /> Edit
        </button>
        {d.account ? (
          <Link href={`/admin/users/${d.account.id}`} style={ghostBtn}>
            <ExternalLink size={14} aria-hidden="true" /> Customer page
          </Link>
        ) : null}
        <div style={{ flex: 1 }} />
        <Popover
          trigger={
            <span style={{ ...ghostBtn }}>
              More <ChevronDown size={13} aria-hidden="true" />
            </span>
          }
          label="More actions"
          align="end"
          width={260}
        >
          <MoreMenu
            d={d}
            busy={busy}
            onDialog={setDialog}
            onPatch={patch}
          />
        </Popover>
      </Row>

      <div className="crm-360-grid" style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1.35fr)", gap: 16, alignItems: "start" }}>
        {/* Left column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
          <Panel title="Profile & attribution">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <Field label="Source">{humanizeKey(c.source)}</Field>
              <Field label="Channel">{humanizeKey(c.channel)}</Field>
              <Field label="First touch" hint={c.landingPath ? `landed on ${c.landingPath}` : undefined}>
                {c.firstTouchAt ? fmtDate(c.firstTouchAt) : "—"}
                {c.referrerHost ? ` from ${c.referrerHost}` : ""}
              </Field>
              <Field label="UTM">{[c.utmSource, c.utmMedium, c.utmCampaign, c.utmContent].filter(Boolean).join(" / ") || "—"}</Field>
              <Field label="Last touch">
                {c.lastTouch ? [humanizeKey(c.lastTouch.ch), c.lastTouch.rh, c.lastTouch.lp].filter(Boolean).join(" · ") : "—"}
              </Field>
              <Field label="Magnets">{c.magnets.length ? c.magnets.join(", ") : "—"}</Field>
              <Field label="Created">{fmtDate(c.createdAt)}</Field>
              <Field label="Last active">{c.lastActiveAt ? fmtRelative(c.lastActiveAt) : "—"}</Field>
              {c.phone ? <Field label="Phone">{c.phone}</Field> : null}
            </div>
          </Panel>

          <Panel title="Consent & email">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <Field label="Topics">
                <TopicChips topics={c.subscribedTopics} pending={c.pendingTopics} />
              </Field>
              <Field label="Lifecycle email">{c.lifecycleEmails ? "On" : "Off"}</Field>
              <Field label="Verified">{c.emailVerifiedAt ? fmtDate(c.emailVerifiedAt) : "No"}</Field>
              <Field label="Status">
                <StatusChip status={c.emailStatus} />
              </Field>
              <Field label="Unsubscribed">{c.unsubscribedAt ? fmtDate(c.unsubscribedAt) : "—"}</Field>
              <Field label="Last emailed">{c.lastEmailedAt ? fmtRelative(c.lastEmailedAt) : "Never"}</Field>
            </div>
            {d.suppressions.length > 0 ? (
              <div style={{ marginTop: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: THEME.textMuted, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6 }}>Suppressions</div>
                {d.suppressions.map((s) => (
                  <Row key={s.id} gap={6} style={{ fontSize: 12, padding: "4px 0" }}>
                    <Pill color={THEME.ai}>{s.scope}</Pill>
                    <span style={{ color: THEME.textDim }}>
                      {s.reason} · {fmtDate(s.createdAt)}
                    </span>
                    {s.reason === "manual" ? (
                      <button type="button" disabled={busy} onClick={() => patch({ action: "unsuppress", suppressionId: s.id }, "Suppression lifted")} style={{ border: "none", background: "none", color: THEME.brandHi, cursor: "pointer", fontSize: 12 }}>
                        Lift
                      </button>
                    ) : null}
                  </Row>
                ))}
              </div>
            ) : null}
            <details style={{ marginTop: 14 }}>
              <summary style={{ fontSize: 12, fontWeight: 600, color: THEME.textDim, cursor: "pointer" }}>Consent records ({d.consents.length})</summary>
              {d.consents.length === 0 ? (
                <div style={{ fontSize: 12, color: THEME.textMuted, padding: "6px 0" }}>No consent recorded.</div>
              ) : (
                d.consents.map((r) => (
                  <div key={r.id} style={{ fontSize: 12, color: THEME.textDim, padding: "6px 0", borderTop: `1px solid ${THEME.border}` }}>
                    <strong style={{ color: THEME.text }}>
                      {r.action} {isTopic(r.topic) ? TOPIC_LABELS[r.topic] : r.topic}
                    </strong>{" "}
                    via {r.method}
                    {r.wording ? ` (${r.wording})` : ""}
                    <div style={{ color: THEME.textMuted }}>
                      {fmtDateTime(r.createdAt)}
                      {r.source ? ` · ${r.source}` : ""}
                      {r.actor ? ` · ${r.actor}` : ""}
                    </div>
                  </div>
                ))
              )}
            </details>
          </Panel>

          {d.account ? (
            <Panel title="Account" actions={<Link href={`/admin/users/${d.account.id}`} style={{ fontSize: 12, color: THEME.brandHi, fontWeight: 600 }}>Customer 360</Link>}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <Field label="Plan" hint={d.account.effectivePlan && d.account.effectivePlan !== d.account.plan ? `effective: ${d.account.effectivePlan}` : undefined}>
                  {d.account.plan}
                  {d.account.paying ? " (paying)" : d.account.plan !== "FREE" ? " (comped)" : ""}
                </Field>
                <Field label="Expires">{d.account.planExpiresAt ? fmtDate(d.account.planExpiresAt) : d.account.plan === "FREE" ? "—" : "No expiry"}</Field>
                <Field label="Usage">
                  {d.account.wordsUsed.toLocaleString()} words · {d.account.rewriteCount} rewrites
                </Field>
                <Field label="Documents">{d.account.documentCount.toLocaleString()}</Field>
                <Field label="Subscription">{d.account.subscriptionStatus ?? "None"}</Field>
                <Field label="Signed up">{fmtDate(d.account.createdAt)}</Field>
              </div>
            </Panel>
          ) : null}

          <Panel title="Referral & bonus" description={d.referral.enabled ? undefined : "Referrals are off (REFERRALS_ENABLED)."}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <Field label="Referral code">{d.referral.code ? <code>{d.referral.code}</code> : "—"}</Field>
              <Field label="Referred by">
                {d.referral.referredBy ? (
                  <Link href={`/admin/contacts/${d.referral.referredBy.referrer.id}`} style={{ color: THEME.brandHi }}>
                    {contactLabel({ id: d.referral.referredBy.referrer.id, name: d.referral.referredBy.referrer.name, email: d.referral.referredBy.referrer.email })}
                  </Link>
                ) : (
                  "—"
                )}
              </Field>
              <Field label="Referrals made">{d.referral.made.length ? d.referral.made.map((m) => `${m.count} ${m.status}`).join(", ") : "None"}</Field>
              <Field label="Bonus words" hint={d.referral.bonusExpiresAt ? `expires ${fmtDate(d.referral.bonusExpiresAt)}` : undefined}>
                {d.referral.bonusAvailable.toLocaleString()}
                {d.referral.bonusWords !== d.referral.bonusAvailable ? ` (${d.referral.bonusWords.toLocaleString()} expired)` : ""}
              </Field>
            </div>
          </Panel>

          <TagsPanel contactId={c.id} tags={d.tags} onChange={load} />
        </div>

        {/* Right column */}
        <div style={{ minWidth: 0 }}>
          <Panel>
            <Tabs
              idPrefix="c360"
              label="Contact activity"
              value={tab}
              onChange={setTab}
              tabs={[
                { id: "timeline", label: "Timeline", count: d.timeline.length },
                { id: "emails", label: "Emails", count: d.emails.length },
                { id: "sequences", label: "Sequences", count: d.enrollments.length },
                { id: "tasks", label: "Tasks", count: openTasks.length },
                { id: "notes", label: "Notes", count: d.notes.length },
              ]}
            />
            <div role="tabpanel" id={tabPanelId("c360", tab)} aria-labelledby={tabId("c360", tab)}>
              {tab === "timeline" ? <Timeline items={d.timeline} /> : null}
              {tab === "emails" ? <EmailsTable emails={d.emails} /> : null}
              {tab === "sequences" ? <EnrollmentsTable rows={d.enrollments} /> : null}
              {tab === "tasks" ? <TasksList tasks={d.tasks} onChange={load} onAdd={() => setDialog("task")} /> : null}
              {tab === "notes" ? <NotesPanel contactId={c.id} notes={d.notes} onChange={load} /> : null}
            </div>
          </Panel>
        </div>
      </div>

      <EmailComposer
        open={dialog === "email"}
        contactId={c.id}
        to={c.email}
        hasMarketingConsent={hasConsent}
        emailMode={d.emailMode}
        vars={vars}
        onClose={() => setDialog(null)}
        onSent={done}
      />
      <LogTouchDialog open={dialog === "touch"} contact={c} pipelineStage={c.pipelineStage} onClose={() => setDialog(null)} onDone={done} />
      <TaskDialog open={dialog === "task"} contact={c} onClose={() => setDialog(null)} onDone={done} />
      <EditDialog open={dialog === "edit"} d={d} onClose={() => setDialog(null)} onDone={done} />
      <BonusDialog open={dialog === "bonus"} contactId={c.id} onClose={() => setDialog(null)} onDone={done} />
      <ConfirmDialog
        open={dialog === "withdraw"}
        title="Withdraw all marketing topics?"
        body="They stop receiving tips and launch updates. Only they can subscribe again, from their own preferences."
        confirmLabel="Withdraw"
        danger
        onClose={() => setDialog(null)}
        onConfirm={async () => {
          if (await patch({ action: "withdrawTopics", topics: "all" }, "Topics withdrawn")) setDialog(null);
        }}
      />
      <ConfirmDialog
        open={dialog === "lifecycle"}
        title="Turn lifecycle email off?"
        body="No onboarding or account emails beyond the essential ones. An admin can't turn it back on; the person can, from their preferences."
        confirmLabel="Turn off"
        danger
        onClose={() => setDialog(null)}
        onConfirm={async () => {
          if (await patch({ action: "setLifecycleOff" }, "Lifecycle email off")) setDialog(null);
        }}
      />
      <ConfirmDialog
        open={dialog === "delete"}
        title={`Delete ${name}?`}
        body="This removes the contact, its timeline and tasks. Withdrawn consent and bounces are kept as hashed suppressions so they are never emailed again."
        confirmLabel="Delete"
        requireText="DELETE"
        danger
        onClose={() => setDialog(null)}
        onConfirm={async () => {
          try {
            await sendJson(`/api/admin/contacts/${c.id}`, "DELETE");
            toast.success("Contact deleted");
            router.push("/admin/contacts");
          } catch (err) {
            toast.error((err as Error).message);
          }
        }}
      />
      <style>{`@media (max-width: 900px) { .crm-360-grid { grid-template-columns: minmax(0, 1fr) !important; } }`}</style>
    </div>
  );
}

// ── Header pieces ───────────────────────────────────────────────────────────

function StageMenu({ stage, override, reason, disabled, onPick }: { stage: string; override: string | null; reason: string | null; disabled: boolean; onPick: (stage: string | null) => void }) {
  return (
    <Popover trigger={<StagePill stage={stage} overridden={!!override} />} label="Lifecycle stage" width={240}>
      <StageMenuBody stage={stage} override={override} reason={reason} disabled={disabled} onPick={onPick} />
    </Popover>
  );
}

function StageMenuBody({ stage, override, reason, disabled, onPick }: { stage: string; override: string | null; reason: string | null; disabled: boolean; onPick: (stage: string | null) => void }) {
  const close = usePopoverClose();
  const pick = (s: string | null) => {
    close();
    onPick(s);
  };
  return (
    <div>
      <div style={{ fontSize: 12, color: THEME.textDim, marginBottom: 8 }}>
        {override ? "Pinned by an admin." : `Automatic${reason ? `: ${reason}` : ""}.`}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2, maxHeight: 280, overflowY: "auto" }}>
        {STAGES.map((s) => (
          <button key={s} type="button" disabled={disabled} onClick={() => pick(s)} style={menuItem}>
            <span style={{ width: 14 }}>{stage === s ? <Check size={13} aria-hidden="true" /> : null}</span>
            Pin to {STAGE_LABELS[s]}
          </button>
        ))}
      </div>
      {override ? (
        <button type="button" disabled={disabled} onClick={() => pick(null)} style={{ ...menuItem, marginTop: 6, color: THEME.brandHi, fontWeight: 600 }}>
          Clear override (automatic)
        </button>
      ) : null}
    </div>
  );
}

const menuItem: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  width: "100%",
  padding: "6px 8px",
  border: "none",
  borderRadius: 6,
  background: "transparent",
  color: THEME.text,
  fontSize: 13,
  textAlign: "left",
  cursor: "pointer",
};

function ScoreBreakdown({ lines, score, scoredAt, onRecompute }: { lines: ScoreLine[]; score: number; scoredAt: string | null; onRecompute: () => void }) {
  const close = usePopoverClose();
  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Score {score}</div>
      {lines.length === 0 ? (
        <div style={{ fontSize: 12, color: THEME.textMuted }}>No scoring signals yet.</div>
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {lines.map((l) => (
            <li key={l.key} style={{ display: "flex", gap: 8, padding: "4px 0", borderTop: `1px solid ${THEME.border}`, fontSize: 12 }}>
              <span className="tnum" style={{ width: 34, fontWeight: 700, color: l.points < 0 ? THEME.ai : THEME.human }}>
                {l.points > 0 ? `+${l.points}` : l.points}
              </span>
              <span>
                <span style={{ color: THEME.text }}>{l.label}</span>
                <span style={{ color: THEME.textMuted }}> · {l.detail}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10, fontSize: 11, color: THEME.textMuted }}>
        {scoredAt ? `Scored ${fmtRelative(scoredAt)}` : "Not scored yet"}
        <button
          type="button"
          onClick={() => {
            close();
            onRecompute();
          }}
          style={{ border: "none", background: "none", color: THEME.brandHi, cursor: "pointer", fontSize: 12, fontWeight: 600 }}
        >
          Recompute
        </button>
      </div>
    </div>
  );
}

function MoreMenu({ d, busy, onDialog, onPatch }: { d: Detail; busy: boolean; onDialog: (x: Dialog) => void; onPatch: (p: Record<string, unknown>, ok?: string) => Promise<boolean> }) {
  const close = usePopoverClose();
  const c = d.contact;
  const run = (fn: () => void) => () => {
    close();
    fn();
  };
  const hasTopics = c.subscribedTopics.length + c.pendingTopics.length > 0;
  const suppressed = (scope: string) => d.suppressions.some((s) => s.scope === scope);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <button type="button" disabled={busy || !hasTopics} onClick={run(() => onDialog("withdraw"))} style={{ ...menuItem, opacity: hasTopics ? 1 : 0.5 }}>
        Withdraw marketing topics
      </button>
      <button type="button" disabled={busy || !c.lifecycleEmails} onClick={run(() => onDialog("lifecycle"))} style={{ ...menuItem, opacity: c.lifecycleEmails ? 1 : 0.5 }}>
        Turn lifecycle email off
      </button>
      <button type="button" disabled={busy || !c.email || suppressed("marketing")} onClick={run(() => void onPatch({ action: "suppress", scope: "marketing" }, "Suppressed for marketing"))} style={{ ...menuItem, opacity: c.email && !suppressed("marketing") ? 1 : 0.5 }}>
        Suppress marketing email
      </button>
      <button type="button" disabled={busy || !c.email || suppressed("all")} onClick={run(() => void onPatch({ action: "suppress", scope: "all" }, "Suppressed for all email"))} style={{ ...menuItem, opacity: c.email && !suppressed("all") ? 1 : 0.5 }}>
        Suppress all email
      </button>
      {d.referral.enabled ? (
        <button type="button" disabled={busy} onClick={run(() => onDialog("bonus"))} style={menuItem}>
          Grant bonus words
        </button>
      ) : null}
      <button type="button" disabled={busy} onClick={run(() => void onPatch({ action: "recompute" }, "Recomputed"))} style={menuItem}>
        Recompute stage and score
      </button>
      {c.type !== "user" ? (
        <button type="button" disabled={busy} onClick={run(() => onDialog("delete"))} style={{ ...menuItem, color: THEME.ai, borderTop: `1px solid ${THEME.border}`, marginTop: 4, paddingTop: 8 }}>
          <Trash2 size={13} aria-hidden="true" /> Delete contact
        </button>
      ) : (
        <div style={{ fontSize: 11, color: THEME.textMuted, padding: "6px 8px", borderTop: `1px solid ${THEME.border}`, marginTop: 4 }}>Customers are deleted from their customer page.</div>
      )}
    </div>
  );
}

// ── Panels ──────────────────────────────────────────────────────────────────

function TagsPanel({ contactId, tags, onChange }: { contactId: string; tags: Detail["tags"]; onChange: () => Promise<void> | void }) {
  const [name, setName] = useState("");
  const add = async () => {
    if (!name.trim()) return;
    try {
      await sendJson(`/api/admin/contacts/${contactId}/tags`, "POST", { name: name.trim() });
      setName("");
      await onChange();
    } catch (err) {
      toast.error((err as Error).message);
    }
  };
  const remove = async (tagId: string) => {
    try {
      await sendJson(`/api/admin/contacts/${contactId}/tags`, "DELETE", { tagId });
      await onChange();
    } catch (err) {
      toast.error((err as Error).message);
    }
  };
  return (
    <Panel title="Tags">
      <Row gap={6}>
        <TagIcon size={14} color={THEME.textMuted} aria-hidden="true" />
        {tags.length === 0 ? <span style={{ fontSize: 12, color: THEME.textMuted }}>No tags</span> : null}
        {tags.map((t) => (
          <span key={t.id} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: "#fff", background: t.color, borderRadius: 999, padding: "3px 10px" }}>
            {t.name}
            <button type="button" onClick={() => remove(t.id)} aria-label={`Remove ${t.name}`} style={{ background: "none", border: "none", color: "#fff", cursor: "pointer", display: "inline-flex", padding: 0 }}>
              <X size={11} />
            </button>
          </span>
        ))}
      </Row>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void add();
        }}
        style={{ display: "flex", gap: 6, marginTop: 10 }}
      >
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder="Add a tag…" aria-label="Add a tag" style={{ ...inputStyle, maxWidth: 220 }} />
        <button type="submit" style={{ ...ghostBtn, padding: "7px 10px" }} aria-label="Add tag">
          <Plus size={13} aria-hidden="true" />
        </button>
      </form>
    </Panel>
  );
}

function EmailsTable({ emails }: { emails: Detail["emails"] }) {
  if (emails.length === 0) return <Empty title="No emails yet" />;
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={tableStyles.table}>
        <thead>
          <tr>
            {["Email", "Stream", "Status", "When"].map((h) => (
              <th key={h} style={tableStyles.th}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {emails.map((m) => (
            <tr key={m.id} style={tableStyles.tr}>
              <td style={tableStyles.td}>
                <div style={{ color: THEME.text }}>{m.subject ?? m.template}</div>
                <div style={{ fontSize: 11, color: THEME.textMuted }}>{m.sequenceKey ? `${m.sequenceKey} · ${m.template}` : m.template}</div>
              </td>
              <td style={tableStyles.td}>{m.stream}</td>
              <td style={tableStyles.td}>
                <StatusChip status={m.status} />
                {m.skipReason ? <div style={{ fontSize: 11, color: THEME.textMuted }}>{m.skipReason}</div> : null}
              </td>
              <td style={{ ...tableStyles.td, whiteSpace: "nowrap" }}>{fmtRelative(m.sentAt ?? m.queuedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EnrollmentsTable({ rows }: { rows: Detail["enrollments"] }) {
  if (rows.length === 0) return <Empty title="Not in any sequence" />;
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={tableStyles.table}>
        <thead>
          <tr>
            {["Sequence", "Status", "Next step", "Enrolled"].map((h) => (
              <th key={h} style={tableStyles.th}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((e) => (
            <tr key={e.id} style={tableStyles.tr}>
              <td style={tableStyles.td}>
                {humanizeKey(e.sequenceKey)}
                {e.cycle !== "1" ? <span style={{ color: THEME.textMuted }}> · cycle {e.cycle}</span> : null}
              </td>
              <td style={tableStyles.td}>
                {e.status}
                {e.exitReason ? <span style={{ color: THEME.textMuted }}> ({e.exitReason})</span> : null}
              </td>
              <td style={tableStyles.td}>{e.status === "active" && e.nextRunAt ? `step ${e.stepIndex + 1}, ${fmtRelative(e.nextRunAt)}` : "—"}</td>
              <td style={{ ...tableStyles.td, whiteSpace: "nowrap" }}>{fmtDate(e.enrolledAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TasksList({ tasks, onChange, onAdd }: { tasks: Task[]; onChange: () => Promise<void> | void; onAdd: () => void }) {
  const update = async (id: string, status: string) => {
    try {
      await sendJson(`/api/admin/tasks/${id}`, "PATCH", { status });
      await onChange();
    } catch (err) {
      toast.error((err as Error).message);
    }
  };
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
        <button type="button" onClick={onAdd} style={{ ...ghostBtn, padding: "6px 10px" }}>
          <Plus size={13} aria-hidden="true" /> Add task
        </button>
      </div>
      {tasks.length === 0 ? (
        <Empty title="No tasks" />
      ) : (
        tasks.map((t) => (
          <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderTop: `1px solid ${THEME.border}`, opacity: t.status === "open" ? 1 : 0.6 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, color: THEME.text, textDecoration: t.status === "done" ? "line-through" : undefined }}>{t.title}</div>
              <div style={{ fontSize: 11, color: THEME.textMuted }}>
                {t.priority} · {humanizeKey(t.kind)}
                {t.dueAt ? ` · due ${fmtDate(t.dueAt)}` : ""}
                {t.source === "rule" ? " · rule" : ""}
                {t.status !== "open" ? ` · ${t.status}` : ""}
              </div>
            </div>
            {t.status === "open" ? (
              <>
                <button type="button" onClick={() => update(t.id, "done")} style={{ ...ghostBtn, padding: "5px 9px" }}>
                  <Check size={13} aria-hidden="true" /> Done
                </button>
                <button type="button" onClick={() => update(t.id, "dismissed")} style={{ ...ghostBtn, padding: "5px 9px" }} aria-label={`Dismiss ${t.title}`}>
                  <X size={13} aria-hidden="true" />
                </button>
              </>
            ) : (
              <button type="button" onClick={() => update(t.id, "open")} style={{ ...ghostBtn, padding: "5px 9px" }}>
                Reopen
              </button>
            )}
          </div>
        ))
      )}
    </div>
  );
}

function NotesPanel({ contactId, notes, onChange }: { contactId: string; notes: Detail["notes"]; onChange: () => Promise<void> | void }) {
  const [body, setBody] = useState("");
  const add = async () => {
    if (!body.trim()) return;
    try {
      await sendJson(`/api/admin/contacts/${contactId}/notes`, "POST", { body: body.trim() });
      setBody("");
      await onChange();
    } catch (err) {
      toast.error((err as Error).message);
    }
  };
  const remove = async (noteId: string, source: string) => {
    try {
      await sendJson(`/api/admin/contacts/${contactId}/notes`, "DELETE", { noteId, source });
      await onChange();
    } catch (err) {
      toast.error((err as Error).message);
    }
  };
  return (
    <div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void add();
        }}
        style={{ display: "flex", gap: 8, marginBottom: 10 }}
      >
        <input value={body} onChange={(e) => setBody(e.target.value)} maxLength={500} placeholder="Add a note…" aria-label="Add a note" style={inputStyle} />
        <button type="submit" style={primaryBtn}>
          Add
        </button>
      </form>
      {notes.length === 0 ? (
        <Empty title="No notes yet" />
      ) : (
        notes.map((n) => (
          <div key={`${n.source}-${n.id}`} style={{ padding: "10px 0", borderTop: `1px solid ${THEME.border}` }}>
            <div style={{ fontSize: 13, color: THEME.text, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{n.body}</div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
              <span style={{ fontSize: 11, color: THEME.textMuted }}>
                {n.author} · {fmtRelative(n.createdAt)}
              </span>
              <button type="button" onClick={() => remove(n.id, n.source)} style={{ background: "none", border: "none", color: THEME.textMuted, cursor: "pointer", fontSize: 11 }}>
                Delete
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

// ── Dialogs ─────────────────────────────────────────────────────────────────

function EditDialog({ open, ...rest }: { open: boolean; d: Detail; onClose: () => void; onDone: () => void }) {
  return open ? <EditForm {...rest} /> : null;
}

function EditForm({ d, onClose, onDone }: { d: Detail; onClose: () => void; onDone: () => void }) {
  const c = d.contact;
  const [form, setForm] = useState({ name: c.name ?? "", email: c.email ?? "", company: c.company ?? "", handle: c.handle ?? "", phone: c.phone ?? "" });
  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const isUser = !!c.userId;
  return (
    <FormDialog
      open
      title="Edit contact"
      submitLabel="Save"
      onClose={onClose}
      onSubmit={async () => {
        const { email, ...rest } = form;
        try {
          await sendJson(`/api/admin/contacts/${c.id}`, "PATCH", { action: "update", ...rest, ...(isUser ? {} : { email }) });
          toast.success("Saved");
          onDone();
        } catch (err) {
          toast.error((err as Error).message);
        }
      }}
    >
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <FormField label="Name" htmlFor="edit-name">
          <input id="edit-name" value={form.name} onChange={set("name")} maxLength={120} style={inputStyle} />
        </FormField>
        <FormField label="Email" htmlFor="edit-email" hint={isUser ? "Comes from the account; edit it in Clerk." : undefined}>
          <input id="edit-email" type="email" value={form.email} onChange={set("email")} maxLength={254} disabled={isUser} style={{ ...inputStyle, opacity: isUser ? 0.6 : 1 }} />
        </FormField>
        <FormField label="Company" htmlFor="edit-company">
          <input id="edit-company" value={form.company} onChange={set("company")} maxLength={120} style={inputStyle} />
        </FormField>
        <FormField label="Handle" htmlFor="edit-handle">
          <input id="edit-handle" value={form.handle} onChange={set("handle")} maxLength={120} style={inputStyle} />
        </FormField>
        <FormField label="Phone" htmlFor="edit-phone">
          <input id="edit-phone" value={form.phone} onChange={set("phone")} maxLength={40} style={inputStyle} />
        </FormField>
      </div>
    </FormDialog>
  );
}

function BonusDialog({ open, ...rest }: { open: boolean; contactId: string; onClose: () => void; onDone: () => void }) {
  return open ? <BonusForm {...rest} /> : null;
}

function BonusForm({ contactId, onClose, onDone }: { contactId: string; onClose: () => void; onDone: () => void }) {
  const [words, setWords] = useState("5000");
  const [reason, setReason] = useState("");
  const [days, setDays] = useState("60");
  // One id per opened dialog: a double submit reuses it, so the server grants once.
  const [requestId] = useState(() => crypto.randomUUID());
  const n = parseInt(words, 10);
  return (
    <FormDialog
      open
      title="Grant bonus words"
      description="Drawn only after their plan allowance runs out. Each grant is recorded on the timeline."
      submitLabel="Grant"
      submitDisabled={!(n >= 100 && n <= 50_000) || reason.trim().length < 3}
      onClose={onClose}
      onSubmit={async () => {
        try {
          await sendJson(`/api/admin/contacts/${contactId}`, "PATCH", {
            action: "grantBonusWords",
            words: n,
            reason: reason.trim(),
            expiresInDays: days ? parseInt(days, 10) : null,
            requestId,
          });
          toast.success("Bonus words granted");
          onDone();
        } catch (err) {
          toast.error((err as Error).message);
        }
      }}
    >
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <FormField label="Words" htmlFor="bonus-words" hint="100 to 50,000">
          <input id="bonus-words" type="number" min={100} max={50_000} step={100} value={words} onChange={(e) => setWords(e.target.value)} style={inputStyle} />
        </FormField>
        <FormField label="Expires after (days)" htmlFor="bonus-days" hint="Empty = never">
          <input id="bonus-days" type="number" min={1} max={730} value={days} onChange={(e) => setDays(e.target.value)} style={inputStyle} />
        </FormField>
      </div>
      <FormField label="Reason" htmlFor="bonus-reason">
        <input id="bonus-reason" value={reason} maxLength={100} onChange={(e) => setReason(e.target.value)} style={inputStyle} placeholder="Thank-you for detailed feedback" />
      </FormField>
    </FormDialog>
  );
}
