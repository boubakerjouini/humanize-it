// ===========================================================
// emails/lifecycle/index.ts — Lifecycle-stream templates (stream D): account
// emails that carry the lifecycle unsubscribe (onboarding, grant notices,
// win-back ask, referral reward). emails/registry.ts merges this registry.
// ===========================================================

import type { TemplateRegistry } from "@/emails/registry";
import { check_before_submit, first_run_nudge, founder_checkin, welcome } from "@/emails/lifecycle/onboarding";
import { grant_ended, grant_ending_notice, grant_ends_tomorrow, grant_feedback } from "@/emails/lifecycle/grant";
import { winback_ask } from "@/emails/lifecycle/winback";
import { referral_reward } from "@/emails/lifecycle/referral";

export const LIFECYCLE: TemplateRegistry = {
  welcome,
  first_run_nudge,
  check_before_submit,
  founder_checkin,
  grant_ending_notice,
  grant_ends_tomorrow,
  grant_ended,
  grant_feedback,
  winback_ask,
  referral_reward,
};
