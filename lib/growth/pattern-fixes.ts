// ===========================================================
// lib/growth/pattern-fixes.ts — One-line, honest fixes for the detector's
// pattern ids (lib/algorithms/patterns.ts), used by the emailed detector
// report. Every fix makes the writing better for a human reader; none of them
// is a trick to hide AI use, and none promises a lower score elsewhere.
// Pure: safe in client and server code.
// ===========================================================

const FIXES: Record<string, string> = {
  "ai-vocab-t1": "Swap showy words like \"delve\" or \"tapestry\" for the plain word you'd say out loud.",
  "ai-vocab-t2": "Replace stock words such as \"crucial\" or \"robust\" with something more specific.",
  "ai-vocab-t3": "Check the safe, generic word choices and keep only the ones that are exactly right.",
  sycophantic: "Cut praise openers like \"Great question!\" and start with your point.",
  filler: "Delete phrases like \"It is important to note that\" and see if the sentence still works. It usually does.",
  "generic-conclusion": "End with your own takeaway or next step instead of \"In conclusion...\".",
  hedging: "Commit where you're sure: keep one qualifier where it's honest and cut the rest.",
  "transition-overuse": "Drop most \"Furthermore\" and \"Moreover\": let one sentence lead into the next.",
  "repetitive-starters": "Don't open three sentences in a row with the same word.",
  "list-heavy": "Turn one list into a short paragraph that explains how the points connect.",
  "uniform-paragraphs": "Let paragraph sizes vary: a one-line paragraph next to a longer one reads naturally.",
  "perfect-grammar": "Keep your grammar correct, and let your own phrasing and rhythm show through.",
  "formulaic-intro": "Open with a specific fact, moment or claim instead of a warm-up sentence.",
  "formulaic-conclusion": "Close with something only your text says, not a summary of the summary.",
  "over-explanation": "Trust the reader: cut the sentence that repeats what the last one said.",
  "balanced-viewpoint": "Take a position somewhere and say why, rather than weighing both sides forever.",
  "excessive-qualifiers": "Remove extra \"very\", \"quite\" and \"somewhat\" unless they change the meaning.",
  "abstract-language": "Replace one abstract claim per paragraph with a name, number, date or example.",
  "no-personality": "Add one detail from your own experience or a clear opinion of your own.",
  "low-burstiness": "Mix sentence lengths on purpose: follow a long sentence with a short one.",
  "low-ttr": "Vary your wording where you repeat the same few words, without reaching for fancy synonyms.",
  "median-sentence-len": "Break up one long sentence and join two short ones so the rhythm changes.",
  "predictable-reading": "Read it aloud and rewrite any line you'd never actually say.",
  "low-perplexity": "Add a concrete detail only you would know: it makes the text less predictable and more useful.",
  "em-dash-overuse": "Replace most em dashes with a full stop, comma or parentheses.",
  "colon-abuse": "Use colons only to introduce a real list or explanation.",
  "passive-voice": "Say who did what: turn a few passive sentences into active ones.",
  "serial-listing": "Don't group everything in threes; use the number of items that is true.",
  "rhetorical-questions": "Answer the question directly instead of asking it for effect.",
  "vague-attribution": "Name the source, or say it's your own experience, instead of \"studies show\".",
  "copula-avoidance": "Use \"is\" and \"has\" where they fit instead of \"serves as\" or \"boasts\".",
  "negative-parallelism": "Say what it is, once, instead of \"It's not just X, it's Y\".",
  "promotional-ing": "Cut chains like \"transforming, empowering and elevating\" down to one concrete verb.",
  "vague-challenge": "Name the actual problem instead of \"despite its challenges\".",
  "promotional-adjectives": "Replace \"game-changing\" or \"seamless\" with what the thing actually does.",
  "trigram-repetition": "Look for a three-word phrase you repeat and reword it the second time.",
  "low-sentence-cov": "Your sentences are all a similar length: shorten one and let another run longer.",
  "casual-ai-opener": "Drop stock hooks like \"Here's the thing\" and start with the substance.",
  "ai-metacommentary": "Keep \"I think\" only where it adds a real opinion, and back it with a reason.",
  "creative-ai-melodrama": "Swap dramatic descriptors for a plain, specific image.",
};

export const GENERIC_FIX = "Rewrite the flagged sentences in your own words, with one specific detail only you would know.";

export function fixForPattern(id: string): string {
  return Object.prototype.hasOwnProperty.call(FIXES, id) ? FIXES[id] : GENERIC_FIX;
}

export function hasPatternFix(id: string): boolean {
  return Object.prototype.hasOwnProperty.call(FIXES, id);
}
