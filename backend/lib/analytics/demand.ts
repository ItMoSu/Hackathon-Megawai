import { getCalendarFactors } from './calendar';

// --- Interfaces ---

// Standard input format for sales history
export interface SalesData {
  date: string | Date;
  value: number;
}

// The output structure requested in your template
export interface ExpectedDemand {
  productId: string;
  date: string;       // ISO Date
  baseline: number;   // Average of previous 30 days
  expected: number;   // The calculated prediction (E)
  actual: number;     // Actual sales (if available for comparison)
  factors: {
    dow: number;      // Day of Week factor
    payday: number;   // Payday factor
    special: number;  // Special day factor
  };
}

// --- Helper Functions ---

/**
 * Calculates the baseline (Average Daily Sales) from historical data.
 * Strategy: Uses the average of the last 30 days excluding the target date.
 */
function calculateBaseline(history: SalesData[]): number {
  if (!history || history.length === 0) return 0;
  
  const total = history.reduce((sum, item) => sum + item.value, 0);
  return total / history.length;
}

// --- Main Function ---

/**
 * Calculates the Expected Demand based on Formula 2.
 * Formula: E = baseline * DOW_factor * payday_factor * special_factor
 * * @param productId - The ID of the product
 * @param targetDate - The date we want to predict/analyze
 * @param salesHistory - Array of past sales data (required to calculate baseline)
 */
export function calculateExpectedDemand(
  productId: string, 
  targetDate: Date,
  salesHistory: SalesData[]
): ExpectedDemand {
  
  // 1. Prepare Date Strings for comparison
  const targetDateStr = targetDate.toISOString().split('T')[0];

  // 2. Find Actual Data (if exists for this specific date)
  const actualRecord = salesHistory.find(s => {
    const d = new Date(s.date);
    return d.toISOString().split('T')[0] === targetDateStr;
  });
  const actual = actualRecord ? actualRecord.value : 0;

  // 3. Calculate Baseline
  // We must strictly filter history to be BEFORE the target date 
  // to avoid data leakage (cheating) and typically use a 30-day window.
  const pastHistory = salesHistory
    .filter(s => new Date(s.date).getTime() < targetDate.getTime())
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()) // Sort Descending
    .slice(0, 30); // Take top 30 most recent days

  const baseline = calculateBaseline(pastHistory);

  // 4. Get Calendar Factors
  // We utilize the logic from calendar.ts to get the specific multipliers
  const calendarAnalysis = getCalendarFactors({ date: targetDate });
  const { factors } = calendarAnalysis;

  // 5. Calculate Expected Demand (Formula 2)
  // E = Baseline * Dow * Payday * Special
  // Note: We can also use calendarAnalysis.totalFactor, but multiplying explicitly ensures clarity
  const expected = baseline * factors.dayOfWeek * factors.payday * factors.special;

  return {
    productId,
    date: targetDate.toISOString(),
    baseline,
    expected,
    actual,
    factors: {
      dow: factors.dayOfWeek,  // Mapping 'dayOfWeek' from calendar.ts to 'dow'
      payday: factors.payday,
      special: factors.special
    }
  };
}