---
name: outreach-batch
description: Produce N personalized outreach drafts for one segment of HumanizeIt prospects (warm network, testers, partners such as tutors, coaches and writing centers, roundup authors, or cold small content teams), with follow-ups and CRM logging instructions. Use when the founder needs today's or this week's messages. Triggers include "/outreach-batch", "write 20 DMs", "outreach messages", "cold emails for agencies", "follow-ups", and French phrasing such as "prépare-moi 20 messages", "écris les DM du jour", "relances", "emails à froid pour les agences", "messages pour les profs d'anglais". The outreach-sdr drafts them (partnerships-manager for partner and roundup segments); saved under .claude/growth-kb/drafts/outreach/. Never sends.
argument-hint: "<N> <segment: warm-seg-N | tester | partner | roundup | cold-agency | cold-collective | cold-coach | cold-esl | cold-writing-center | follow-up> [channel] [prospect list path or pasted list]"
---

# Outreach batch

N messages the founder can send in one sitting: each with a personalized first line, the right script, the follow-up, and exactly how to log it in the CRM so the Rule-of-100 count and the day-90 review stay true.

## Inputs

- **N**: number of drafts (default: today's Rule-of-100 target from the latest standup, or the daily minimum in `08-operating-system.md` §1).
- **Segment**: one of the outreach tags in `channels/outreach.md` §4 (`warm-seg-{n}`, `tester`, `partner`, `roundup`, `cold-{agency|coach|esl|collective|writing-center}`) or `follow-up` (day 3 / 7 / 14 messages for people already contacted).
- **Warm or cold**: derived from the segment. Cold = businesses only.
- **Channel**: WhatsApp, LinkedIn, email, DM, in person (default per segment in `channels/outreach.md`).
- **Prospect list**: from the founder (pasted or a file path), or "find them" for public business targets (partners, roundup authors, small agencies) where the agent may research public pages. Existing users and contacts are referenced by CRM contact link or id, never copied with personal details.

## Preflight

1. If `.claude/growth-kb/` is missing (fresh clone, local-only), stop and ask the founder to restore it.
2. Read `channels/outreach.md` (ACA, scripts, who in what order, cadence, cold rules, CRM logging), `02-positioning-voice-icp.md`, `07-compliance-guardrails.md` §1-2, and the matching `scripts/` file (`warm-dms.txt`, `cold-emails.txt`, `roundup-pitches.txt`).
3. **Cold gate**: cold email only from the separate, warmed outreach domain and not before the cold-start week in `08-operating-system.md` §3 (check `09-decisions-log.md` for the domain's status). If the gate is not met, draft the batch anyway only if the founder insists, each file marked `HOLD: cold domain not ready`, and recommend a warm or partner segment for today instead.
4. Check `09-decisions-log.md` for segments or scripts that were stopped (for example a rewrite after a low reply rate).

## Procedure

1. **Delegate** (Agent tool, `model: opus`). One agent normally; split in two parallel calls only when N > 20 or the batch mixes a partner segment with a people segment.
   - **`outreach-sdr`** for warm, tester, cold and follow-up segments.
   - **`partnerships-manager`** for `partner` and `roundup` segments (and directory or affiliate pitches).
   - Brief: "Write N outreach drafts for segment <segment> on <channel>. Read `.claude/growth-kb/channels/outreach.md`, `02-positioning-voice-icp.md`, `07-compliance-guardrails.md` §1-2 and `scripts/<file>` first. Use ACA and the script family that fits; the first line must be specific to the person or business (from the list I give or from public pages you can cite); the ask is one clear, small step (feedback, a tester spot, a 20-minute call, a link) per `channels/outreach.md` §2 'What to ask for'. Cold emails: plain text, under 120 words, a real gift (5-minute personalization), an opt-out line, sender identity; never to individuals' private addresses. For each draft return: prospect label (as given, or public business name and role), channel, script id, subject (email only), message, follow-ups for day 3 / 7 / 14, CRM logging block. Mark any unknown fact `[FOUNDER: ...]`; never invent a mutual friend, a result or a quote. Do not send anything, do not write files."
2. **Review (you).** Each draft: specific first line (no generic flattery), honest claims (`02` §4, `07` §1), prices and offers match `03-offers-pricing.md`, the ask is small, cold rules met. Rewrite or drop drafts that fail.
3. **Save** to `.claude/growth-kb/drafts/outreach/YYYY-MM-DD-<segment>.md`: a header (segment, channel, script ids, count, gate status) then one section per draft. Keep personal data minimal: first name and public handle or business only; no email addresses, phone numbers or anything taken from the user database. Add a line at the top: "Delete or archive this file once sent."
4. **Show** the founder the summary table, the file path, and the logging steps.

## CRM logging instructions (include in every batch)

For each message sent, in `/admin/pipeline` (header **Log touch**) or on the contact page:
1. No contact yet → **Add prospect** (name, handle, company, tags: the segment tag).
2. Log touch: channel (`whatsapp`, `linkedin`, `email`, `dm`, ...), outcome `sent`, script used (e.g. `warm-dms#3`, `cold-emails#2`), one-line note.
3. Move the outreach stage to `contacted`; **Add task** for the day-3 follow-up.
4. Replies: log outcome `replied` (or `interested` / `not_interested`) when answering; move the stage per the table in `channels/outreach.md` §4. "Stop" or "unsubscribe" → stage `lost`, never contact again.

## Time budget

About 10 minutes for 10 to 15 drafts, 20 minutes for 30. The founder sends and logs them in 45 to 60 minutes.

## Output format

```
## Outreach batch YYYY-MM-DD — <segment> — N drafts (<channel>)
Gate: <warm | cold domain ready | HOLD: reason>
File: .claude/growth-kb/drafts/outreach/YYYY-MM-DD-<segment>.md

| # | Prospect | Channel | Script | Ask | Follow-up due |
|---|---|---|---|---|---|

Gaps to fill: <[FOUNDER: ...] items, or "none">

## Founder actions
- [ ] Fill the gaps, then send each message from your own account/inbox — <minutes>
- [ ] Log every send in /admin/pipeline (Log touch: channel, outcome sent, script id), stage → contacted
- [ ] Add the day-3 follow-up task per contact
- [ ] Delete or archive the drafts file once sent
```

## Safety rules

- Drafts only: never send email, DMs or messages, never submit forms, never contact anyone (`07-compliance-guardrails.md` §6). The founder sends from his own accounts.
- Never write to the CRM: logging is the founder's action. Read-only data access only (`06-metrics-data-access.md` §0).
- Honest, specific, no fabricated familiarity, results, testimonials or urgency. Cold outreach to businesses only, with sender identity and an easy opt-out; respect every "no".
- Minimal personal data in draft files; nothing from the user database copied into them; drafts stay in the local KB and never go into tracked files.
- No secrets anywhere.
