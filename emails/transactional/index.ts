// ===========================================================
// emails/transactional/index.ts — Registry of the transactional emails that
// stream C owns: lead-magnet delivery, the detector report, the extension
// waitlist confirmation, the neutral double opt-in and the Founding 100 list
// confirmation. emails/registry.ts
// merges it; keep the export name and type.
// ===========================================================

import type { TemplateRegistry } from "@/emails/registry";
import { detectorReport } from "@/emails/transactional/detector-report";
import { doiConfirm } from "@/emails/transactional/doi-confirm";
import { foundingConfirm } from "@/emails/transactional/founding-confirm";
import { magnetDelivery } from "@/emails/transactional/magnet-delivery";
import { waitlistConfirm } from "@/emails/transactional/waitlist-confirm";

export const TRANSACTIONAL: TemplateRegistry = {
  magnet_delivery: magnetDelivery,
  detector_report: detectorReport,
  waitlist_confirm: waitlistConfirm,
  doi_confirm: doiConfirm,
  founding_confirm: foundingConfirm,
};
