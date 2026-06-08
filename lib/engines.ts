// ===========================================================
// lib/engines.ts — Estimated third-party detector risk
//
// IMPORTANT: These are ESTIMATES derived from our own in-house detector
// score, not live calls to GPTZero / Turnitin / etc. (we don't proxy those
// paid APIs). The previous implementation used Math.random(), which meant the
// numbers changed on every render and implied a precision we don't have.
//
// This version is DETERMINISTIC: the same input score always yields the same
// per-engine estimate, and each engine has a fixed calibration offset that
// reflects how strict it tends to be relative to our detector. The UI must
// label these as "estimated".
// ===========================================================

export interface EngineScore {
  engine: string;
  /** Estimated AI-likelihood this engine would report (0–100). */
  score: number;
  status: "PASS" | "RISKY" | "FAIL";
  /** Always true — these are modelled estimates, not live API results. */
  estimated: true;
}

// Fixed calibration per engine: `bias` shifts the estimate (some detectors run
// stricter/looser than ours), `slope` scales sensitivity. Deterministic — no RNG.
const ENGINE_CONFIGS = [
  { engine: "GPTZero", bias: 0, slope: 0.97 },
  { engine: "Turnitin", bias: -4, slope: 0.92 },
  { engine: "Originality.ai", bias: 3, slope: 1.03 },
  { engine: "Copyleaks", bias: -6, slope: 0.9 },
  { engine: "Winston AI", bias: -2, slope: 0.94 },
] as const;

function clamp(min: number, max: number, value: number): number {
  return Math.max(min, Math.min(max, value));
}

function getStatus(score: number): "PASS" | "RISKY" | "FAIL" {
  if (score < 30) return "PASS";
  if (score < 60) return "RISKY";
  return "FAIL";
}

/**
 * Produce a deterministic, per-engine ESTIMATE of detector risk from our own
 * detector's AI-likelihood score. Same input → same output, every time.
 */
export function estimateEngineScores(baseScore: number): EngineScore[] {
  return ENGINE_CONFIGS.map(({ engine, bias, slope }) => {
    const score = Math.round(clamp(0, 100, baseScore * slope + bias));
    return { engine, score, status: getStatus(score), estimated: true as const };
  });
}

/**
 * @deprecated Use {@link estimateEngineScores}. Kept as an alias so existing
 * imports keep working; it is now deterministic (no longer randomised).
 */
export const simulateEngineScores = estimateEngineScores;
