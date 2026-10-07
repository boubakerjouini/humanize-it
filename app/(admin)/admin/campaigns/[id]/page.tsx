"use client";

// ===========================================================
// /admin/campaigns/[id] (and /admin/campaigns/new) — The campaign editor in
// four steps: 1 Draft (audience, topic, subject, markdown body), 2 Preview
// (desktop, mobile, text, and who receives it), 3 Test send to your own
// inbox or another allowlisted test inbox, 4 Send, confirmed by typing the
// recipient count. Any edit after the
// test drops the campaign back to draft; the server enforces every rule.
// After sending: progress, results and Cancel.
// ===========================================================

import { Suspense, useCallback, useEffect, useId, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Eye, Loader2, Send, TestTube2 } from "lucide-react";
import { toast } from "sonner";
import { THEME } from "@/lib/theme";
import { TOPICS, TOPIC_LABELS, type Topic } from "@/lib/growth/constants";
import {
  Card,
  Empty,
  Field,
  PageHeader,
  Panel,
  Pill,
  Row,
  dangerBtn,
  disabledStyle,
  fmtDateTime,
  ghostBtn,
  primaryBtn,
} from "@/components/admin/crm-ui";
import { ConfirmDialog } from "@/components/admin/crm-dialogs";
import { EmailStatusBanner, type EmailStatus } from "@/components/admin/email/status-banner";
import { EmailPreview, type RenderedEmail } from "@/components/admin/email/email-preview";
import { CAMPAIGN_STATUS_COLORS, api, pct, reasonLabel } from "@/components/admin/email/api";

type Campaign = {
  id: string;
  name: string;
  topic: string;
  segmentRef: string;
  subject: string;
  preheader: string | null;
  bodyMd: string;
  status: string;
  testSentAt: string | null;
  testSentTo: string | null;
  confirmedAt: string | null;
  confirmedBy: string | null;
  recipientCount: number;
  completedAt: string | null;
};
type Stats = { queued: number; sent: number; delivered: number; bounced: number; complained: number; skipped: number; failed: number; cancelled: number };
type TestRecipients = { own: string; ownAllowed: boolean; choices: string[] };
type Loaded = {
  campaign: Campaign;
  target: { name: string; description: string | null } | null;
  stats: Stats | null;
  testIsCurrent: boolean;
  testRecipients?: TestRecipients;
};
type Target = { id: string; name: string; description: string | null; count: number };
type Recipients = { total: number; eligible: number; excluded: Record<string, number>; truncated: boolean };
type Preview = RenderedEmail & { recipients: Recipients };
type Draft = { name: string; topic: Topic; segmentRef: string; subject: string; preheader: string; bodyMd: string };

const LIMITS = { name: 120, subject: 150, preheader: 200, bodyMd: 20_000 };
const EMPTY_DRAFT: Draft = { name: "", topic: "tips", segmentRef: "sys:tips_subscribers", subject: "", preheader: "", bodyMd: "" };
const STEPS = ["Draft", "Preview", "Test", "Send"];

const input: React.CSSProperties = {
  width: "100%",
  padding: "9px 12px",
  borderRadius: 9,
  border: `1px solid ${THEME.border}`,
  background: THEME.surface2,
  color: THEME.text,
  fontSize: 13,
  fontFamily: THEME.fontSans,
  boxSizing: "border-box",
};

function draftOf(c: Campaign): Draft {
  return { name: c.name, topic: (TOPICS as readonly string[]).includes(c.topic) ? (c.topic as Topic) : "tips", segmentRef: c.segmentRef, subject: c.subject, preheader: c.preheader ?? "", bodyMd: c.bodyMd };
}

function Counter({ value, max }: { value: string; max: number }) {
  const over = value.length > max;
  return (
    <span className="tnum" style={{ fontSize: 11, color: over ? THEME.ai : THEME.textMuted }}>
      {value.length}/{max}
    </span>
  );
}

function Stepper({ current }: { current: number }) {
  return (
    <ol style={{ display: "flex", gap: 8, listStyle: "none", padding: 0, margin: "0 0 20px", flexWrap: "wrap" }}>
      {STEPS.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li
            key={label}
            aria-current={active ? "step" : undefined}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 12px",
              borderRadius: 999,
              fontSize: 13,
              fontWeight: 600,
              border: `1px solid ${active ? THEME.brand : THEME.border}`,
              background: active ? THEME.brandDim : THEME.surface2,
              color: done || active ? THEME.text : THEME.textMuted,
            }}
          >
            <span
              aria-hidden="true"
              style={{
                width: 20,
                height: 20,
                borderRadius: 999,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 11,
                background: done ? THEME.human : active ? THEME.brand : THEME.surface3,
                color: done || active ? "#fff" : THEME.textMuted,
              }}
            >
              {done ? "✓" : i + 1}
            </span>
            {label}
          </li>
        );
      })}
    </ol>
  );
}

function Editor() {
  const { id } = useParams<{ id: string }>();
  const isNew = id === "new";
  const router = useRouter();
  const search = useSearchParams();
  const ids = { name: useId(), topic: useId(), segment: useId(), subject: useId(), preheader: useId(), body: useId() };

  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(() => {
    const segmentRef = search.get("segmentRef") || (search.get("filter") ? `filter:${search.get("filter")}` : null);
    return segmentRef ? { ...EMPTY_DRAFT, segmentRef } : EMPTY_DRAFT;
  });
  const [targets, setTargets] = useState<Target[]>([]);
  const [customTarget, setCustomTarget] = useState<Target | null>(null);
  const [mode, setMode] = useState<EmailStatus["mode"] | null>(null);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testTo, setTestTo] = useState("");
  const [confirm, setConfirm] = useState<{ eligible: number } | null>(null);
  const [preparingSend, setPreparingSend] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);

  const load = useCallback(async () => {
    if (isNew) return;
    const res = await api<Loaded>(`/api/admin/campaigns/${id}`);
    if (!res.ok) {
      setLoadError(res.message);
      return;
    }
    setLoaded(res.data);
    setDraft(draftOf(res.data.campaign));
  }, [id, isNew]);

  useEffect(() => {
    let live = true;
    api<{ items: Target[] }>("/api/admin/campaigns/targets").then((res) => {
      if (live && res.ok) setTargets(res.data.items);
    });
    if (!isNew) {
      api<Loaded>(`/api/admin/campaigns/${id}`).then((res) => {
        if (!live) return;
        if (!res.ok) return setLoadError(res.message);
        setLoaded(res.data);
        setDraft(draftOf(res.data.campaign));
      });
    }
    return () => {
      live = false;
    };
  }, [id, isNew]);

  // A target that isn't a system segment (contacts filter, saved segment) gets its own option.
  const isSystemRef = draft.segmentRef.startsWith("sys:");
  useEffect(() => {
    if (isSystemRef) return;
    let live = true;
    api<{ item: Target }>(`/api/admin/campaigns/targets?ref=${encodeURIComponent(draft.segmentRef)}`).then((res) => {
      if (live) setCustomTarget(res.ok ? res.data.item : null);
    });
    return () => {
      live = false;
    };
  }, [draft.segmentRef, isSystemRef]);

  const campaign = loaded?.campaign ?? null;
  const testChoices = loaded?.testRecipients?.choices ?? [];
  const status = campaign?.status ?? "draft";
  const editable = isNew || status === "draft" || status === "tested";
  const dirty = useMemo(() => {
    if (isNew) return true;
    if (!campaign) return false;
    return JSON.stringify(draftOf(campaign)) !== JSON.stringify(draft);
  }, [campaign, draft, isNew]);
  const tested = status === "tested" && !!loaded?.testIsCurrent && !dirty;
  const step = status === "sending" || status === "sent" || status === "cancelled" ? 3 : tested ? 3 : preview && !dirty ? 2 : !isNew && !dirty ? 1 : 0;

  // Refresh progress while the campaign drains.
  useEffect(() => {
    if (status !== "sending") return;
    const timer = setInterval(() => void load(), 10_000);
    return () => clearInterval(timer);
  }, [status, load]);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
    setPreview(null);
  };

  const valid =
    draft.name.trim() &&
    draft.subject.trim() &&
    draft.bodyMd.trim() &&
    draft.name.length <= LIMITS.name &&
    draft.subject.length <= LIMITS.subject &&
    draft.preheader.length <= LIMITS.preheader &&
    draft.bodyMd.length <= LIMITS.bodyMd;

  const save = async () => {
    setSaving(true);
    const body = { ...draft, preheader: draft.preheader.trim() || null };
    const res = isNew
      ? await api<{ campaign: Campaign }>("/api/admin/campaigns", { method: "POST", json: body })
      : await api<{ campaign: Campaign }>(`/api/admin/campaigns/${id}`, { method: "PATCH", json: body });
    setSaving(false);
    if (!res.ok) return void toast.error(res.message);
    if (isNew) {
      toast.success("Draft saved.");
      router.replace(`/admin/campaigns/${res.data.campaign.id}`);
      return;
    }
    toast.success(res.data.campaign.status === "draft" && status === "tested" ? "Saved. Content changed, so send a new test." : "Saved.");
    await load();
  };

  const runPreview = async () => {
    setPreviewing(true);
    const res = await api<Preview>(`/api/admin/campaigns/${id}/preview`, { method: "POST" });
    setPreviewing(false);
    if (!res.ok) return void toast.error(res.message);
    setPreview(res.data);
  };

  const testSend = async () => {
    setTesting(true);
    const to = testTo || testChoices[0];
    const res = await api<{ ok: boolean; message: string }>(`/api/admin/campaigns/${id}/test`, { method: "POST", json: to ? { to } : {} });
    setTesting(false);
    if (!res.ok) return void toast.error(res.message);
    toast.success(res.data.message);
    await load();
  };

  const openSend = async () => {
    // Count again right before confirming: the audience may have changed since the preview.
    setPreparingSend(true);
    const res = await api<Preview>(`/api/admin/campaigns/${id}/preview`, { method: "POST" });
    setPreparingSend(false);
    if (!res.ok) return void toast.error(res.message);
    setPreview(res.data);
    if (res.data.recipients.eligible === 0) return void toast.error("Nobody in this audience can receive the campaign.");
    setConfirm({ eligible: res.data.recipients.eligible });
  };

  const send = async () => {
    if (!confirm) return;
    const res = await api<{ queued: number }>(`/api/admin/campaigns/${id}/send`, { method: "POST", json: { confirmCount: confirm.eligible } });
    if (!res.ok) return void toast.error(res.message);
    toast.success(`Queued ${res.data.queued} emails. Sending now within today's budget.`);
    setConfirm(null);
    await load();
  };

  const cancel = async () => {
    const res = await api<{ cancelled: number }>(`/api/admin/campaigns/${id}/cancel`, { method: "POST" });
    if (!res.ok) return void toast.error(res.message);
    toast.success(`Cancelled. ${res.data.cancelled} queued emails dropped.`);
    setCancelOpen(false);
    await load();
  };

  const remove = async () => {
    const res = await api(`/api/admin/campaigns/${id}`, { method: "DELETE" });
    if (!res.ok) return void toast.error(res.message);
    toast.success("Draft deleted.");
    router.replace("/admin/campaigns");
  };

  if (loadError) {
    return (
      <Panel>
        <Empty title="Couldn't load this campaign" description={loadError} action={<Link href="/admin/campaigns">Back to campaigns</Link>} />
      </Panel>
    );
  }
  if (!isNew && !loaded) {
    return (
      <Panel>
        <Empty title="Loading…" />
      </Panel>
    );
  }

  const stats = loaded?.stats;
  const sendingOff = mode === "off";

  return (
    <>
      <PageHeader
        title={isNew ? "New campaign" : campaign?.name}
        description={campaign ? <Pill color={CAMPAIGN_STATUS_COLORS[status] ?? THEME.textMuted}>{status}</Pill> : "Write it, preview it, test it on yourself, then send."}
        actions={
          !isNew && editable ? (
            <button type="button" style={dangerBtn} onClick={() => void remove()}>
              Delete draft
            </button>
          ) : null
        }
      />
      <EmailStatusBanner onStatus={(s) => setMode(s.mode)} />
      <Stepper current={step} />

      {status === "sending" || status === "sent" || status === "cancelled" ? (
        <Panel
          title={status === "sending" ? "Sending" : status === "sent" ? "Sent" : "Cancelled"}
          description={
            campaign?.confirmedAt ? `Confirmed by ${campaign.confirmedBy} on ${fmtDateTime(campaign.confirmedAt)} for ${campaign.recipientCount} recipients.` : undefined
          }
          actions={
            status === "sending" ? (
              <button type="button" style={dangerBtn} onClick={() => setCancelOpen(true)}>
                Cancel campaign
              </button>
            ) : null
          }
          style={{ marginBottom: 20 }}
        >
          <Row gap={24}>
            {(
              [
                ["Queued", stats?.queued ?? 0],
                ["Sent", stats?.sent ?? 0],
                ["Delivered", stats ? pct(stats.delivered, stats.sent) : "—"],
                ["Bounced", stats?.bounced ?? 0],
                ["Complaints", stats?.complained ?? 0],
                ["Skipped", stats?.skipped ?? 0],
                ["Failed", stats?.failed ?? 0],
                ["Cancelled", stats?.cancelled ?? 0],
              ] as const
            ).map(([label, value]) => (
              <Field key={label} label={label}>
                <span className="tnum" style={{ fontSize: 18, fontWeight: 700 }}>
                  {value}
                </span>
              </Field>
            ))}
          </Row>
          {status === "sending" ? (
            <p style={{ fontSize: 12, color: THEME.textMuted, margin: "12px 0 0" }}>
              Emails go out within the daily bulk budget; anything left continues with the next daily run. Skipped means the person
              unsubscribed or became ineligible before their turn.
            </p>
          ) : null}
        </Panel>
      ) : null}

      <Panel title="1. Draft" description="Write the way you'd write to one person: specific, honest, no promises about beating detectors." style={{ marginBottom: 20 }}>
        <fieldset disabled={!editable} style={{ border: "none", padding: 0, margin: 0, display: "grid", gap: 14 }}>
          <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
            <div>
              <Row justify="space-between">
                <label htmlFor={ids.name} style={{ fontSize: 12, fontWeight: 600, color: THEME.textDim }}>
                  Internal name
                </label>
                <Counter value={draft.name} max={LIMITS.name} />
              </Row>
              <input id={ids.name} value={draft.name} onChange={(e) => set("name", e.target.value)} style={{ ...input, marginTop: 4 }} placeholder="Extension launch" />
            </div>
            <div>
              <label htmlFor={ids.topic} style={{ fontSize: 12, fontWeight: 600, color: THEME.textDim }}>
                Topic (consent required)
              </label>
              <select id={ids.topic} value={draft.topic} onChange={(e) => set("topic", e.target.value as Topic)} style={{ ...input, marginTop: 4 }}>
                {TOPICS.map((t) => (
                  <option key={t} value={t}>
                    {TOPIC_LABELS[t]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor={ids.segment} style={{ fontSize: 12, fontWeight: 600, color: THEME.textDim }}>
                Audience
              </label>
              <select id={ids.segment} value={draft.segmentRef} onChange={(e) => set("segmentRef", e.target.value)} style={{ ...input, marginTop: 4 }}>
                {!isSystemRef ? <option value={draft.segmentRef}>{customTarget ? `${customTarget.name} (${customTarget.count})` : "Custom filter"}</option> : null}
                {targets.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.count})
                  </option>
                ))}
              </select>
              <div style={{ fontSize: 11, color: THEME.textMuted, marginTop: 4 }}>
                {(isSystemRef ? targets.find((t) => t.id === draft.segmentRef)?.description : customTarget?.description) ??
                  "Only people subscribed to the topic, with a confirmed address, receive it."}
              </div>
            </div>
          </div>
          <div>
            <Row justify="space-between">
              <label htmlFor={ids.subject} style={{ fontSize: 12, fontWeight: 600, color: THEME.textDim }}>
                Subject
              </label>
              <Counter value={draft.subject} max={LIMITS.subject} />
            </Row>
            <input id={ids.subject} value={draft.subject} onChange={(e) => set("subject", e.target.value)} style={{ ...input, marginTop: 4 }} />
          </div>
          <div>
            <Row justify="space-between">
              <label htmlFor={ids.preheader} style={{ fontSize: 12, fontWeight: 600, color: THEME.textDim }}>
                Preheader (inbox preview text, optional)
              </label>
              <Counter value={draft.preheader} max={LIMITS.preheader} />
            </Row>
            <input id={ids.preheader} value={draft.preheader} onChange={(e) => set("preheader", e.target.value)} style={{ ...input, marginTop: 4 }} />
          </div>
          <div>
            <Row justify="space-between">
              <label htmlFor={ids.body} style={{ fontSize: 12, fontWeight: 600, color: THEME.textDim }}>
                Body (Markdown)
              </label>
              <Counter value={draft.bodyMd} max={LIMITS.bodyMd} />
            </Row>
            <textarea
              id={ids.body}
              value={draft.bodyMd}
              onChange={(e) => set("bodyMd", e.target.value)}
              rows={14}
              style={{ ...input, marginTop: 4, fontFamily: THEME.fontMono, lineHeight: 1.5, resize: "vertical" }}
              aria-describedby={`${ids.body}-hint`}
            />
            <div id={`${ids.body}-hint`} style={{ fontSize: 11, color: THEME.textMuted, marginTop: 4 }}>
              {"{{firstName}}"} becomes the recipient&apos;s first name, or &quot;there&quot;. The footer (why they get it, unsubscribe, postal address) is added automatically.
            </div>
          </div>
        </fieldset>
        {editable ? (
          <Row gap={10} style={{ marginTop: 16 }}>
            <button type="button" onClick={() => void save()} disabled={saving || !valid || !dirty} style={disabledStyle(primaryBtn, saving || !valid || !dirty)}>
              {saving ? <Loader2 size={14} style={{ animation: "spin 0.8s linear infinite" }} aria-hidden="true" /> : null}
              {isNew ? "Save draft" : dirty ? "Save changes" : "Saved"}
            </button>
            {status === "tested" && dirty ? <span style={{ fontSize: 12, color: THEME.warn }}>Saving changes means a new test send.</span> : null}
          </Row>
        ) : null}
      </Panel>

      {!isNew ? (
        <Panel
          title="2. Preview"
          description="Rendered for your own contact. The recipient count applies the same consent and suppression rules as sending."
          actions={
            <button type="button" onClick={() => void runPreview()} disabled={previewing || dirty} style={disabledStyle(ghostBtn, previewing || dirty)}>
              <Eye size={14} aria-hidden="true" /> {previewing ? "Rendering…" : preview ? "Refresh" : "Preview"}
            </button>
          }
          style={{ marginBottom: 20 }}
        >
          {dirty ? (
            <Empty title="Save the draft to preview it" />
          ) : preview ? (
            <div style={{ display: "grid", gap: 16 }}>
              <Card style={{ padding: 14, background: THEME.surface1 }}>
                <Row gap={18}>
                  <Field label="Will receive">
                    <span className="tnum" style={{ fontSize: 20, fontWeight: 700, color: THEME.text }}>
                      {preview.recipients.eligible}
                    </span>{" "}
                    <span style={{ color: THEME.textMuted }}>of {preview.recipients.total} in the audience</span>
                  </Field>
                  <Field label="Left out">
                    {Object.keys(preview.recipients.excluded).length === 0
                      ? "nobody"
                      : Object.entries(preview.recipients.excluded)
                          .map(([r, n]) => `${n} ${reasonLabel(r)}`)
                          .join(" · ")}
                  </Field>
                </Row>
                {preview.recipients.truncated ? <p style={{ fontSize: 12, color: THEME.warn, margin: "8px 0 0" }}>Only the first 5,000 contacts are considered.</p> : null}
              </Card>
              <EmailPreview email={preview} idPrefix="campaign-preview" />
            </div>
          ) : (
            <Empty title="Not previewed yet" description="Check the email and the recipient count before testing." />
          )}
        </Panel>
      ) : null}

      {!isNew && editable ? (
        <Panel title="3. Test send" description="Sends with [TEST] in the subject to an allowlisted inbox. A test that arrives unlocks sending." style={{ marginBottom: 20 }}>
          {loaded?.testRecipients && !loaded.testRecipients.ownAllowed ? (
            <p style={{ fontSize: 12, color: THEME.textMuted, margin: "0 0 10px" }}>
              {`Your address (${loaded.testRecipients.own}) isn't on the allowlist (EMAIL_ALLOWLIST or ADMIN_EMAILS), so pick a test inbox from it.`}
            </p>
          ) : null}
          <Row gap={12}>
            {testChoices.length > 0 ? (
              <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12, color: THEME.textDim }}>
                Send to
                <select
                  value={testTo || testChoices[0]}
                  onChange={(e) => setTestTo(e.target.value)}
                  style={{ ...input, width: "auto", padding: "7px 10px" }}
                >
                  {testChoices.map((email) => (
                    <option key={email} value={email}>
                      {email === loaded?.testRecipients?.own ? `${email} (you)` : email}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <button
              type="button"
              onClick={() => void testSend()}
              disabled={testing || dirty || sendingOff || testChoices.length === 0}
              style={disabledStyle(ghostBtn, testing || dirty || sendingOff || testChoices.length === 0)}
            >
              <TestTube2 size={14} aria-hidden="true" /> {testing ? "Sending…" : "Send a test"}
            </button>
            <span style={{ fontSize: 12, color: THEME.textMuted }}>
              {sendingOff
                ? "Sending is off."
                : campaign?.testSentAt
                  ? `Last test ${fmtDateTime(campaign.testSentAt)} to ${campaign.testSentTo}${loaded?.testIsCurrent ? "" : " (content changed since)"}.`
                  : "No test sent yet."}
            </span>
          </Row>
        </Panel>
      ) : null}

      {!isNew && editable ? (
        <Panel title="4. Send" description="You'll type the recipient count to confirm. It is recounted right before sending.">
          <button
            type="button"
            onClick={() => void openSend()}
            disabled={!tested || preparingSend || sendingOff}
            style={disabledStyle(primaryBtn, !tested || preparingSend || sendingOff)}
            title={!tested ? "Send a test of the current content first" : undefined}
          >
            <Send size={14} aria-hidden="true" /> {preparingSend ? "Counting…" : "Send campaign"}
          </button>
        </Panel>
      ) : null}

      <ConfirmDialog
        open={!!confirm}
        title={`Send to ${confirm?.eligible ?? 0} people?`}
        body={`This emails ${confirm?.eligible ?? 0} people who opted in to ${TOPIC_LABELS[draft.topic]}. It can be cancelled while sending, but sent emails can't be recalled. Type ${confirm?.eligible ?? 0} to confirm.`}
        requireText={confirm ? String(confirm.eligible) : undefined}
        confirmLabel="Send"
        onConfirm={send}
        onClose={() => setConfirm(null)}
      />
      <ConfirmDialog
        open={cancelOpen}
        title="Cancel this campaign?"
        body="Queued emails are dropped. Emails that already went out stay sent."
        confirmLabel="Cancel campaign"
        cancelLabel="Keep sending"
        danger
        onConfirm={cancel}
        onClose={() => setCancelOpen(false)}
      />
    </>
  );
}

export default function CampaignEditorPage() {
  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: "32px 28px", fontFamily: THEME.fontSans }}>
      <Link href="/admin/campaigns" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: THEME.textDim, textDecoration: "none", marginBottom: 12 }}>
        <ArrowLeft size={14} aria-hidden="true" /> Campaigns
      </Link>
      <Suspense fallback={<Empty title="Loading…" />}>
        <Editor />
      </Suspense>
    </div>
  );
}
