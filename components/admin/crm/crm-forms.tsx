"use client";

// ===========================================================
// components/admin/crm/crm-forms.tsx — The CRM's small forms, each in a
// FormDialog: log an outreach touch, add a task (with contact search), add a
// lead or prospect. Each posts to the A admin API and calls onDone on success.
// ===========================================================

import { useEffect, useId, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { THEME } from "@/lib/theme";
import { OUTREACH_CHANNELS, OUTREACH_OUTCOMES, PIPELINE_STAGES, type PipelineStage } from "@/lib/growth/constants";
import { scriptsForStage, SALES_SCRIPTS } from "@/lib/crm/scripts";
import { TASK_KINDS, TASK_KIND_LABELS } from "@/app/api/admin/tasks/shared";
import { FormDialog, FormField, inputStyle, selectStyle, sendJson } from "./form-dialog";
import { contactLabel, humanizeKey, type ContactLike } from "./contact-bits";

// ── Log touch ───────────────────────────────────────────────────────────────

type LogTouchProps = {
  open: boolean;
  contact: ContactLike | null;
  pipelineStage?: string | null;
  onClose: () => void;
  onDone: () => void;
};

// Each dialog mounts its form only while open, so every opening starts from fresh state.
export function LogTouchDialog(props: LogTouchProps) {
  return props.open ? <LogTouchForm {...props} /> : null;
}

function LogTouchForm({ open, contact, pipelineStage, onClose, onDone }: LogTouchProps) {
  const id = useId();
  const [channel, setChannel] = useState<string>("email");
  const [outcome, setOutcome] = useState<string>("sent");
  const [script, setScript] = useState("");
  const [note, setNote] = useState("");

  const suggested = scriptsForStage((pipelineStage as PipelineStage | null) ?? null).map((s) => s.id);
  const scripts = [...SALES_SCRIPTS].sort((a, b) => Number(suggested.includes(b.id)) - Number(suggested.includes(a.id)));

  return (
    <FormDialog
      open={open}
      title="Log a touch"
      description={contact ? `With ${contactLabel(contact)}. Counts toward today's outreach goal.` : undefined}
      submitLabel="Log touch"
      onClose={onClose}
      onSubmit={async () => {
        if (!contact) return;
        try {
          await sendJson(`/api/admin/contacts/${contact.id}/touch`, "POST", { channel, outcome, script: script || null, note: note.trim() || null });
          toast.success("Touch logged");
          onDone();
        } catch (err) {
          toast.error((err as Error).message);
        }
      }}
    >
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <FormField label="Channel" htmlFor={`${id}-ch`}>
          <select id={`${id}-ch`} value={channel} onChange={(e) => setChannel(e.target.value)} style={{ ...selectStyle, width: "100%" }}>
            {OUTREACH_CHANNELS.map((c) => (
              <option key={c} value={c}>
                {humanizeKey(c)}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Outcome" htmlFor={`${id}-out`}>
          <select id={`${id}-out`} value={outcome} onChange={(e) => setOutcome(e.target.value)} style={{ ...selectStyle, width: "100%" }}>
            {OUTREACH_OUTCOMES.map((o) => (
              <option key={o} value={o}>
                {humanizeKey(o)}
              </option>
            ))}
          </select>
        </FormField>
      </div>
      <FormField label="Script used (optional)" htmlFor={`${id}-sc`}>
        <select id={`${id}-sc`} value={script} onChange={(e) => setScript(e.target.value)} style={{ ...selectStyle, width: "100%" }}>
          <option value="">None</option>
          {scripts.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
              {suggested.includes(s.id) ? " (suggested)" : ""}
            </option>
          ))}
        </select>
      </FormField>
      <FormField label="Note (optional)" htmlFor={`${id}-note`}>
        <input id={`${id}-note`} value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} style={inputStyle} placeholder="What they said, next step…" />
      </FormField>
    </FormDialog>
  );
}

// ── Contact search (task quick add) ─────────────────────────────────────────

function ContactSearch({ id, value, onChange }: { id: string; value: ContactLike | null; onChange: (c: ContactLike | null) => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<ContactLike[]>([]);

  const term = q.trim();
  const searching = term.length >= 2 && !value;

  useEffect(() => {
    if (!searching) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/admin/contacts?q=${encodeURIComponent(term)}`, { signal: controller.signal });
        const data = (await res.json()) as { items?: ContactLike[] };
        setResults((data.items ?? []).slice(0, 6));
      } catch {
        /* aborted or offline: keep the old list */
      }
    }, 250);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [term, searching]);

  if (value) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
        <span style={{ fontWeight: 600, color: THEME.text }}>{contactLabel(value)}</span>
        <button type="button" onClick={() => onChange(null)} style={{ border: "none", background: "none", color: THEME.brandHi, cursor: "pointer", fontSize: 12 }}>
          Change
        </button>
      </div>
    );
  }
  return (
    <div>
      <input id={id} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, email or company…" style={inputStyle} autoComplete="off" />
      {searching && results.length > 0 ? (
        <ul aria-label="Matching contacts" style={{ listStyle: "none", margin: "6px 0 0", padding: 0, border: `1px solid ${THEME.border}`, borderRadius: 8, overflow: "hidden" }}>
          {results.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => {
                  onChange(c);
                  setQ("");
                }}
                style={{ display: "block", width: "100%", textAlign: "left", padding: "7px 10px", border: "none", borderTop: `1px solid ${THEME.border}`, background: THEME.surface2, cursor: "pointer", fontSize: 13, color: THEME.text }}
              >
                {contactLabel(c)}
                {c.email && c.email !== contactLabel(c) ? <span style={{ color: THEME.textMuted, fontSize: 11 }}> · {c.email}</span> : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

// ── Add task ────────────────────────────────────────────────────────────────

type TaskDialogProps = {
  open: boolean;
  /** A fixed contact (from a contact page). Leave it out to show the contact search. */
  contact?: ContactLike | null;
  onClose: () => void;
  onDone: () => void;
};

export function TaskDialog(props: TaskDialogProps) {
  return props.open ? <TaskForm {...props} /> : null;
}

function TaskForm({ open, contact, onClose, onDone }: TaskDialogProps) {
  const id = useId();
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<string>("follow_up");
  const [priority, setPriority] = useState("normal");
  const [due, setDue] = useState(() => new Date().toISOString().slice(0, 10));
  const [picked, setPicked] = useState<ContactLike | null>(null);

  const target = contact ?? picked;
  return (
    <FormDialog
      open={open}
      title="Add a task"
      submitLabel="Add task"
      submitDisabled={!title.trim()}
      onClose={onClose}
      onSubmit={async () => {
        try {
          await sendJson("/api/admin/tasks", "POST", {
            title: title.trim(),
            kind,
            priority,
            // Noon UTC keeps the chosen calendar day whatever the admin's time zone.
            dueAt: due ? `${due}T12:00:00.000Z` : null,
            contactId: target?.id ?? null,
          });
          toast.success("Task added");
          onDone();
        } catch (err) {
          toast.error((err as Error).message);
        }
      }}
    >
      <FormField label="Task" htmlFor={`${id}-title`}>
        <input id={`${id}-title`} value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} style={inputStyle} placeholder="Send the appeal kit to…" required />
      </FormField>
      {contact === undefined ? (
        <FormField label="Contact (optional)" htmlFor={`${id}-contact`}>
          <ContactSearch id={`${id}-contact`} value={picked} onChange={setPicked} />
        </FormField>
      ) : null}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
        <FormField label="Kind" htmlFor={`${id}-kind`}>
          <select id={`${id}-kind`} value={kind} onChange={(e) => setKind(e.target.value)} style={{ ...selectStyle, width: "100%" }}>
            {TASK_KINDS.map((k) => (
              <option key={k} value={k}>
                {TASK_KIND_LABELS[k]}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Priority" htmlFor={`${id}-prio`}>
          <select id={`${id}-prio`} value={priority} onChange={(e) => setPriority(e.target.value)} style={{ ...selectStyle, width: "100%" }}>
            <option value="high">High</option>
            <option value="normal">Normal</option>
            <option value="low">Low</option>
          </select>
        </FormField>
        <FormField label="Due" htmlFor={`${id}-due`}>
          <input id={`${id}-due`} type="date" value={due} onChange={(e) => setDue(e.target.value)} style={inputStyle} />
        </FormField>
      </div>
    </FormDialog>
  );
}

// ── Add contact ─────────────────────────────────────────────────────────────

type AddContactProps = { open: boolean; onClose: () => void; defaultStage?: PipelineStage };

export function AddContactDialog(props: AddContactProps) {
  return props.open ? <AddContactForm {...props} /> : null;
}

function AddContactForm({ open, onClose, defaultStage = "to_contact" }: AddContactProps) {
  const id = useId();
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", company: "", handle: "", phone: "", note: "" });
  const [stage, setStage] = useState<PipelineStage>(defaultStage);

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const usable = !!(form.name.trim() || form.email.trim() || form.handle.trim());

  return (
    <FormDialog
      open={open}
      title="Add a prospect"
      description="Someone you'll reach out to yourself. Adding them never subscribes them to any email."
      submitLabel="Add contact"
      submitDisabled={!usable}
      onClose={onClose}
      onSubmit={async () => {
        const res = await fetch("/api/admin/contacts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...form, pipelineStage: stage }),
        });
        const data = (await res.json().catch(() => ({}))) as { id?: string; error?: { message?: string; contactId?: string } };
        if (res.status === 409 && data.error?.contactId) {
          toast.message(data.error.message ?? "Already a contact.", {
            action: { label: "Open", onClick: () => router.push(`/admin/contacts/${data.error?.contactId}`) },
          });
          return;
        }
        if (!res.ok || !data.id) {
          toast.error(data.error?.message ?? "Could not add the contact.");
          return;
        }
        toast.success("Contact added");
        router.push(`/admin/contacts/${data.id}`);
      }}
    >
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <FormField label="Name" htmlFor={`${id}-name`}>
          <input id={`${id}-name`} value={form.name} onChange={set("name")} maxLength={120} style={inputStyle} />
        </FormField>
        <FormField label="Email (optional)" htmlFor={`${id}-email`}>
          <input id={`${id}-email`} type="email" value={form.email} onChange={set("email")} maxLength={254} style={inputStyle} />
        </FormField>
        <FormField label="Company" htmlFor={`${id}-company`}>
          <input id={`${id}-company`} value={form.company} onChange={set("company")} maxLength={120} style={inputStyle} />
        </FormField>
        <FormField label="Handle (LinkedIn, X…)" htmlFor={`${id}-handle`}>
          <input id={`${id}-handle`} value={form.handle} onChange={set("handle")} maxLength={120} style={inputStyle} />
        </FormField>
        <FormField label="Phone" htmlFor={`${id}-phone`}>
          <input id={`${id}-phone`} value={form.phone} onChange={set("phone")} maxLength={40} style={inputStyle} />
        </FormField>
        <FormField label="Pipeline stage" htmlFor={`${id}-stage`}>
          <select id={`${id}-stage`} value={stage} onChange={(e) => setStage(e.target.value as PipelineStage)} style={{ ...selectStyle, width: "100%" }}>
            {PIPELINE_STAGES.map((s) => (
              <option key={s} value={s}>
                {humanizeKey(s)}
              </option>
            ))}
          </select>
        </FormField>
      </div>
      <FormField label="Note (optional)" htmlFor={`${id}-note`}>
        <input id={`${id}-note`} value={form.note} onChange={set("note")} maxLength={500} style={inputStyle} placeholder="How you know them, what they need…" />
      </FormField>
    </FormDialog>
  );
}
