---
name: growth-weekly-review
description: Weekly growth review for HumanizeIt (about 30 minutes, Sunday). Use when the founder does his weekly review, fills the scoreboard, or asks how the week went and what to do next week. Triggers include "/growth-weekly-review", "weekly review", "Sunday review", "scoreboard", "how did the week go", and French phrasing such as "revue de la semaine", "bilan de la semaine", "on fait le point", "remplis le scoreboard", "plan de la semaine prochaine". Builds the scoreboard vs targets, applies the decision rules per channel, reads out experiments, plans next week, and proposes decisions-log updates; saves a dated weekly report. Read-only, drafts only. On the first Sunday of the month it also prepares the retention review; on day 30 (the week-4 review), 60 and 90 it adds the milestone decision rules.
argument-hint: "[ISO week YYYY-Www, defaults to the week just ending]"
---

# Growth weekly review (Sunday)

One honest page: where the numbers are vs the targets, what the decision rules say, which experiment to run next, and Monday's first actions. The founder decides; the team prepares.

## Inputs

- **Week**: the ISO week just ending (Monday to Sunday) unless the founder names one. Report file name uses the ISO week, e.g. `2026-W43` (`date +%G-W%V`).
- Founder-only numbers he pastes (Search Console, Bing Webmaster, LemonSqueezy, tracker Daily Log) when they are not reachable read-only.
- Notes from the week: replies, objections, what felt good or bad.

## Preflight

1. If `.claude/growth-kb/` is missing (fresh clone, local-only), stop and ask the founder to restore it.
2. Read `08-operating-system.md` (§4 scoreboard targets, §5 decision rules, §3 plan for this and next week), `09-decisions-log.md`, `06-metrics-data-access.md` §1 (KPI definitions) and §4 (Sunday routine).
3. Read this week's standup reports and last week's weekly report in `.claude/growth-kb/reports/`.
4. Flag the special Sundays: first Sunday of the month (retention review, `channels/retention.md` §9), and day 30 (week-4 review) / 60 / 90 (the Day 30, Day 60 and Day 90 blocks in `08` §5).

## Procedure

Run steps 1 to 3 in parallel (one message, Agent calls with `model: opus`). Add step 4 only when it applies.

1. **`growth-analyst`: scoreboard.** Brief: "Follow the Sunday routine in `06-metrics-data-access.md` §4 with the read-only recipes (§0 rules in full). Fill one row of every metric in `08-operating-system.md` §4 for week <YYYY-Www> (Vercel: Monday-to-Sunday date bounds, `until` is inclusive, `2>/dev/null` before `jq`, per `06` §3.1; PostHog: browser and server queries per `06` §3.3), with raw counts next to rates, the source per number, the week-over-week change, and the target for the nearest milestone column. Mark 'founder to paste' for sources not reachable read-only (`06` §3.8). Also return per-channel signups, leads and touches (by first-touch source and outreach tags) so channel rules can be applied. Experiments: read the running ones in `09-decisions-log.md` and report the number each was meant to move, with the sample size. No personal data. Max 500 words plus the tables."
2. **`growth-lead`: rules and next week.** Brief: "Read `08-operating-system.md` §3-5, `09-decisions-log.md`, this week's standup reports. Wait for no one: work from the targets and plan. Return (a) next week's dated plan items from `08` §3 and anything carried over, (b) the decision rules that could trigger this week and what data decides them, (c) up to two candidate experiments (one will be chosen), each with hypothesis, the single number it should move, how long, and the stop rule. Max 500 words."
3. **`lifecycle-email-manager`: weekly email check.** Brief: "Prepare the 10-minute weekly email check in `channels/email-lifecycle.md` §10 from read-only data (`06` §3.4/§3.6): raw sent/delivered/bounced/complained/skipped by reason per stream, flow states, any circuit-breaker warning, config skips (such as missing postal address). Recommend at most one email change. Max 250 words." Skip this agent while sending is off and nothing was sent this week; note "email: sending off, nothing to review" instead.
4. **When it applies**: first Sunday of the month → `retention-cs` prepares the monthly retention review (`channels/retention.md` §9: joins vs cancels, who went quiet as counts, interview candidates as CRM stages, one change). Day 30/60/90 → `growth-lead` gets the milestone rules from `08` §5 as an extra deliverable, with `growth-analyst`'s data pack per rule.
5. **Merge (you).**
   - Scoreboard: one table, status per metric (on track / behind / far behind vs the nearest target).
   - Channel decisions: apply each rule in `08` §5 to each channel with the number that triggers or clears it: **double**, **keep**, **fix** (what), or **stop**. No rule triggered → "keep" with the reason.
   - Experiments readout: running ones with result and verdict (continue / stop / decide); pick at most **one** new experiment (the rule in `08` §2), naming the number it should move.
   - Next week's plan: Monday's first 30 contacts as a segment mix, the content batch theme, the dated plan items, the founder setup items still pending.
   - Decisions: write proposals into `09-decisions-log.md` §3 ("Proposed by agents"), dated, with the data and the number. Never write to §1 "Decided": the founder moves items there himself (or tells you to, in his own message).
6. **Save** to `.claude/growth-kb/reports/YYYY-Www-weekly.md`. Counts and segments only.
7. **Show** the founder the review in his language, with the decisions to make first.

## Time budget

About 30 minutes: 10 for the parallel agents, 10 to merge and save, 10 for the founder to read, decide and fill the tracker's Weekly KPI tab.

## Output format (also the saved report)

```
# Weekly review YYYY-Www (<Mon date> to <Sun date>) — week N of 12

## Scoreboard
| Metric | This week | Last week | Target (week X) | Status | Source |

## Channel decisions
| Channel | Effort this week | Result (raw) | Rule applied | Decision |

## Experiments
- Running: <name> — <number moved, sample> — continue / stop / decide
- Next (one): <hypothesis> — moves <metric> — <duration> — stop rule

## Email check
<5 lines, or "sending off, nothing to review">

## Retention review / Milestone rules
<only on the first Sunday of the month or day 30/60/90>

## Next week (YYYY-Www)
- Monday first 30: <mix>
- Content batch theme: <...>
- Plan items: <dated items from 08 §3>
- Pending setup: <...>

## Decisions for you
1. <decision> — <data> — recommended: <option>
(proposals also logged in 09-decisions-log.md §3)

## Founder actions
- [ ] Fill the Weekly KPI tab in the tracker (numbers above) — 5 min
- [ ] Decide: <...>
- [ ] <setup or plan item> — <where> — <minutes>
```

## Safety rules

- Read-only data access only, through `06-metrics-data-access.md` and its §0 rules (no secrets printed or written, production DB read-only aggregates, PostHog switch-query-switch-back).
- Drafts and proposals only: never toggle flows, env vars or referrals, never send, post, spend, write to production data or edit app code (`07-compliance-guardrails.md` §6). "Stop a channel" means the founder stops doing it; it never means changing production.
- `09-decisions-log.md` §1 changes only on the founder's own message in this session.
- Report raw counts next to every rate; never invent or extrapolate a number without saying so. Open rates are noise: judge on clicks, replies and in-product actions.
- No personal data in the report; nothing from it goes into tracked files, commits, PRs or public posts.
