"use client";

// ===========================================================
// /admin/contacts — every person the CRM knows: customers, leads, prospects.
// Filters live in the URL (so segment and pipeline links land here filtered)
// and the API compiles them through compileSegment, the same path as segment
// counts and the CSV export. Checkbox selection drives the bulk bar.
// ===========================================================

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Download, Plus, RefreshCw, Search, X } from "lucide-react";
import { THEME } from "@/lib/theme";
import { CHANNELS, LEAD_SOURCES, PIPELINE_STAGES, TOPICS, TOPIC_LABELS } from "@/lib/growth/constants";
import { STAGES, STAGE_LABELS } from "@/lib/crm/lifecycle";
import {
  Empty,
  PageHeader,
  Panel,
  Pill,
  Row,
  ScoreBadge,
  StagePill,
  TopicChips,
  disabledStyle,
  fmtDate,
  fmtRelative,
  ghostBtn,
  primaryBtn,
  tableStyles,
} from "@/components/admin/crm-ui";
import { ContactCell, Spinner, humanizeKey } from "@/components/admin/crm/contact-bits";
import { AddContactDialog } from "@/components/admin/crm/crm-forms";
import { FormDialog, FormField, inputStyle, selectStyle, sendJson } from "@/components/admin/crm/form-dialog";

type ContactRow = {
  id: string;
  email: string | null;
  name: string | null;
  company: string | null;
  handle: string | null;
  type: string;
  stage: string;
  stageOverride: string | null;
  score: number;
  source: string;
  channel: string | null;
  subscribedTopics: string[];
  pendingTopics: string[];
  pipelineStage: string | null;
  lastActiveAt: string | null;
  createdAt: string;
  plan: string | null;
};

type ListResponse = { items: ContactRow[]; total: number; page: number; totalPages: number; segmentName: string | null };
type TagOption = { id: string; name: string; color: string };
type SegmentOption = { id: string; name: string; count: number };

/** URL params the page reads and writes; anything else (e.g. `filter=`) passes through untouched. */
const FILTER_KEYS = ["q", "stage", "type", "channel", "source", "topic", "tag", "segment", "minScore", "pipelineStage", "magnet", "sort", "dir", "page"] as const;

export default function ContactsPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <ContactsView />
    </Suspense>
  );
}

function ContactsView() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const qs = params.toString();

  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(params.get("q") ?? "");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [tags, setTags] = useState<TagOption[]>([]);
  const [segments, setSegments] = useState<SegmentOption[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [bulk, setBulk] = useState<null | "addTag" | "removeTag" | "setPipelineStage" | "createTask">(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/contacts?${qs}`);
      const json = (await res.json()) as ListResponse & { error?: { message: string } };
      if (!res.ok) {
        toast.error(json.error?.message ?? "Failed to load contacts.");
        return;
      }
      setData(json);
      setSelected(new Set());
    } catch {
      toast.error("Network error.");
    } finally {
      setLoading(false);
    }
  }, [qs]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void (async () => {
      try {
        const [t, s] = await Promise.all([fetch("/api/admin/tags").then((r) => r.json()), fetch("/api/admin/segments").then((r) => r.json())]);
        setTags((t as { tags?: TagOption[] }).tags ?? []);
        setSegments((s as { items?: SegmentOption[] }).items ?? []);
      } catch {
        /* the filters still work without the option lists */
      }
    })();
  }, []);

  /** Update URL params (page resets to 1 unless set explicitly). */
  const setParams = useCallback(
    (patch: Partial<Record<(typeof FILTER_KEYS)[number], string | null>>) => {
      const next = new URLSearchParams(qs);
      for (const [k, v] of Object.entries(patch)) {
        if (v) next.set(k, v);
        else next.delete(k);
      }
      if (!("page" in patch)) next.delete("page");
      const str = next.toString();
      router.replace(str ? `${pathname}?${str}` : pathname, { scroll: false });
    },
    [qs, pathname, router]
  );

  const activeFilters = useMemo(() => FILTER_KEYS.filter((k) => !["sort", "dir", "page", "q"].includes(k) && params.get(k)), [params]);
  const page = data?.page ?? 1;
  const items = data?.items ?? [];
  const allSelected = items.length > 0 && items.every((c) => selected.has(c.id));

  const syncContacts = async () => {
    setSyncing(true);
    try {
      const res = await sendJson<{ result: { users: number; created: number; linked: number; merged: number; events: number; errors: number } }>(
        "/api/admin/contacts/sync",
        "POST"
      );
      const r = res.result;
      toast.success(`Synced ${r.users} users: ${r.created} new contacts, ${r.events} events${r.errors ? `, ${r.errors} errors` : ""}`);
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSyncing(false);
    }
  };

  const filterSelect = (key: (typeof FILTER_KEYS)[number], label: string, options: { value: string; label: string }[]) => (
    <label style={{ display: "inline-flex", flexDirection: "column", gap: 3, fontSize: 11, fontWeight: 600, color: THEME.textMuted }}>
      {label}
      <select value={params.get(key) ?? ""} onChange={(e) => setParams({ [key]: e.target.value || null })} style={{ ...selectStyle, fontSize: 12, maxWidth: 190 }}>
        <option value="">All</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 28px", fontFamily: THEME.fontSans }}>
      <PageHeader
        title="Contacts"
        description={data ? `${data.total.toLocaleString()} ${data.total === 1 ? "person" : "people"}${data.segmentName ? ` in “${data.segmentName}”` : ""}` : "Customers, leads and prospects in one list."}
        actions={
          <>
            <button type="button" onClick={syncContacts} disabled={syncing} style={disabledStyle(ghostBtn, syncing)} title="Create the missing contact of every user and backfill their history">
              <RefreshCw size={14} aria-hidden="true" style={syncing ? { animation: "crm-spin 0.8s linear infinite" } : undefined} /> Sync contacts
            </button>
            <a href={`/api/admin/contacts/export?${qs}`} style={ghostBtn} download>
              <Download size={14} aria-hidden="true" /> Export CSV
            </a>
            <button type="button" onClick={() => setAdding(true)} style={primaryBtn}>
              <Plus size={14} aria-hidden="true" /> Add contact
            </button>
          </>
        }
      />

      {/* Search + filters */}
      <Panel style={{ marginBottom: 16 }}>
        <form
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            setParams({ q: search.trim() || null });
          }}
          style={{ display: "flex", gap: 8, marginBottom: 14 }}
        >
          <div style={{ position: "relative", flex: 1, maxWidth: 420 }}>
            <Search size={14} color={THEME.textMuted} aria-hidden="true" style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, email, company or handle…" aria-label="Search contacts" style={{ ...inputStyle, paddingLeft: 30 }} />
          </div>
          <button type="submit" style={primaryBtn}>
            Search
          </button>
        </form>
        <Row gap={10} align="flex-end">
          {filterSelect(
            "segment",
            "Segment",
            segments.map((s) => ({ value: s.id, label: `${s.name} (${s.count})` }))
          )}
          {filterSelect("stage", "Stage", STAGES.map((s) => ({ value: s, label: STAGE_LABELS[s] })))}
          {filterSelect("type", "Type", [
            { value: "user", label: "Customer" },
            { value: "lead", label: "Lead" },
            { value: "prospect", label: "Prospect" },
          ])}
          {filterSelect("channel", "Channel", CHANNELS.map((c) => ({ value: c, label: humanizeKey(c) })))}
          {filterSelect("source", "Source", LEAD_SOURCES.map((s) => ({ value: s, label: humanizeKey(s) })))}
          {filterSelect("topic", "Topic", TOPICS.map((t) => ({ value: t, label: TOPIC_LABELS[t] })))}
          {filterSelect("tag", "Tag", tags.map((t) => ({ value: t.id, label: t.name })))}
          {filterSelect("pipelineStage", "Pipeline", [
            { value: "any", label: "On the pipeline" },
            { value: "none", label: "Not on the pipeline" },
            ...PIPELINE_STAGES.map((s) => ({ value: s, label: humanizeKey(s) })),
          ])}
          {filterSelect("minScore", "Min score", [
            { value: "30", label: "30+ (warm)" },
            { value: "60", label: "60+ (hot)" },
          ])}
          <label style={{ display: "inline-flex", flexDirection: "column", gap: 3, fontSize: 11, fontWeight: 600, color: THEME.textMuted }}>
            Sort
            <select
              value={`${params.get("sort") ?? "created"}:${params.get("dir") ?? "desc"}`}
              onChange={(e) => {
                const [sort, dir] = e.target.value.split(":");
                setParams({ sort, dir });
              }}
              style={{ ...selectStyle, fontSize: 12 }}
            >
              <option value="created:desc">Newest</option>
              <option value="created:asc">Oldest</option>
              <option value="score:desc">Score, high first</option>
              <option value="lastActive:desc">Recently active</option>
              <option value="lastActive:asc">Longest inactive</option>
            </select>
          </label>
          {activeFilters.length > 0 || params.get("q") || params.get("filter") ? (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                router.replace(pathname, { scroll: false });
              }}
              style={{ ...ghostBtn, padding: "7px 10px" }}
            >
              <X size={13} aria-hidden="true" /> Clear filters
            </button>
          ) : null}
        </Row>
      </Panel>

      {/* Bulk bar */}
      {selected.size > 0 ? (
        <div
          role="region"
          aria-label="Bulk actions"
          style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", padding: "10px 14px", marginBottom: 12, borderRadius: THEME.radius, background: THEME.brandDim, border: `1px solid ${THEME.brand}33` }}
        >
          <strong style={{ fontSize: 13, color: THEME.brandHi }}>{selected.size} selected</strong>
          <button type="button" style={ghostBtn} onClick={() => setBulk("addTag")}>
            Add tag
          </button>
          <button type="button" style={ghostBtn} onClick={() => setBulk("removeTag")}>
            Remove tag
          </button>
          <button type="button" style={ghostBtn} onClick={() => setBulk("setPipelineStage")}>
            Set pipeline stage
          </button>
          <button type="button" style={ghostBtn} onClick={() => setBulk("createTask")}>
            Create task
          </button>
          <button type="button" style={{ ...ghostBtn, marginLeft: "auto" }} onClick={() => setSelected(new Set())}>
            Clear selection
          </button>
        </div>
      ) : null}

      <Panel flush>
        {loading && !data ? (
          <Spinner />
        ) : items.length === 0 ? (
          <Empty
            title="No contacts match"
            description={qs ? "Try clearing a filter." : "Run Sync contacts to bring in every existing user, or add a prospect."}
          />
        ) : (
          <div style={{ overflowX: "auto", opacity: loading ? 0.6 : 1 }}>
            <table style={tableStyles.table}>
              <thead>
                <tr>
                  <th style={{ ...tableStyles.th, width: 36 }}>
                    <input
                      type="checkbox"
                      aria-label="Select all on this page"
                      checked={allSelected}
                      onChange={() => setSelected(allSelected ? new Set() : new Set(items.map((c) => c.id)))}
                    />
                  </th>
                  {["Contact", "Stage", "Score", "Source / channel", "Topics", "Last active", "Created"].map((h) => (
                    <th key={h} style={tableStyles.th}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((c) => (
                  <tr key={c.id} style={{ ...tableStyles.tr, background: selected.has(c.id) ? THEME.surface1 : undefined }}>
                    <td style={tableStyles.td}>
                      <input
                        type="checkbox"
                        aria-label={`Select ${c.name ?? c.email ?? "contact"}`}
                        checked={selected.has(c.id)}
                        onChange={() =>
                          setSelected((prev) => {
                            const next = new Set(prev);
                            if (next.has(c.id)) next.delete(c.id);
                            else next.add(c.id);
                            return next;
                          })
                        }
                      />
                    </td>
                    <td style={{ ...tableStyles.td, maxWidth: 300 }}>
                      <ContactCell c={c} type={c.type} />
                    </td>
                    <td style={tableStyles.td}>
                      <StagePill stage={c.stage} overridden={!!c.stageOverride} />
                      {c.pipelineStage ? (
                        <div style={{ marginTop: 4 }}>
                          <Pill color={THEME.accent}>{humanizeKey(c.pipelineStage)}</Pill>
                        </div>
                      ) : null}
                    </td>
                    <td style={tableStyles.td}>
                      <ScoreBadge score={c.score} />
                    </td>
                    <td style={{ ...tableStyles.td, fontSize: 12 }}>
                      <div>{humanizeKey(c.source)}</div>
                      <div style={{ color: THEME.textMuted }}>{humanizeKey(c.channel)}</div>
                    </td>
                    <td style={tableStyles.td}>
                      <TopicChips topics={c.subscribedTopics} pending={c.pendingTopics} />
                    </td>
                    <td style={{ ...tableStyles.td, whiteSpace: "nowrap" }}>{c.lastActiveAt ? fmtRelative(c.lastActiveAt) : "—"}</td>
                    <td style={{ ...tableStyles.td, whiteSpace: "nowrap" }}>{fmtDate(c.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {data && data.totalPages > 1 ? (
        <nav aria-label="Pagination" style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 8, marginTop: 16 }}>
          <button type="button" disabled={page <= 1} onClick={() => setParams({ page: String(page - 1) })} style={disabledStyle(ghostBtn, page <= 1)}>
            Previous
          </button>
          <span className="tnum" style={{ fontSize: 13, color: THEME.textDim }}>
            {page} / {data.totalPages}
          </span>
          <button type="button" disabled={page >= data.totalPages} onClick={() => setParams({ page: String(page + 1) })} style={disabledStyle(ghostBtn, page >= data.totalPages)}>
            Next
          </button>
        </nav>
      ) : null}

      <AddContactDialog open={adding} onClose={() => setAdding(false)} />
      <BulkDialog
        action={bulk}
        ids={[...selected]}
        tags={tags}
        onClose={() => setBulk(null)}
        onDone={() => {
          setBulk(null);
          void load();
        }}
      />
      <style>{`@keyframes crm-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

type BulkAction = "addTag" | "removeTag" | "setPipelineStage" | "createTask";

function BulkDialog({ action, ...rest }: { action: BulkAction | null; ids: string[]; tags: TagOption[]; onClose: () => void; onDone: () => void }) {
  return action ? <BulkForm action={action} {...rest} /> : null;
}

function BulkForm({ action, ids, tags, onClose, onDone }: { action: BulkAction; ids: string[]; tags: TagOption[]; onClose: () => void; onDone: () => void }) {
  const [tagId, setTagId] = useState(tags[0]?.id ?? "");
  const [tagName, setTagName] = useState("");
  const [stage, setStage] = useState<string>("to_contact");
  const [title, setTitle] = useState("");
  const titles: Record<BulkAction, string> = {
    addTag: "Add a tag",
    removeTag: "Remove a tag",
    setPipelineStage: "Set pipeline stage",
    createTask: "Create a task for each",
  };
  const ready = action === "addTag" ? !!(tagId || tagName.trim()) : action === "removeTag" ? !!tagId : action === "createTask" ? !!title.trim() : true;

  return (
    <FormDialog
      open
      title={titles[action]}
      description={`${ids.length} selected ${ids.length === 1 ? "contact" : "contacts"}.`}
      submitLabel="Apply"
      submitDisabled={!ready}
      onClose={onClose}
      onSubmit={async () => {
        const payload =
          action === "addTag"
            ? { action, ids, ...(tagName.trim() ? { name: tagName.trim() } : { tagId }) }
            : action === "removeTag"
              ? { action, ids, tagId }
              : action === "setPipelineStage"
                ? { action, ids, stage: stage === "none" ? null : stage }
                : { action, ids, title: title.trim() };
        try {
          const res = await sendJson<{ affected: number }>("/api/admin/contacts/bulk", "POST", payload);
          toast.success(`Done: ${res.affected} updated`);
          onDone();
        } catch (err) {
          toast.error((err as Error).message);
        }
      }}
    >
      {action === "addTag" || action === "removeTag" ? (
        <FormField label="Tag" htmlFor="bulk-tag">
          <select id="bulk-tag" value={tagId} onChange={(e) => setTagId(e.target.value)} style={{ ...selectStyle, width: "100%" }}>
            {tags.length === 0 ? <option value="">No tags yet</option> : null}
            {tags.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </FormField>
      ) : null}
      {action === "addTag" ? (
        <FormField label="…or a new tag" htmlFor="bulk-new-tag">
          <input id="bulk-new-tag" value={tagName} maxLength={40} onChange={(e) => setTagName(e.target.value)} style={inputStyle} placeholder="e.g. warm-list" />
        </FormField>
      ) : null}
      {action === "setPipelineStage" ? (
        <FormField label="Pipeline stage" htmlFor="bulk-stage">
          <select id="bulk-stage" value={stage} onChange={(e) => setStage(e.target.value)} style={{ ...selectStyle, width: "100%" }}>
            {PIPELINE_STAGES.map((s) => (
              <option key={s} value={s}>
                {humanizeKey(s)}
              </option>
            ))}
            <option value="none">Remove from the pipeline</option>
          </select>
        </FormField>
      ) : null}
      {action === "createTask" ? (
        <FormField label="Task" htmlFor="bulk-task">
          <input id="bulk-task" value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} style={inputStyle} placeholder="Send script C" />
        </FormField>
      ) : null}
    </FormDialog>
  );
}
