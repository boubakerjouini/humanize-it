"use client";

// ===========================================================
// /admin/sequences — Every email flow with its ON/OFF switch and 30-day
// numbers. All flows start OFF. Switching one opens a confirmation that says
// exactly who will get what (with a live count from the backfill dry run),
// because some sequences enroll everyone who qualifies at the next daily run.
// ===========================================================

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { THEME } from "@/lib/theme";
import { Empty, PageHeader, Panel, Pill, fmtRelative, tableStyles } from "@/components/admin/crm-ui";
import { ConfirmDialog } from "@/components/admin/crm-dialogs";
import { EmailStatusBanner } from "@/components/admin/email/status-banner";
import { FlowSwitch } from "@/components/admin/email/flow-switch";
import { api } from "@/components/admin/email/api";
import { toggleBody, type BackfillCount } from "@/components/admin/email/flow-copy";
import { useApi } from "@/components/admin/email/use-api";

type Flow = {
  key: string;
  name: string;
  kind: "transactional" | "notice" | "sequence";
  description: string;
  audience: string;
  swept: boolean;
  trigger: string;
  steps: number;
  enabled: boolean;
  updatedBy: string | null;
  updatedAt: string | null;
  active: number;
  paused: number;
  sent30d: number;
  converted30d: number;
};

const KIND_COLORS: Record<Flow["kind"], string> = { transactional: "#2563eb", notice: "#0891b2", sequence: THEME.brand };

export default function SequencesPage() {
  const { data, error, loading, reload } = useApi<{ items: Flow[] }>("/api/admin/sequences");
  const [pending, setPending] = useState<Flow | null>(null);
  const [dry, setDry] = useState<BackfillCount | null | "loading">(null);

  const openToggle = async (flow: Flow) => {
    setPending(flow);
    setDry(null);
    if (flow.enabled || flow.kind !== "sequence") return;
    setDry("loading");
    const res = await api<BackfillCount>(`/api/admin/sequences/${flow.key}/backfill`, { method: "POST", json: { dryRun: true } });
    setDry(res.ok ? res.data : null);
  };

  const confirmToggle = async () => {
    if (!pending) return;
    const res = await api<{ enabled: boolean }>(`/api/admin/sequences/${pending.key}`, { method: "PATCH", json: { enabled: !pending.enabled } });
    if (!res.ok) {
      toast.error(res.message);
      return;
    }
    toast.success(`${pending.name} is ${res.data.enabled ? "on" : "off"}.`);
    setPending(null);
    reload();
  };

  const flows = data?.items ?? [];
  const groups: { title: string; description: string; items: Flow[] }[] = [
    { title: "Sequences", description: "Timed emails after a trigger. Each step checks consent again before it sends.", items: flows.filter((f) => f.kind === "sequence") },
    { title: "One-off emails", description: "Sent right away when someone asks (magnet, report, confirmation) or earns a reward.", items: flows.filter((f) => f.kind !== "sequence") },
  ];

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 28px", fontFamily: THEME.fontSans }}>
      <PageHeader title="Sequences" description="Every flow starts OFF. Turn one on only when its emails are written and reviewed." />
      <EmailStatusBanner />

      {error ? <Panel><Empty title="Couldn't load the flows" description={error} /></Panel> : null}
      {loading ? <Panel><Empty title="Loading…" /></Panel> : null}

      {groups.map((group) =>
        group.items.length ? (
          <Panel key={group.title} title={group.title} description={group.description} flush style={{ marginBottom: 20 }}>
            <div style={{ overflowX: "auto" }}>
              <table style={tableStyles.table}>
                <thead>
                  <tr>
                    {["Flow", "Audience", "Trigger", "Active", "Sent 30d", "Converted 30d", "On"].map((h) => (
                      <th key={h} scope="col" style={{ ...tableStyles.th, ...(h === "On" ? { textAlign: "right" } : {}) }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {group.items.map((f) => (
                    <tr key={f.key} style={tableStyles.tr}>
                      <td style={{ ...tableStyles.td, minWidth: 220 }}>
                        <Link href={`/admin/sequences/${f.key}`} style={{ fontWeight: 600, color: THEME.text, textDecoration: "none" }}>
                          {f.name}
                        </Link>{" "}
                        <Pill color={KIND_COLORS[f.kind]}>{f.kind === "sequence" ? `${f.steps} step${f.steps === 1 ? "" : "s"}` : f.kind}</Pill>
                        <div style={{ fontSize: 12, color: THEME.textMuted, marginTop: 3 }}>{f.description}</div>
                      </td>
                      <td style={{ ...tableStyles.td, fontSize: 12 }}>{f.audience}</td>
                      <td style={{ ...tableStyles.td, fontSize: 12, maxWidth: 220 }}>{f.trigger}</td>
                      <td className="tnum" style={tableStyles.td}>
                        {f.kind === "sequence" ? f.active : "—"}
                        {f.paused ? <span style={{ color: THEME.textMuted }}> (+{f.paused} paused)</span> : null}
                      </td>
                      <td className="tnum" style={tableStyles.td}>{f.sent30d}</td>
                      <td className="tnum" style={tableStyles.td}>{f.kind === "sequence" ? f.converted30d : "—"}</td>
                      <td style={{ ...tableStyles.td, textAlign: "right", whiteSpace: "nowrap" }}>
                        <FlowSwitch on={f.enabled} label={`${f.name} ${f.enabled ? "on" : "off"}`} onClick={() => void openToggle(f)} />
                        {f.updatedAt ? (
                          <div style={{ fontSize: 11, color: THEME.textMuted, marginTop: 3 }} title={f.updatedBy ?? undefined}>
                            {fmtRelative(f.updatedAt)}
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        ) : null
      )}

      <ConfirmDialog
        open={!!pending}
        title={pending ? `${pending.enabled ? "Turn off" : "Turn on"} ${pending.name}?` : ""}
        body={pending ? toggleBody(pending, dry) : null}
        confirmLabel={pending?.enabled ? "Turn off" : "Turn on"}
        danger={!!pending?.enabled}
        onConfirm={confirmToggle}
        onClose={() => setPending(null)}
      />
    </div>
  );
}
