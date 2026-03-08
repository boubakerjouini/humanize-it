// ===========================================================
// Simulated multi-engine detection scores
// ===========================================================

export interface EngineScore {
  engine: string;
  score: number;
  status: "PASS" | "RISKY" | "FAIL";
}

const ENGINE_CONFIGS = [
  { engine: "GPTZero", multiplier: 0.95, variance: 5 },
  { engine: "Turnitin", multiplier: 0.9, variance: 8 },
  { engine: "Originality.ai", multiplier: 1.02, variance: 3 },
  { engine: "Copyleaks", multiplier: 0.88, variance: 6 },
  { engine: "Winston AI", multiplier: 0.92, variance: 4 },
] as const;

function clamp(min: number, max: number, value: number): number {
  return Math.max(min, Math.min(max, value));
}

function randomInRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function getStatus(score: number): "PASS" | "RISKY" | "FAIL" {
  if (score < 30) return "PASS";
  if (score < 60) return "RISKY";
  return "FAIL";
}

/**
 * Generate simulated detection scores for multiple engines
 * based on our own detection score as the baseline.
 */
export function simulateEngineScores(baseScore: number): EngineScore[] {
  return ENGINE_CONFIGS.map(({ engine, multiplier, variance }) => {
    const raw = baseScore * multiplier + randomInRange(-variance, variance);
    const score = Math.round(clamp(0, 100, raw));
    return { engine, score, status: getStatus(score) };
  });
}
