// lib/analytics/ema.ts

export interface TimeSeriesInput {
  date: Date | string;
  value: number;
}

export interface EMAResult {
  date: string;  // ISO Date string
  value: number; // Original value
  ema: number;   // Calculated EMA
}

/**
 * Calculates the Exponential Moving Average (EMA) for a data series.
 * Formula: EMA(t) = alpha * value(t) + (1 - alpha) * EMA(t-1)
 * Alpha: 2 / (window + 1)
 */
export function calculateEMA(
  data: TimeSeriesInput[], 
  window: number
): EMAResult[] {
  // 1. Input Validation
  if (!Array.isArray(data) || data.length === 0) return [];
  if (window <= 0) throw new Error('EMA window must be a positive number');

  // 2. Sort data chronologically to ensure time-series integrity
  const sortedData = [...data].sort((a, b) => {
    const dateA = new Date(a.date).getTime();
    const dateB = new Date(b.date).getTime();
    return dateA - dateB;
  });

  const result: EMAResult[] = [];
  
  // 3. Calculate Smoothing Factor (Alpha)
  const alpha = 2 / (window + 1);

  // 4. Initialize first EMA with the first data point (Simple Moving Average equivalent)
  let previousEMA = sortedData[0].value;

  result.push({
    date: new Date(sortedData[0].date).toISOString(),
    value: sortedData[0].value,
    ema: previousEMA
  });

  // 5. Iterative Calculation
  for (let i = 1; i < sortedData.length; i++) {
    const currentVal = sortedData[i].value;
    
    // Core Formula: Current EMA calculation
    const currentEMA = (alpha * currentVal) + ((1 - alpha) * previousEMA);
    
    result.push({
      date: new Date(sortedData[i].date).toISOString(),
      value: currentVal,
      ema: currentEMA
    });

    previousEMA = currentEMA;
  }

  return result;
}