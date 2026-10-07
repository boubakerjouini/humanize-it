---
name: campaign-draft
description: Draft one HumanizeIt email broadcast (campaign) ready to paste into /admin/campaigns as a DRAFT, with segment, topic, 3 subject options, preheader, Markdown body, a compliance check and the safe test-send steps. Use for newsletters, relaunch or launch announcements, Detector Watch issues, extension launch emails or any one-off email to a list. Triggers include "/campaign-draft", "draft a broadcast", "email campaign", "newsletter", and French phrasing such as "prépare une campagne email", "écris la newsletter", "un email pour toute la liste", "annonce par email", "brouillon de campagne". Delegates to the lifecycle-email-manager. Never sends, never creates the campaign itself.
argument-hint: "<goal or occasion> [segment] [topic: tips | extension_launch] [planned send date]"
---

# Campaign draft

One broadcast, fully prepared: who gets it and why they may legally receive it, what it says, and the exact clicks to create it as a draft and test it safely. The founder does every click; nothing is sent by the team.

## Inputs

- **Goal / occasion**: what the email is for and the one action it asks (for example "Detector Watch #1", "relaunch: we rebuilt HumanizeIt", "extension is live").
- **Segment**: a saved segment or a contacts filter (`/admin/contacts`); default proposed by the agent.
- **Topic**: the consent topic the campaign uses. Valid values are the `TOPICS` in `lib/growth/constants.ts` (marketing consent is per topic).
- **Planned send date** (optional): checked against the plan and the broadcast cap.
- Source material: test results, release notes, a user quote (with permission).

## Preflight

1. If `.claude/growth-kb/` is missing (fresh clone, local-only), stop and ask the founder to restore it.
2. Read `channels/email-lifecycle.md` (gates, campaign path §3.3, test send §5, kill switch §6, caps §7, deliverability §8, compliance §9), `07-compliance-guardrails.md` §1-2 and §6, `02-positioning-voice-icp.md` §3-4, `03-offers-pricing.md`, and `08-operating-system.md` §3 (planned broadcasts and the broadcast cap).
3. Field limits come from the code, not memory: `campaignDraftSchema` in `lib/email/campaigns.ts` (name, topic, segment, subject, preheader, Markdown body; check the max lengths there). `{{firstName}}` is supported in subject, preheader and body (falls back to "there"). The footer (unsubscribe, preferences, postal address) is added by the template: do not write one.

## Procedure

1. **Delegate to `lifecycle-email-manager`** (Agent tool, `model: opus`). Add `offer-copy-chief` in parallel only when the email carries an offer, price or guarantee. Brief:
   "Draft one campaign for <goal>. Read `.claude/growth-kb/channels/email-lifecycle.md`, `07-compliance-guardrails.md`, `02-positioning-voice-icp.md` §3-4, `03-offers-pricing.md` and `lib/email/campaigns.ts` (`campaignDraftSchema`) first. Return:
   (1) Segment: which saved segment or contacts filter, why, and the consent basis per `email-lifecycle.md` §9 (marketing needs a confirmed topic; contacts without marketing consent are excluded by the pipeline and must not be targeted with a consent-asking email). Estimate audience size as a count only if you can read it read-only (`06-metrics-data-access.md` §3.4); otherwise say the admin page shows it.
   (2) Topic (a valid `TOPICS` value).
   (3) Name (internal).
   (4) Three subject options in different styles (curiosity, direct benefit, plain/personal), within the max length, no spam triggers, no fake 'Re:'; recommend one.
   (5) Preheader.
   (6) Body in Markdown: founder's voice, one idea, one primary link with UTM (`utm_source=email&utm_medium=campaign&utm_campaign=<slug>`), plain enough to read as text, no own footer.
   (7) Compliance check: each item of the checklist below, pass/fail with the reason.
   (8) Timing: the send date vs the plan and the broadcast cap in `08-operating-system.md` §3, and the current sending state (kill switch, allowlist, breaker) as booleans from the admin status banner or `email-lifecycle.md` §1.
   Mark unknown facts `[FOUNDER: ...]`. Do not create the campaign, do not call any send or test endpoint, do not write files."
2. **Review (you).** Run the compliance checklist yourself; fix or flag failures. Check prices, limits and guarantees against `03-offers-pricing.md` (or `lib/plans.ts`).
3. **Save** to `.claude/growth-kb/drafts/email/YYYY-MM-DD-<slug>.md` in the output format below.
4. **Show** the founder the summary, the file path and the steps.

## Compliance checklist

- [ ] Audience has the consent the topic requires; no past users without marketing consent targeted; no purchased or scraped addresses.
- [ ] Sender identity clear; reply-to works (founder setup pending until the reply-to env var exists: say so).
- [ ] Postal address configured (otherwise the pipeline skips marketing sends with `no_postal_address`: say so).
- [ ] Claims honest (`02` §4, `07` §1): no bypass guarantee, no "undetectable", no invented numbers or testimonials.
- [ ] Prices, refund rule, limits match `03-offers-pricing.md`; no feature promised that is not live.
- [ ] Subject matches the content; no misleading urgency or fake reply/forward prefixes.
- [ ] Within the broadcast cap and not in a no-send window (`08` §3).
- [ ] One primary link, UTM-tagged; works on mobile; readable as plain text.

## Test-send steps (founder only)

1. `/admin/campaigns` → New → paste Name, Topic, Segment, Subject, Preheader, Body → **Save as draft**. Check the recipient count and exclusions it shows.
2. Preview in the campaign page; fix anything off (editing after a test forces a new test).
3. Test send (panel 3): requires sending enabled; goes only to an allowlisted test inbox with `[TEST]` in the subject. Keep `delivered@resend.dev` first in the allowlist, plus your own inbox to read it ("Show original": SPF, DKIM, DMARC pass; plain-text part present; footer links work). See `channels/email-lifecycle.md` §5.
4. If sending is OFF, stop here: the draft waits. Turning sending on is a separate founder decision (`email-lifecycle.md` §4 and §6).
5. Real send only by the founder, after a delivered test, by typing the confirmation count. Cancel path: `/admin/campaigns` → Cancel.

## Time budget

About 10 minutes to draft and check. The founder: 10 minutes to paste, preview and test-send.

## Output format (also the saved file)

```
# Campaign draft — <name> — planned <date or "unscheduled">
Status: DRAFT (not created in /admin/campaigns, not sent)

## Paste into /admin/campaigns
Name: ...
Topic: ...
Segment: <saved segment, or the contacts filter rules to set>
Subject (recommended): ...
  Alt 1: ...
  Alt 2: ...
Preheader: ...
Body (Markdown):
<body>

## Why this audience
<consent basis, expected size or "see admin count", exclusions>

## Compliance check
<checklist with pass/fail and notes>

## Timing
<vs the plan and the broadcast cap; sending state>

## Founder actions
- [ ] Create the campaign as a draft in /admin/campaigns and paste the fields — 5 min
- [ ] Preview, then test-send to the allowlisted test inbox and your own; check headers — 5 min
- [ ] Fix any gap: <[FOUNDER: ...] items, missing env vars>
- [ ] Decide the send date; send only after a delivered test (your click, your confirmation)
```

## Safety rules

- Never send: no campaign send, no test send, no Resend API or CLI call, no `/admin` action, no creating or editing the campaign in the database (`07-compliance-guardrails.md` §6). The founder creates, tests and sends.
- Never change production config to make a send possible (kill switch, allowlist, flow toggles, env vars). Describe the change; the founder decides.
- Read-only data access only (`06-metrics-data-access.md` §0); audience sizes as counts, never addresses.
- Never draft an email that asks people without marketing consent to opt in.
- No secrets; no personal data in the draft file; drafts stay in the local KB, never in tracked files.
