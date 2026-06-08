# Midnight Terminal — Design Spec (the contract)

This is the single source of truth for the HumanizeIt UI/UX rework. Every surface
must conform to it. The foundation (CSS tokens, fonts, theme helpers, score ring)
is already built — you consume it, you do not redefine it.

## 1. Aesthetic in one line
Dark near-black canvas, monospace data accents, neon-green "human" score, one
disciplined violet for action. Engineered, data-forward, anti-generic-AI-SaaS.
Think: a premium terminal / observability dashboard, not a pastel SaaS.

## 2. Tokens — NEVER hardcode hex. Use these.
**In `style={{}}` (inline) code:** import `{ THEME }` from `@/lib/theme` and use
`THEME.bg`, `THEME.surface2`, `THEME.text`, `THEME.brand`, `THEME.human`, etc.
**In Tailwind className code:** use mapped tokens — `bg-background`, `text-foreground`,
`bg-card`, `border-border`, `text-muted-foreground`, `bg-primary`, `text-primary`,
`bg-secondary`, `ring-ring`. For the raw palette in Tailwind use arbitrary values
referencing the CSS var, e.g. `bg-[var(--surface-2)]`, `text-[var(--human)]`.

| token | value | use |
|---|---|---|
| bg | #0a0b0e | page canvas |
| surface1 | #101218 | nav, popovers, panels |
| surface2 | #15181f | cards |
| surface3 | #1c2027 | raised / hover |
| border | #242a33 | hairlines |
| borderStrong | #313845 | emphasized edges |
| text | #e8eaef | primary text |
| textDim | #9aa1ad | secondary text |
| textMuted | #767e8b | tertiary (sparingly) |
| brand | #7c5cff | PRIMARY action, links, focus |
| brandHi | #9a80ff | hover/highlight |
| human | #3ee08f | human score / success / good |
| ai | #ff5d5d | AI / danger / bad |
| warn | #f5b13d | caution / mid score |

## 3. Type
- Headings/display: `THEME.fontHeading` (Space Grotesk) — tight tracking (-0.02em), weight 600–700.
- Body: `THEME.fontSans` (Inter) — 400–500.
- Data / labels / scores / code: `THEME.fontMono` (JetBrains Mono), `tabular-nums`.
- Kickers/eyebrows: use the `.kicker` class (renders `> UPPERCASE MONO` with a green `>`).
- Hero H1 ~56–72px desktop (use `.hero-h1` for the responsive clamp behavior).

## 4. Terminal motifs (use them, don't overdo)
- Eyebrow labels: `.kicker` class.
- Buttons can carry bracket affordances in label text: `Humanize →`, and section CTAs may use `[ … ]` framing sparingly.
- Mono uppercase micro-labels with `letter-spacing: 0.04–0.14em` for metadata.
- Blinking caret: `.caret` (use once, e.g. end of hero headline or demo input).
- Cards: `.panel` / `.panel-1` classes OR `border: 1px solid THEME.border; background: THEME.surface2; borderRadius: THEME.radiusLg`.
- Glows: `glow-human` / `glow-brand` text classes, or `boxShadow: glow(THEME.human)` from theme.
- Faint grid + top brand glow already live on `body` — don't re-add page-wide.

## 5. Score convention — CRITICAL, do not get this wrong
The engine returns an **AI-likelihood** score: `0 = human, 100 = AI`.
**Always present a HUMAN score** in the UI: `humanScore(aiLikelihood) = 100 − ai`.
Higher human score = greener = better. Helpers in `@/lib/theme`:
`humanScore(s)`, `humanScoreColor(human)`, `humanScoreLabel(human)`.
Use the shared `<ScoreRing score={aiLikelihoodScore} />` from
`@/components/ui/score-ring` everywhere a ring is shown. Do NOT build new rings.

## 6. Components you consume
- `<ScoreRing score={ai} size? hideLabel? />` — pass the raw engine (AI) score.
- `<Button variant size>` — variants now map to tokens: `default` = brand, `secondary` = surface, `outline` = bordered, `ghost`, `link`, `destructive`.
- `<Card>` and friends — already token-based after primitives migration.
- Lucide icons over emoji. Decorative icons get `aria-hidden`; meaningful ones get a label.

## 7. Accessibility (the rework must IMPROVE this)
- Reduced-motion is handled globally in CSS — don't fight it.
- Every primary `<textarea>` gets an `aria-label`.
- Modals: dialog semantics (`role="dialog"`, `aria-modal`, labelled), ESC + focus return (already partly present — keep/strengthen).
- Score/result regions: `aria-live="polite"` so completion is announced.
- Color is never the only signal — pair with text/label.
- Nav items are real `<a href>`/`<button>`, keyboard-activatable.
- Contrast: body text `THEME.text`/`THEME.textDim` on dark passes AA; avoid `textMuted` for long copy.

## 8. Funnel — "Guided Activation" (drives the whole UX)
The acquisition path is a single, unmistakable line. Reduce competing CTAs.
1. **Landing hero**: one dominant primary CTA (`Humanize my text →`). Live no-signup demo directly under/beside it. Secondary links are quiet/ghost.
2. **Live demo**: paste → instant analysis → animated reveal of the HUMAN score with detector signals lighting up (terminal style) → ONE next step ("Humanize it free →") that routes to signup (AuthModal), preserving the entered text where feasible.
3. **Post-signup first run**: the editor's first humanize must always complete and be shown as a win (FREE is server-capped to a single non-destructive pass — already done). Present pass-1 result as the success moment.
4. **Win → upgrade**: only AFTER the first successful humanize do we surface the upgrade prompt (value-first, at peak delight), not before.
5. Pricing CTAs all POST to `/api/checkout` (already wired). No dead links.

Keep ALL existing SEO content, section anchors, structured data, internal links,
pricing data, FAQ, and the live-demo analysis logic. This is a restyle + funnel
refactor, NOT a content rewrite. Do not invent new social-proof numbers.

## 9. Hard rules
- Preserve all behavior/logic, data fetching, route handlers, and props. Only
  presentation and (on the landing) funnel structure may change.
- No new hardcoded hex — reference tokens.
- Do not run `next build`/`tsc`/`prisma` — the orchestrator verifies centrally.
- Keep `"use client"` directives and existing imports intact.
- Light-mode leftovers (white bg, gray-on-white text, purple-600) must all go dark.
