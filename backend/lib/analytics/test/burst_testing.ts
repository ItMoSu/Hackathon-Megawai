import { calculateBurstScore, determineBurstLevel } from '../burst';

describe('Burst Detection Logic', () => {

test('Should return 0 score if actual < expected', () => {
    expect(calculateBurstScore(80, 100)).toBe(0);
});

    test('Should detect SIGNIFICANT burst (Score > 2.5)', () => {
        // Expected 100, Actual 360 -> Diff 260 -> Ratio 2.6
        const score = calculateBurstScore(360, 100);
        expect(score).toBe(2.6);
        expect(determineBurstLevel(score)).toBe('SIGNIFICANT');
    });

    test('Should detect CRITICAL burst (Score > 3.5)', () => {
        // Expected 100, Actual 500 -> Diff 400 -> Ratio 4.0
        const score = calculateBurstScore(500, 100);
        expect(score).toBe(4.0);
        expect(determineBurstLevel(score)).toBe('CRITICAL');
    });

    test('Should handle zero expected gracefully', () => {
        const score = calculateBurstScore(10, 0);
        expect(score).toBeGreaterThan(0); // Ensure no Infinity/NaN
    });
});