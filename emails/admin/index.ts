// ===========================================================
// emails/admin/index.ts — Admin-written templates (stream D): the admin writes
// the subject and a Markdown body; {{firstName}} is filled per recipient.
// emails/registry.ts merges this registry.
// ===========================================================

import type { TemplateRegistry } from "@/emails/registry";
import { campaign, personal_note } from "@/emails/admin/templates";

export const ADMIN: TemplateRegistry = { campaign, personal_note };
