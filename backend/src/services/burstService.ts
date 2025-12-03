import { PrismaClient } from '@prisma/client';
import { calculateBurstScore, determineBurstLevel } from '../../lib/analytics/burst';
import { classifyBurst } from '../../lib/analytics/classifier';

const prisma = new PrismaClient();

export const generateBurstAnalytics = async (userId: string, date: Date) => {
// 1. Fetch Daily Analytics untuk tanggal tersebut
const analyticsData = await prisma.daily_analytics.findMany({
where: {
    user_id: userId,
    metric_date: date,
},
include: {
    products: {
        include: {
        }
    }
}
});

const updates = [];

for (const record of analyticsData) {
// Convert Decimal/Numeric Prisma ke Number JS
const actual = Number(record.actual_quantity);
const expected = Number(record.expected_quantity || record.ema_7 || 0); 
// 2. Calculate Score & Level
const score = calculateBurstScore(actual, expected);
const level = determineBurstLevel(score);
// 3. Cek Context untuk Classifier
const salesRecord = await prisma.sales.findFirst({
    where: {
        product_id: record.product_id,
        sale_date: date,
        has_promo: true
    }
});

const isSeasonal = Number(record.special_factor || 0) > 1.1 || Number(record.payday_factor || 0) > 1.1;

// 4. Classify
const type = classifyBurst({
    score,
    level,
    hasPromo: !!salesRecord,
    isHolidayOrSeason: isSeasonal,
    streakDays: 1
});

// 5. Siapkan update operation
const aiInsight = {
    reason: type === 'VIRAL' ? 'Sudden spike without promo detected' : `Driven by ${type}`,
    score_breakdown: { actual, expected, diff: actual - expected }
};

updates.push(
    prisma.daily_analytics.update({
        where: { id: record.id },
        data: {
            burst_score: score,
            burst_level: level,
            burst_type: type,
            ai_insight: aiInsight as any 
        }
    })
);
}
// Eksekusi Transaction
await prisma.$transaction(updates);

return { processed: updates.length };
};