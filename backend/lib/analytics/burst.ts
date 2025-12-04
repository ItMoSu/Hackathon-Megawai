export const BURST_THRESHOLDS = {
    SIGNIFICANT: 2.5,
    CRITICAL: 3.5,
};

export type BurstLevel = 'NORMAL' | 'MILD' | 'SIGNIFICANT' | 'CRITICAL';

//Menghitung Burst Score berdasarkan Actual vs Expected.
export function calculateBurstScore(actual: number, expected: number): number {
    const baseline = expected <= 0 ? 1 : expected;

    if (actual <= baseline) return 0;

    const diff = actual - baseline;

    // Score merepresentasikan seberapa kali lipat deviasinya
    const score = diff / baseline;
    return Math.round(score * 100) / 100;
}

//Menentukan Level Burst berdasarkan Score
export function determineBurstLevel(score: number): BurstLevel {
    if (score >= BURST_THRESHOLDS.CRITICAL) return 'CRITICAL';
    if (score >= BURST_THRESHOLDS.SIGNIFICANT) return 'SIGNIFICANT';
    if (score > 1.0) return 'MILD'; 
    return 'NORMAL';
}