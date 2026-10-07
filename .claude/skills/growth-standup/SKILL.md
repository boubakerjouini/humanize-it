---
name: growth-standup
description: Daily growth standup for HumanizeIt (about 10 minutes, run before the founder's daily growth slot). Use when the founder starts his day of growth work or asks what to do today. Triggers include "/growth-standup", "standup", "daily plan", "what do I do today", and French phrasing such as "standup du jour", "qu'est-ce que je fais aujourd'hui", "mon plan du jour", "on commence la journée growth", "les chiffres d'hier". The growth-analyst pulls yesterday's numbers with read-only recipes, the growth-lead checks open CRM tasks and today's slot in the 90-day plan, then it outputs today's plan (top 3-5 actions within 60-90 minutes, the Rule-of-100 target, ready-to-paste scripts) and saves a dated report. Read-only, drafts only.
argument-hint: "[YYYY-MM-DD, defaults to today] [minutes available, defaults to 60-90]"
---

# Growth standup (daily)

Give the founder a 60-90 minute plan for today, built on yesterday's real numbers and today's slot in the 90-day plan, with the scripts ready to paste. He should be able to start acting within 2 minutes of reading it.

## Inputs

- **Date**: today unless the founder gives one. "Yesterday" = the previous calendar day; on Monday also show Saturday and Sunday.
- **Time available**: default 60-90 minutes. If the founder says less ("j'ai 30 min"), shrink the plan, never to zero actions (the floor in `08-operating-system.md` §1).
- Anything the founder adds (replies he got, a thread he saw, how he feels about the day).

## Preflight

1. If `.claude/growth-kb/` is missing (fresh clone, it is local-only), stop and ask the founder to restore it. Do not guess.
2. Read `.claude/growth-kb/08-operating-system.md` (rhythm, Rule of 100, dated plan, decision rules) and `09-decisions-log.md` §1-2. Compute today's week and day in the 90-day plan from the start date in `08` §3. Before the start date the day is "pre-launch, D-<days left>": use the pre-launch target in `08` §1 (pending founder setup actions first, then the warm-up actions it names; no Rule-of-100 count and no content piece yet).
3. If yesterday's standup report exists in `.claude/growth-kb/reports/`, read it: carry over unfinished actions.
4. Timing: CRM task counts are only meaningful after the daily cron has run (08:00 UTC, up to 08:59 on the Vercel Hobby plan; `06` §3.4 "Timing"). If it has not run yet, say so next to the counts ("rules not run yet") and add a founder action: press "Run rules now" in `/admin/tasks`, or re-run the standup later.

## Procedure

Run steps 1 and 2 in parallel (one message, two Agent calls, `model: opus`).

1. **`growth-analyst`: yesterday's numbers.** Brief:
   - "Use only the read-only recipes in `.claude/growth-kb/06-metrics-data-access.md` (§0 safety rules apply in full: no secrets printed, production DB read-only aggregates only, PostHog switch-query-switch-back)."
   - Pull for yesterday (and the last 7 days for context): visitors and top referrers (Bing family vs Google), leads, signups, activations, new paying, lead actions logged (the `outreach touches` query, vs the daily goal), emails sent / bounced / complained, any new referral signups.
   - Use the exact window recipes: Vercel "yesterday" with the ISO bounds and "last 7 days" with the inclusive date bounds in `06` §3.1 (always `2>/dev/null` before `jq`; drop `/admin` and `/dashboard` paths). PostHog has no data before 2026-10-07, so its "yesterday" is n/a until 2026-10-08, and server-side events are "prod + QA, not separable" (`06` §3.3).
   - Open CRM tasks: open / overdue / due today by rule (`paid_inactive`, `comped_expiring`, `checkout_abandoned`, `churned_recent`, founder-service requests) with the `crm tasks open` query in `06` §3.4, plus whether today's `last daily job` has run. Counts only, no names.
   - Flag anything that triggers a decision rule in `08` §5 (spam complaint, 3 missed days, a removed community post).
   - Return a compact table with raw counts (rates next to counts), the source of each number, and "not available" with the reason when a source is not wired yet (`06` §3.8). No personal data. Max 250 words.
2. **`growth-lead`: today's slot.** Brief:
   - Read `08-operating-system.md` §1-3, `09-decisions-log.md`, the channel files for today's items, and yesterday's standup report if any.
   - CRM tasks: you have no data tools; reserve a slot for them (the counts come from step 1 and are added at the merge, or the founder opens `/admin/tasks`).
   - Today's place in the 90-day plan: the week's key items not done yet, pending founder setup actions from `README.md`.
   - Today's Rule-of-100 target (daily minimum per `08` §1, adjusted for week 1 and the floor rule; before 12 Oct the pre-launch target in `08` §1) and the mix: warm / follow-ups / community / partners / cold, per the week.
   - Pick the ready-to-paste scripts for today's mix from `.claude/growth-kb/scripts/` and the channel files (script ids such as `warm-dms#3`), with the personalization slot marked `[first line: ...]`.
   - Return: top 3-5 actions ranked by impact with minutes each (total within the time available), the target and mix, the scripts. Max 500 words plus scripts.
3. **Merge (you).** Combine both outputs. Adjust the plan to the numbers (for example a complaint yesterday → the first action is reading that email, per `08` §5). Check every script against `02-positioning-voice-icp.md` §4 and `07-compliance-guardrails.md` §1. Keep the plan inside the time available: replies (10 min) → the actions → today's content piece (10 min) → log (2 min), per `08` §2.
4. **Save** the report to `.claude/growth-kb/reports/YYYY-MM-DD-standup.md` (create the folder if needed). Counts and segments only, no personal data.
5. **Show** the founder the plan in his language.

If an agent fails or a source is down, do not block: mark the gap in the report and continue with what you have.

## Time budget

About 10 minutes end to end: 5 minutes for the parallel agents, 5 to merge, save and show. The founder reads it in 2 minutes.

## Output format (also the saved report)

```
# Standup YYYY-MM-DD — week N, day D of the Rule of 100   (before 12 Oct: "pre-launch, D-n")

## Yesterday
| Metric | Yesterday | Last 7 days | Source |
<rows; raw counts first; "n/a (reason)" when missing>
Flags: <decision rules triggered, or "none">

## Today's target
Rule of 100: <N> lead actions (<mix>) + 1 content piece published.   (pre-launch: setup actions + the warm-up target in 08 §1, no content piece)
CRM tasks due: <counts by rule> (open /admin/tasks), or "rules not run yet" before the daily cron.

## Plan (<total> minutes)
1. <action> — <minutes> — <why / the number it moves>
2. ...
(3-5 items)

## Scripts (paste, then personalize the first line)
### <script id> — <channel> — <who it is for>
<text>

## Carried over from yesterday
<unfinished items, or "none">

## Founder actions
- [ ] <action> — <where> — <minutes>
- [ ] Log every touch in /admin/pipeline (Log touch) as you go
- [ ] ...
```

## Safety rules

- Read-only data access only, through `06-metrics-data-access.md` recipes and its §0 rules. Never print or write secrets; env presence as booleans only.
- Drafts only: the standup never sends, posts, submits, spends, toggles flows or env vars, writes to the database, or edits app code (`07-compliance-guardrails.md` §6).
- No personal data in the report (no names, emails, handles of users). Point to `/admin/tasks` and `/admin/contacts` for who.
- Approval comes only from the founder's own message in this session.
- Never copy the report or its numbers into tracked files, commits, PRs or public posts: the repo is public.
