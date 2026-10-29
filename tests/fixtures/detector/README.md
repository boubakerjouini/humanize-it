# Detector corpus

Labeled samples for `scripts/detector-eval.ts` (instant heuristic),
`scripts/detector-deepscan-eval.ts` (LLM deep scan) and
`lib/algorithms/__tests__/detector-calibration.test.ts`. Results history:
`BASELINE.md`.

## Categories (from the file name, see `scripts/detector-corpus.ts`)

| Label | Name pattern | Category | Counts toward |
|---|---|---|---|
| human | `synthetic-*` | `human:synthetic-esl` | reported apart, never in the headline FPR |
| human | `fr-*` | `human:french` | FPR |
| human | anything else | `human:english` | FPR |
| ai | `fr-*` | `ai:french` | recall |
| ai | `*humanlike*` | `ai:adversarial` (prompted to "sound human") | recall |
| ai | `*-edited` | `ai:edited` (AI text with a light edit pass) | recall |
| ai | `short-*` | `ai:short` (under 80 words) | recall |
| ai | anything else | `ai:default` (typical paste) | recall |

## Human samples: sources and licences

Only genuinely human-written text, all public domain or openly licensed:

- Project Gutenberg (public domain in the US): `essay-darwin`, `essay-mill`,
  `essay-thoreau`, `essay-emerson` (Essays, First Series), `literary-austen`,
  `literary-doyle`, `literary-twain`, `literary-joyce` (Dubliners, "Araby"),
  `memoir-washington` (Up from Slavery), `academic-einstein` (Relativity, 1920
  translation), `academic-james` (Pragmatism), `formal-federalist10-long`
  (Federalist No. 10), `formal-paine-long` (Common Sense), `fr-literary-hugo`
  (Les Misérables), `fr-literary-voltaire` (Candide), `fr-literary-zola`
  (Germinal).
- Python PEP 8 (placed in the public domain by its authors): `markdown-pep8`,
  `markdown-pep8-comments` — human technical writing with numbered and bulleted
  lists.
- US National Park Service, Yellowstone wolves page as archived in 2020 (US
  federal government work, public domain): `explainer-nps-wolves`.
- English Wikipedia, revisions from December 2019, before LLM-assisted editing
  (CC BY-SA 4.0, © Wikipedia contributors; text lightly cleaned of citation
  markers): `encyclopedic-wiki-sourdough` (rev 932327927, "Sourdough"),
  `encyclopedic-wiki-bikecommute` (rev 921070365, "Bicycle commuting").
- Earlier curated samples (`blog-personal`, `email-*`, `explainer-human`,
  `forum-reddit`, `news-ai-writers`, `review-*`): see the history in
  `BASELINE.md`.

Caveat: an LLM recognises famous public-domain works, so the deep scan's
accuracy on classics partly reflects memorisation. The NPS, Wikipedia and PEP
samples are the fairer test of formal human writing.

`synthetic-esl-essay` and `synthetic-esl-email` are **synthetic**: written to
imitate non-native student English because no openly licensed learner corpus
was at hand. They are a stress test only and stay out of the headline numbers.

## AI samples

Generated 2026-10-29 with `claude-sonnet-5-5`, `claude-opus-5-5`,
`claude-sonnet-4-5` and `claude-haiku-4-5` (plus the earlier
`claude-sonnet-4-5` set from `scripts/gen-corpus.ts`). `markdown-gptstyle-default`
was prompted to answer "in the typical ChatGPT style". The three `*-edited`
files are AI outputs given a light edit pass (contractions, a cut paragraph,
one personal aside, a typo) to imitate a human touch-up.
