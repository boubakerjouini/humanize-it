# HumanizeIt — Detection Algorithm

## Overview

The analysis engine runs **entirely on the server** (no external AI call).
It uses pattern matching, statistical analysis, and weighted scoring
to estimate how likely a text was AI-generated.

**Output:** A score from 0 (human) to 100 (AI-generated).

---

## Scoring Formula

```
finalScore = clamp(0, 100,
  (patternScore × 0.60) +
  (statisticalScore × 0.25) +
  (structuralScore × 0.15)
)
```

### 1. Pattern Score (60%)

Sum of weighted pattern hits, normalized to 0–100:

```
patternScore = min(100, Σ (pattern.hits × pattern.weight × severityMultiplier))
```

Severity multipliers:
- `critical` → 3.0
- `high`     → 2.0
- `medium`   → 1.5
- `low`      → 1.0

### 2. Statistical Score (25%)

Based on measurable text properties:

| Metric              | AI-typical range  | Weight |
| ------------------- | ----------------- | ------ |
| Burstiness          | < 0.20            | 30%    |
| Type-Token Ratio    | < 0.40            | 25%    |
| Avg Sentence Length  | 18–25 words       | 25%    |
| Flesch Reading Ease  | 40–60             | 20%    |

Low burstiness = uniform sentence lengths = AI signature.
Low TTR = repetitive vocabulary = AI signature.

### 3. Structural Score (15%)

Based on document-level patterns:
- Predictable paragraph lengths
- Formulaic intro/conclusion patterns
- Excessive use of transitional phrases
- Numbered or bulleted list density

---

## 24 Detection Patterns

### AI Vocabulary (Patterns 1–3)

**Pattern 1: AI Vocabulary — Tier 1 (Critical)**
Words almost exclusively used by AI:
`delve`, `tapestry`, `landscape`, `Moreover`, `Furthermore`,
`comprehensive`, `multifaceted`, `pivotal`, `nuanced`, `intricate`

**Pattern 2: AI Vocabulary — Tier 2 (High)**
Words overused by AI but also used by humans:
`crucial`, `essential`, `significant`, `robust`, `streamline`,
`leverage`, `facilitate`, `paradigm`, `innovative`, `dynamic`

**Pattern 3: AI Vocabulary — Tier 3 (Medium)**
Words slightly over-represented in AI text:
`enhance`, `optimize`, `utilize`, `implement`, `framework`,
`methodology`, `ecosystem`, `scalable`, `holistic`, `synergy`

### Phrase Patterns (Patterns 4–8)

**Pattern 4: Sycophantic Phrases (High)**
`That's a great question`, `Absolutely!`, `Great point!`,
`I'd be happy to help`, `Certainly!`, `Of course!`

**Pattern 5: Filler Phrases (Medium)**
`It's important to note that`, `It's worth mentioning that`,
`In today's rapidly evolving`, `In the realm of`,
`When it comes to`, `At the end of the day`

**Pattern 6: Generic Conclusions (High)**
`In conclusion`, `To sum up`, `In summary`,
`Overall, it is clear that`, `Moving forward`,
`As we have seen`

**Pattern 7: Hedging Language (Medium)**
`It could be argued that`, `One might say`,
`It is generally accepted`, `To some extent`,
`In many cases`, `It depends on various factors`

**Pattern 8: Transition Overuse (Low)**
`However`, `Nevertheless`, `On the other hand`,
`Consequently`, `Subsequently`, `In contrast`

### Structural Patterns (Patterns 9–14)

**Pattern 9: Repetitive Sentence Starters (High)**
3+ consecutive sentences starting the same way (`This`, `The`, `It`).

**Pattern 10: List-Heavy Structure (Medium)**
More than 30% of content is bullet points or numbered lists.

**Pattern 11: Uniform Paragraph Length (Medium)**
All paragraphs within ±15% of average length.

**Pattern 12: Perfect Grammar (Low)**
Zero contractions, no sentence fragments, no colloquialisms.

**Pattern 13: Formulaic Introduction (High)**
Opening follows "In [topic], [broad claim]" template.

**Pattern 14: Formulaic Conclusion (High)**
Closing paragraph restates intro points verbatim.

### Semantic Patterns (Patterns 15–19)

**Pattern 15: Over-Explanation (Medium)**
Defining common terms unnecessarily.

**Pattern 16: Balanced Viewpoint (Medium)**
Every argument followed by counterargument ("While X, it's also true that Y").

**Pattern 17: Excessive Qualifiers (Low)**
Overuse of `very`, `extremely`, `highly`, `particularly`, `especially`.

**Pattern 18: Abstract Language (Medium)**
High density of abstract nouns with no concrete examples.

**Pattern 19: Emoji/Personality Absence (Low)**
Zero informal markers in contexts where they'd be natural.

### Statistical Patterns (Patterns 20–24)

**Pattern 20: Low Burstiness (Critical)**
Standard deviation of sentence lengths < 0.20 of mean.

**Pattern 21: Low Type-Token Ratio (High)**
Unique words / total words < 0.40 (for texts > 100 words).

**Pattern 22: Median Sentence Length (Medium)**
Average sentence length between 18–25 words consistently.

**Pattern 23: Predictable Reading Level (Medium)**
Flesch score between 40–60 across all paragraphs.

**Pattern 24: Low Perplexity Indicators (High)**
Text uses the most predictable/common word choices throughout.

---

## Burstiness

**Definition:** Variance in sentence length across a text.

```
burstiness = stddev(sentenceLengths) / mean(sentenceLengths)
```

- Human text: burstiness > 0.40 (mix of short and long sentences)
- AI text: burstiness < 0.20 (uniform sentence lengths)

## Type-Token Ratio (TTR)

```
TTR = uniqueWords / totalWords
```

- Human text: TTR > 0.55 (varied vocabulary)
- AI text: TTR < 0.40 (repetitive word choices)

Note: TTR naturally decreases with text length. Normalize by computing
TTR on sliding windows of 100 words and averaging.

## Flesch Reading Ease

```
FRE = 206.835 - (1.015 × ASL) - (84.6 × ASW)
```

Where:
- ASL = average sentence length (words per sentence)
- ASW = average syllable count per word

AI text tends to cluster in the 40–60 range (consistent "college" level).
Human text shows more variance.
