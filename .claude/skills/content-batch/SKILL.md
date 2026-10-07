---
name: content-batch
description: Produce a batch of content drafts for HumanizeIt (posts, threads, short video scripts, community posts, and long-tail SEO pages) for the coming week, from the content calendar. Use for the Saturday batch or any "write N posts" request. Triggers include "/content-batch", "content batch", "write this week's posts", "Saturday batch", and French phrasing such as "prépare le contenu de la semaine", "écris-moi 5 posts", "batch du samedi", "une page longue traîne", "un post LinkedIn sur les faux positifs". The content-strategist drafts the pieces (the seo-expert drafts long-tail pages) in the founder's voice with honest claims; drafts are saved under .claude/growth-kb/drafts/content/. Never publishes.
argument-hint: "[N pieces, default 5] [week YYYY-Www, default next week] [platform] [theme]"
---

# Content batch

Turn the week's content slot into N publish-ready drafts the founder can post in 10 minutes a day: one piece per weekday, plus the long-tail page in the weeks that have one.

## Inputs

- **N**: number of pieces (default 5, one per weekday).
- **Week**: ISO week the pieces are for (default: next week). Folder name `YYYY-Www`.
- **Platform(s)**: default from the decisions log (the platform chosen at the week-4 review, `09-decisions-log.md`); before that, the ranking in `channels/content.md` §2.
- **Theme or source material** (optional): a test result, a user story, a thread, a release. Real data beats ideas.
- **Long-tail page**: yes when the founder asks or when `08-operating-system.md` §2-3 schedules one that week (every two weeks); otherwise no.
- **Language**: English by default; French or Arabic only for pieces aimed at that audience (`channels/content.md` §5, `channels/seo.md` §4 pilot rules).

## Preflight

1. If `.claude/growth-kb/` is missing (fresh clone, local-only), stop and ask the founder to restore it.
2. Read `channels/content.md` (formats, cadence, post ideas, production rules), `02-positioning-voice-icp.md` (audiences, voice, honesty rules), `07-compliance-guardrails.md` §1, and `08-operating-system.md` §3 for the week's plan items (launches, tests, broadcasts the content should support).
3. List `.claude/growth-kb/drafts/content/` and `09-decisions-log.md` to avoid repeating last weeks' pieces and to respect decided platforms.

## Procedure

1. **Plan the slate (you, 2 minutes).** N slots: weekday, platform, audience (ICP from `02` §2), angle (from `channels/content.md` §5 or the theme), format, and the one action it asks for (a free tool, a magnet, a reply). Mix audiences; lead with the false-flag angle; at most one founder-story piece.
2. **Delegate in parallel** (one message, `model: opus`):
   - **`content-strategist`** for the N social / community pieces. Brief: the slate; "Read `channels/content.md`, `02-positioning-voice-icp.md`, `07-compliance-guardrails.md` §1 and the matching `scripts/` file first. Write each piece in the founder's voice (a developer building in public from Tunisia, direct, no hype) using Hook-Retain-Reward (`channels/content.md` §1). Platform-native length. Use only numbers, tests and stories that exist in the KB or the source material I gave you; mark any missing fact as `[FOUNDER: ...]` rather than inventing it. Community pieces follow the disclosure rules in `channels/community.md` §3. Return each piece as: slot, platform, hook, body, CTA with a UTM-tagged link (`utm_source=<platform>&utm_medium=social&utm_campaign=<YYYY-Www>`), the claims it makes and the rule each was checked against. Do not write files, do not post."
   - **`seo-expert`** only when a long-tail page is in scope. Brief: "Draft one long-tail question page following the target list, page template and French pilot rules in `.claude/growth-kb/channels/seo.md` §4. Draft only, as Markdown with proposed slug, title (50-60 chars), meta description (140-160 chars), H1, outline, body, internal links and FAQ. Use only test data that exists; mark gaps `[FOUNDER: run test ...]`. Do NOT edit any file in the app (`app/`, `content/`, `lib/`); implementation is a separate dev task on the founder's request. Return text only."
3. **Review (you).** For every piece: the pre-publish checklist in `02-positioning-voice-icp.md` §4 and the claims table in `07-compliance-guardrails.md` §1. Reject or rewrite anything implying guaranteed bypass, "undetectable", invented results or fake testimonials. Prices and limits must match `03-offers-pricing.md`.
4. **Save** each piece to `.claude/growth-kb/drafts/content/YYYY-Www/NN-<weekday>-<platform>-<slug>.md` and the page (if any) to `.claude/growth-kb/drafts/content/YYYY-Www/page-<slug>.md`. Each file starts with a header block: for (audience), platform, publish day, goal (the number it moves), claims checked, status `draft`.
5. **Show** the founder the slate table and the file paths, plus any `[FOUNDER: ...]` gaps to fill.

## Time budget

About 20 minutes for 5 pieces (plus 10 for a long-tail page). The founder's review: 15 to 30 minutes in the Saturday block, then 10 minutes a day to publish and reply.

## Output format

```
## Content batch YYYY-Www — N pieces

| # | Day | Platform | Audience | Angle | CTA | File |
|---|---|---|---|---|---|---|

Long-tail page: <slug + file, or "none this week">
Gaps to fill: <[FOUNDER: ...] items, or "none">
Claims: all checked against 02 §4 and 07 §1 (<any piece rewritten and why>)

## Founder actions
- [ ] Read and edit the drafts (Saturday block) — 20 min
- [ ] Fill the gaps: <...>
- [ ] Publish one piece a day, reply to comments for 10 min, log it (channel `content`, outcome `posted`) in /admin/pipeline
- [ ] Long-tail page: ask the dev agent to implement it (if approved) — then resubmit via IndexNow per channels/seo.md
```

## Safety rules

- Drafts only: never post, schedule, publish, submit or comment anywhere; never edit app code or content files in the repo (`07-compliance-guardrails.md` §6).
- Honest claims only (`02` §4, `07` §1): no bypass guarantees, no "undetectable", no invented tests, numbers, quotes or testimonials. Unknown facts become `[FOUNDER: ...]` placeholders.
- Founder voice, never impersonating users or writing fake reviews; community posts are disclosed.
- No personal data about users in drafts; user stories only with permission and anonymized unless the founder says otherwise.
- Read-only for any data the pieces cite (`06-metrics-data-access.md` §0). No secrets anywhere.
- Drafts stay in the local KB; never copy them into tracked files or PRs.
