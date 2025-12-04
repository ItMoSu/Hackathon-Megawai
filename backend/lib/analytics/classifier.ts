import { BurstLevel } from './burst';

export type BurstType = 
| 'NORMAL' 
| 'PROMO_DRIVEN' 
| 'SEASONAL' 
| 'VIRAL' 
| 'NOISE' 
| 'MONITORING';

interface ClassificationContext {
    score: number;
    level: BurstLevel;
    hasPromo: boolean;
    isHolidayOrSeason: boolean; 
    streakDays: number; 
}

export function classifyBurst(ctx: ClassificationContext): BurstType {
    if (ctx.level === 'NORMAL') {
        return 'NORMAL';
    }
    if (ctx.score < 0.5) {
        return 'NOISE';
    }
    // 3. Priority: Promo -> Seasonal -> Viral
    if (ctx.hasPromo) {
        return 'PROMO_DRIVEN';
    }
    if (ctx.isHolidayOrSeason) {
        return 'SEASONAL';
    }
    if (ctx.level === 'CRITICAL' || ctx.level === 'SIGNIFICANT') {
        return 'VIRAL';
    }
    return 'MONITORING';
}