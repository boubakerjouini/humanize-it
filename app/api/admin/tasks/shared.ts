// ===========================================================
// app/api/admin/tasks/shared.ts — Task vocabulary shared by the tasks API and
// the /admin/tasks page (pure).
// ===========================================================

export const TASK_VIEWS = ["today", "overdue", "upcoming", "done"] as const;
export type TaskView = (typeof TASK_VIEWS)[number];

/** CrmTask.kind values. founder_review and team_setup come from the in-app service requests. */
export const TASK_KINDS = ["follow_up", "outreach", "email", "call", "review", "founder_review", "team_setup", "other"] as const;
export type TaskKind = (typeof TASK_KINDS)[number];

export const TASK_KIND_LABELS: Record<TaskKind, string> = {
  follow_up: "Follow-up",
  outreach: "Outreach",
  email: "Email",
  call: "Call",
  review: "Review",
  founder_review: "First-document review",
  team_setup: "Team setup call",
  other: "Other",
};

export const TASK_PRIORITIES = ["high", "normal", "low"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];
