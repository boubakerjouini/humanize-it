// ===========================================================
// HumanizeIt — AI Detection Patterns & Constants
// ===========================================================

// ---- AI Vocabulary Lists ----

/** Words almost exclusively used by AI (critical signal) */
export const AI_VOCABULARY_TIER_1 = [
  "delve",
  "tapestry",
  "landscape",
  "moreover",
  "furthermore",
  "comprehensive",
  "multifaceted",
  "pivotal",
  "nuanced",
  "intricate",
  "underscores",
  "underpins",
  "embark",
  "unravel",
  "endeavor",
  "testament",
  "cornerstone",
  "paramount",
  "fostering",
  "navigating",
  // New additions
  "groundbreaking",
  "spearhead",
  "reimagine",
  "disruptive",
  "cutting-edge",
  "best-in-class",
  "game-changing",
  "state-of-the-art",
  "world-class",
  "revolutionary",
  "unprecedented",
  "transformative",
  "visionary",
  "pioneering",
  "innovative",
  "synergistic",
  "scalable",
  "agile",
  "robust",
  "seamlessly",
  "holistically",
  "strategically",
  "fundamentally",
  "inherently",
] as const;

/** Words overused by AI but also used by humans (high signal) */
export const AI_VOCABULARY_TIER_2 = [
  "crucial",
  "essential",
  "significant",
  "robust",
  "streamline",
  "leverage",
  "facilitate",
  "paradigm",
  "innovative",
  "dynamic",
  "holistic",
  "proactive",
  "transformative",
  "cutting-edge",
  "groundbreaking",
  "unprecedented",
  "invaluable",
  "indispensable",
  "meticulous",
  "seamless",
  // New additions
  "utilize",
  "functionality",
  "implementation",
  "optimization",
  "actionable",
  "impactful",
  "outcomes",
  "deliverables",
  "stakeholders",
  "ecosystem",
  "bandwidth",
  "deep dive",
  "circle back",
  "move the needle",
  "low-hanging fruit",
  "pain points",
  "value proposition",
  "north star",
  "boil the ocean",
] as const;

/** Words slightly over-represented in AI text (medium signal) */
export const AI_VOCABULARY_TIER_3 = [
  "enhance",
  "optimize",
  "utilize",
  "implement",
  "framework",
  "methodology",
  "ecosystem",
  "scalable",
  "holistic",
  "synergy",
  "empower",
  "realm",
  "spectrum",
  "underscore",
  "bolster",
  "culminate",
  "advent",
  "trajectory",
  "intersect",
  "resonate",
] as const;

// ---- Phrase Lists ----

/** Sycophantic phrases typical of AI assistants */
export const SYCOPHANTIC_PHRASES = [
  "that's a great question",
  "absolutely!",
  "great point!",
  "i'd be happy to help",
  "certainly!",
  "of course!",
  "excellent question",
  "that's an excellent point",
  "you raise a good point",
  "i'm glad you asked",
] as const;

/** Filler phrases that AI uses as transitions */
export const FILLER_PHRASES = [
  "it's important to note that",
  "it's worth mentioning that",
  "in today's rapidly evolving",
  "in the realm of",
  "when it comes to",
  "at the end of the day",
  "it goes without saying",
  "needless to say",
  "in this day and age",
  "it is important to understand",
  "one of the most important",
  "plays a crucial role",
  "it should be noted that",
  "the importance of this cannot be overstated",
  // New additions
  "as previously mentioned",
  "as mentioned above",
  "as noted earlier",
  "last but not least",
  "first and foremost",
  "without further ado",
  "in other words",
  "to put it simply",
  "simply put",
  "in essence",
  "at its core",
  "when all is said and done",
  "the bottom line is",
  "the fact of the matter is",
  "truth be told",
  "it's worth pointing out",
] as const;

/** Generic conclusion phrases favored by AI */
export const GENERIC_CONCLUSIONS = [
  "in conclusion",
  "to sum up",
  "in summary",
  "overall, it is clear that",
  "moving forward",
  "as we have seen",
  "to summarize",
  "all things considered",
  "taking everything into account",
  "in light of the above",
  // New additions
  "the future is bright",
  "exciting times lie ahead",
  "only time will tell",
  "the possibilities are endless",
  "there's never been a better time",
  "we are at an inflection point",
  "the landscape is evolving",
  "as we look to the future",
] as const;

/** Hedging phrases that AI uses to soften claims */
export const HEDGING_PHRASES = [
  "it could be argued that",
  "one might say",
  "it is generally accepted",
  "to some extent",
  "in many cases",
  "it depends on various factors",
  "there are several perspectives",
  "it remains to be seen",
] as const;

/** Transition words overused by AI */
export const TRANSITION_WORDS = [
  "however",
  "nevertheless",
  "on the other hand",
  "consequently",
  "subsequently",
  "in contrast",
  "additionally",
  "conversely",
  "notwithstanding",
  "accordingly",
] as const;

// ---- Severity & Pattern Config ----

export type Severity = "critical" | "high" | "medium" | "low";

export const SEVERITY_MULTIPLIERS: Record<Severity, number> = {
  critical: 3.0,
  high: 2.0,
  medium: 1.5,
  low: 1.0,
} as const;

export interface PatternConfig {
  id: string;
  label: string;
  severity: Severity;
  weight: number;
  category: "vocabulary" | "phrase" | "structural" | "semantic" | "statistical";
}

/** All 24 detection patterns with severity and weight */
export const PATTERNS_CONFIG: PatternConfig[] = [
  // Vocabulary (1-3)
  { id: "ai-vocab-t1", label: "AI Vocabulary — Tier 1", severity: "critical", weight: 8, category: "vocabulary" },
  { id: "ai-vocab-t2", label: "AI Vocabulary — Tier 2", severity: "high", weight: 5, category: "vocabulary" },
  { id: "ai-vocab-t3", label: "AI Vocabulary — Tier 3", severity: "medium", weight: 3, category: "vocabulary" },

  // Phrases (4-8)
  { id: "sycophantic", label: "Sycophantic Phrases", severity: "high", weight: 6, category: "phrase" },
  { id: "filler", label: "Filler Phrases", severity: "medium", weight: 4, category: "phrase" },
  { id: "generic-conclusion", label: "Generic Conclusions", severity: "high", weight: 5, category: "phrase" },
  { id: "hedging", label: "Hedging Language", severity: "medium", weight: 3, category: "phrase" },
  { id: "transition-overuse", label: "Transition Overuse", severity: "low", weight: 2, category: "phrase" },

  // Structural (9-14)
  { id: "repetitive-starters", label: "Repetitive Sentence Starters", severity: "high", weight: 5, category: "structural" },
  { id: "list-heavy", label: "List-Heavy Structure", severity: "medium", weight: 3, category: "structural" },
  { id: "uniform-paragraphs", label: "Uniform Paragraph Length", severity: "medium", weight: 3, category: "structural" },
  { id: "perfect-grammar", label: "Perfect Grammar", severity: "low", weight: 2, category: "structural" },
  { id: "formulaic-intro", label: "Formulaic Introduction", severity: "high", weight: 5, category: "structural" },
  { id: "formulaic-conclusion", label: "Formulaic Conclusion", severity: "high", weight: 5, category: "structural" },

  // Semantic (15-19)
  { id: "over-explanation", label: "Over-Explanation", severity: "medium", weight: 3, category: "semantic" },
  { id: "balanced-viewpoint", label: "Balanced Viewpoint", severity: "medium", weight: 3, category: "semantic" },
  { id: "excessive-qualifiers", label: "Excessive Qualifiers", severity: "low", weight: 2, category: "semantic" },
  { id: "abstract-language", label: "Abstract Language", severity: "medium", weight: 3, category: "semantic" },
  { id: "no-personality", label: "Emoji/Personality Absence", severity: "low", weight: 1, category: "semantic" },

  // Statistical (20-24)
  { id: "low-burstiness", label: "Low Burstiness", severity: "critical", weight: 8, category: "statistical" },
  { id: "low-ttr", label: "Low Type-Token Ratio", severity: "high", weight: 6, category: "statistical" },
  { id: "median-sentence-len", label: "Median Sentence Length", severity: "medium", weight: 3, category: "statistical" },
  { id: "predictable-reading", label: "Predictable Reading Level", severity: "medium", weight: 3, category: "statistical" },
  { id: "low-perplexity", label: "Low Perplexity Indicators", severity: "high", weight: 5, category: "statistical" },

  // New structural patterns (25-29)
  { id: "em-dash-overuse", label: "Em Dash Overuse (—)", severity: "high", weight: 6, category: "structural" },
  { id: "colon-abuse", label: "Colon Abuse", severity: "medium", weight: 3, category: "structural" },
  { id: "passive-voice", label: "Passive Voice Excess", severity: "medium", weight: 4, category: "structural" },
  { id: "serial-listing", label: "Oxford Comma Serial Listing", severity: "low", weight: 2, category: "structural" },
  { id: "rhetorical-questions", label: "Rhetorical Questions", severity: "medium", weight: 3, category: "structural" },
] as const;

// ---- Score Weights ----

export const SCORE_WEIGHTS = {
  pattern: 0.65,
  statistical: 0.20,
  structural: 0.15,
} as const;
