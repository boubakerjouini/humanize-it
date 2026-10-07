// ===========================================================
// emails/marketing/index.ts — Marketing-stream templates (stream D): sent only
// with topic consent, with the topic reason, one-click unsubscribe and the
// postal address. emails/registry.ts merges this registry.
// ===========================================================

import type { TemplateRegistry } from "@/emails/registry";
import {
  checkout_help,
  grant_keep_offer,
  limit_hit_menu,
  trial_midpoint,
  trial_offer,
  what_paid_users_do,
} from "@/emails/marketing/offers";
import { winback_bonus, winback_one_thing } from "@/emails/marketing/winback";
import {
  nurture_evidence,
  nurture_free_account,
  nurture_keep_going,
  nurture_three_pass,
  nurture_why_flags,
} from "@/emails/marketing/nurture";
import { waitlist_update } from "@/emails/marketing/waitlist";

export const MARKETING: TemplateRegistry = {
  what_paid_users_do,
  limit_hit_menu,
  trial_offer,
  grant_keep_offer,
  trial_midpoint,
  winback_one_thing,
  winback_bonus,
  checkout_help,
  nurture_why_flags,
  nurture_three_pass,
  nurture_evidence,
  nurture_free_account,
  nurture_keep_going,
  waitlist_update,
};
