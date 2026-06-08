# Aurora — Design Spec (the contract)

Single source of truth for the HumanizeIt UI. The previous dark "terminal" look is
REPLACED by a light, premium, friendly aesthetic. The foundation (CSS tokens, fonts,
theme helpers, score ring) is already built — you consume it, you do not redefine it.

## 1. Aesthetic in one line
Clean WHITE canvas, purple primary (#7c3aed), orange accent (#f97316), soft shadows,
generous spacing, rounded corners, a signature purple→orange gradient. Modern premium
SaaS with personality — think Linear/Vercel polish but warmer and more colorful.
NOT dark. NOT a terminal. NOT mono-heavy.

## 2. Tokens — NEVER hardcode hex. Use these.
**Inline `style={{}}`:** import `{ THEME }` from `@/lib/theme`: `THEME.bg` (#fff),
`THEME.surface1` (#f7f5fb), `THEME.surface2` (#fff card), `THEME.surface3` (#f1ecf9 hover),
`THEME.border`, `THEME.text`, `THEME.textDim`, `THEME.textMuted`, `THEME.brand` (purple),
`THEME.brandHi`, `THEME.brandDim` (#f3eefe tint), `THEME.accent` (orange), `THEME.accentHi`,
`THEME.accentDim` (#fff2e6 tint), `THEME.human`/`ai`/`warn`, `THEME.gradient` (purple→orange).
**Tailwind className:** `bg-background text-foreground bg-card border-border text-muted-foreground
bg-primary text-primary` or arbitrary vars `bg-[var(--surface-1)] text-[var(--brand)] bg-[var(--accent2)]`.

| token | value | use |
|---|---|---|
| bg | #ffffff | page canvas |
| surface1 | #f7f5fb | alt sections / nav |
| surface2 | #ffffff | cards (with border + soft shadow) |
| surface3 | #f1ecf9 | hover / raised |
| border | #e9e3f3 | hairlines |
| text | #1d1726 | primary text |
| textDim | #5b5470 | secondary text |
| textMuted | #8b8399 | tertiary (sparingly) |
| brand | #7c3aed | PRIMARY purple — actions, links, focus |
| accent | #f97316 | ORANGE — energy, highlights, secondary CTAs, badges |
| human | #16a34a | human score / good |
| ai | #e11d48 | AI / bad |
| warn | #f59e0b | mid score |

## 3. Using purple + orange together (the signature)
- Purple = primary brand: primary buttons, links, active nav, headings emphasis, focus rings.
- Orange = energy accent: a secondary CTA, highlight badges ("Save 20%", "New", "Popular"),
  underline/marker on a key hero word, icon accents, the second stop of gradients.
- The signature gradient `THEME.gradient` (purple→orange) is for ONE hero highlight word
  (use `.text-gradient`) and optionally the primary CTA fill. Don't gradient everything.
- Cards/sections stay white/very-light; color comes from accents, not big color blocks.
- Soft shadows on white (use `glow(THEME.brand)` from theme, or the `.panel` class), not flat borders alone.

## 4. Type
- Headings/display: `THEME.fontHeading` (Sora) — weight 700–800, tracking -0.02em.
- Body: `THEME.fontSans` (Inter) — 400–500, color textDim for paragraphs, text for emphasis.
- Mono `THEME.fontMono` (JetBrains Mono): ONLY for code, API keys, and numeric scores. Do NOT
  use mono for labels/eyebrows/buttons — that was the old terminal look and must go.
- Eyebrows: use the `.kicker` class (a clean purple pill with an orange dot). No `> ` prefixes.

## 5. DE-TERMINALIZE (remove these old-look artifacts)
The prior pass left dark/terminal motifs that look wrong on white — REMOVE them:
- `> ` prompt prefixes, bracketed `[ … ]` button labels, blinking carets (`.caret` now renders nothing).
- Excess UPPERCASE-mono labels — convert to normal-case Inter, or a `.kicker` pill where it's a real eyebrow.
- Neon glows / dark "signals" readouts — use soft colored chips/dots on light instead.
- Any leftover dark surfaces (`#0a0b0e`, `#101218`, `#15181f`, etc.) — they come from THEME now, but if any
  were hardcoded, replace with light tokens.

## 6. Score convention — CRITICAL
Engine returns AI-likelihood (0 = human, 100 = AI). ALWAYS show a HUMAN score
`humanScore(ai) = 100 − ai`; higher = greener = better. Helpers in `@/lib/theme`:
`humanScore`, `humanScoreColor`, `humanScoreLabel`. Use the shared
`<ScoreRing score={aiScore} />` from `@/components/ui/score-ring` everywhere — never build a new ring.

## 7. Components you consume
- `<ScoreRing score={ai} size? hideLabel? />` — pass the raw engine (AI) score.
- `<Button variant size>` — `default` = purple, `secondary` = light surface, `outline`, `ghost`, `link`,
  `destructive`. For an orange CTA use an inline orange style or className with `bg-[var(--accent2)]`.
- `<Card>` + friends — token-based light cards.
- Lucide icons over emoji. Decorative icons `aria-hidden`; meaningful ones labelled.

## 8. Accessibility (keep what's there, don't regress)
Reduced-motion handled globally. Textareas get `aria-label`. Result/score regions `aria-live="polite"`.
Modals keep dialog semantics + ESC + focus return. Color never the only signal. Nav uses real
`<a href>`/`<button>`. Body text uses text/textDim on white (AA); avoid textMuted for long copy.

## 9. Funnel — "Guided Activation" (unchanged intent)
One unmistakable path: landing hero with ONE dominant primary CTA → live no-signup demo →
single next step to signup → first humanize always completes (FREE is server-capped to one pass) →
upgrade prompt at the win moment. Pricing CTAs POST to `/api/checkout`. Keep all SEO copy, links,
structured data, pricing/FAQ data, and demo logic. Restyle + funnel only — not a content rewrite.
Do not invent social-proof numbers.

## 10. Hard rules
- Preserve all behavior/logic/data-fetching/props. Presentation only (landing may adjust funnel structure).
- No new hardcoded hex — reference tokens. White text (#fff) ON a purple/orange button is fine.
- Do not run build/tsc/prisma — the orchestrator verifies centrally.
- Keep `"use client"` and existing imports intact.
