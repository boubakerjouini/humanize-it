export interface ReadabilityMetrics {
  fleschScore: number;
  fleschLabel: string;
  fleschColor: string;
  readingTimeMinutes: number;
  avgSentenceLength: number;
  vocabularyRichness: number; // type-token ratio as %
  gradeLevel: number;
  gradeLevelLabel: string;
}

function countSyllables(word: string): number {
  const cleaned = word.replace(/[^a-z]/g, "");
  if (cleaned.length <= 2) return 1;
  const vowelGroups = cleaned.match(/[aeiouy]+/g);
  if (!vowelGroups) return 1;
  let count = vowelGroups.length;
  if (cleaned.endsWith("e") && count > 1) count--;
  if (cleaned.endsWith("le") && cleaned.length > 2 && !/[aeiouy]/.test(cleaned[cleaned.length - 3])) count++;
  return Math.max(1, count);
}

function getFleschLabel(score: number): { label: string; color: string } {
  if (score >= 80) return { label: "Very Easy", color: "#22c55e" };
  if (score >= 70) return { label: "Easy", color: "#22c55e" };
  if (score >= 60) return { label: "Fairly Easy", color: "#86efac" };
  if (score >= 50) return { label: "Moderate", color: "#eab308" };
  if (score >= 40) return { label: "Fairly Difficult", color: "#f97316" };
  if (score >= 30) return { label: "Difficult", color: "#ef4444" };
  return { label: "Very Difficult", color: "#ef4444" };
}

function getGradeLevelLabel(grade: number): string {
  if (grade <= 5) return "Elementary";
  if (grade <= 8) return "Middle School";
  if (grade <= 12) return "High School";
  if (grade <= 16) return "College";
  return "Graduate";
}

export function computeReadability(text: string): ReadabilityMetrics {
  const sentences = text
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  const words = text
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 0);

  if (sentences.length === 0 || words.length === 0) {
    return {
      fleschScore: 0,
      fleschLabel: "N/A",
      fleschColor: "rgba(255,255,255,0.3)",
      readingTimeMinutes: 0,
      avgSentenceLength: 0,
      vocabularyRichness: 0,
      gradeLevel: 0,
      gradeLevelLabel: "N/A",
    };
  }

  const asl = words.length / sentences.length;
  const totalSyllables = words.reduce((sum, w) => sum + countSyllables(w), 0);
  const asw = totalSyllables / words.length;

  // Flesch Reading Ease
  const flesch = Math.round((206.835 - 1.015 * asl - 84.6 * asw) * 10) / 10;
  const clampedFlesch = Math.max(0, Math.min(100, flesch));
  const { label: fleschLabel, color: fleschColor } = getFleschLabel(clampedFlesch);

  // Reading time (words / 200 wpm)
  const readingTimeMinutes = Math.round((words.length / 200) * 10) / 10;

  // Average sentence length
  const avgSentenceLength = Math.round((words.length / sentences.length) * 10) / 10;

  // Vocabulary richness (type-token ratio as %)
  const uniqueWords = new Set(words).size;
  const vocabularyRichness = Math.round((uniqueWords / words.length) * 1000) / 10;

  // Flesch-Kincaid Grade Level
  const gradeLevel = Math.round((0.39 * asl + 11.8 * asw - 15.59) * 10) / 10;
  const clampedGrade = Math.max(1, Math.min(20, gradeLevel));
  const gradeLevelLabel = getGradeLevelLabel(clampedGrade);

  return {
    fleschScore: clampedFlesch,
    fleschLabel,
    fleschColor,
    readingTimeMinutes,
    avgSentenceLength,
    vocabularyRichness,
    gradeLevel: clampedGrade,
    gradeLevelLabel,
  };
}
