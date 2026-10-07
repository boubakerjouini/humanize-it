// ===========================================================
// components/admin/email/flow-copy.ts — What switching a flow on or off will
// actually do, in words, for the confirmation dialog. Swept sequences matter
// most: switching one on enrolls everyone who qualifies at the next daily run.
// ===========================================================

export type ToggleFlow = {
  name: string;
  kind: "transactional" | "notice" | "sequence" | string;
  enabled: boolean;
  swept: boolean;
  trigger: string;
  active: number;
};

export type BackfillCount = { candidates: number; stepsLate: number; stepsToSend: number };

export function toggleBody(flow: ToggleFlow, dry: BackfillCount | null | "loading"): string {
  if (flow.enabled) {
    if (flow.kind !== "sequence") return `Requests will no longer send the ${flow.name.toLowerCase()} email.`;
    return `Nothing more is sent from ${flow.name}. Its ${flow.active} active enrollments pause where they are and resume if you switch it back on.`;
  }
  if (flow.kind !== "sequence") return `${flow.name} emails go out as soon as someone asks for them. Outside production only allowlisted inboxes receive them.`;
  const count = dry === "loading" ? "…" : dry ? String(dry.candidates) : "an unknown number of";
  const late = dry && dry !== "loading" && dry.stepsLate > 0 ? ` ${dry.stepsLate} of their steps are already too late and will be skipped, not sent late.` : "";
  if (flow.swept) {
    return `Enabling ${flow.name} enrolls the ${count} people who qualify today at the next daily run (08:00 UTC, or Run now), then everyone who qualifies after.${late}`;
  }
  return `Enabling ${flow.name} enrolls new people from now on (${flow.trigger.toLowerCase()}). ${count} people qualify already and will NOT be enrolled unless you click Backfill on the sequence page.`;
}
