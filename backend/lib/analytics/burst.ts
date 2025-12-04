export function calculateBurstScore(actual: number, expected: number): number {
  if (expected <= 0) {
    return actual > 0 ? 1 : 0;
  }

  const diff = actual - expected;
  const ratio = diff / expected;

  return ratio > 0 ? Number(ratio.toFixed(2)) : 0;
}

export function determineBurstLevel(score: number): 'NORMAL' | 'MEDIUM' | 'HIGH' | 'SIGNIFICANT' | 'CRITICAL' {
  if (score >= 3.5) return 'CRITICAL';
  if (score >= 2.5) return 'SIGNIFICANT';
  if (score >= 1.5) return 'HIGH';
  if (score >= 0.5) return 'MEDIUM';
  return 'NORMAL';
}
