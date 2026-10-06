// ===========================================================
// lib/crm/task-rules.ts — STUB created by stream F. Owned by stream A, which
// replaces it with the auto task rules (comped expiring, paid inactive, hot
// lead, abandoned checkout…), each deduped by `${ruleKey}:${contactId}:${cycle}`.
// The daily job already calls this signature: keep it.
// ===========================================================
/* eslint-disable @typescript-eslint/no-unused-vars -- stub body; stream A implements it */

/** Create the rule-generated CRM tasks that are due. Returns how many were created. */
export async function runAutoTaskRules(now: Date): Promise<{ created: number }> {
  return { created: 0 };
}
