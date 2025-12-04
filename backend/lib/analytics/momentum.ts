// lib/analytics/momentum.ts

import { calculateEMA, type TimeSeriesInput, type EMAResult } from './ema';

// --- Types & Interfaces ---

// Input interface matching the user's SalesData requirement
export interface SalesData {
  date: string | Date;
  value: number;
}

// Defined Status Types based on the Ultimate Guide
export type MomentumStatus = 
  | 'TRENDING_UP'   // Score > 0.15
  | 'GROWING'       // Score > 0.05
  | 'STABLE'        // Score between -0.05 and 0.05
  | 'DECLINING'     // Score >= -0.15
  | 'FALLING';      // Score < -0.15

// The requested interface for the result
export interface MomentumResult {
  productId: string;
  momentum7: number;
  momentum14: number;
  momentum30: number;
  combined: number;
  status: MomentumStatus;
}

// --- Helper Functions ---

/**
 * Determines the status label based on the combined weighted score.
 * Thresholds are derived from the project guidelines.
 */
function classifyStatus(score: number): MomentumStatus {
  if (score > 0.15) return 'TRENDING_UP';
  if (score > 0.05) return 'GROWING';
  if (score >= -0.05) return 'STABLE';
  if (score >= -0.15) return 'DECLINING';
  return 'FALLING';
}

/**
 * Calculates momentum for a specific window k.
 * Formula: M(k) = (EMA(t) - EMA(t-k)) / EMA(t-k)
 */
function getSingleWindowMomentum(
  emaSeries: EMAResult[], 
  window: number
): number {
  if (emaSeries.length < 2) return 0;

  // Get current EMA (t)
  const currentEMA = emaSeries[emaSeries.length - 1].ema;

  // Get past EMA (t-k). 
  // We go back 'window' steps. If data is too short, fall back to index 0.
  const lagIndex = Math.max(0, emaSeries.length - 1 - window);
  const pastEMA = emaSeries[lagIndex].ema;

  // Prevent division by zero with epsilon
  const baseline = Math.max(Math.abs(pastEMA), 1e-6);

  return (currentEMA - pastEMA) / baseline;
}

// --- Main Exported Function ---

/**
 * Calculates the product momentum using the weighted Multi-Window EMA formula.
 * Formula: M = 0.5*M(7) + 0.3*M(14) + 0.2*M(30)
 */
export function calculateMomentum(
  productId: string, 
  salesData: SalesData[]
): MomentumResult {
  
  // 1. Calculate EMAs for all required windows (7, 14, 30)
  // Note: calculateEMA handles sorting internally
  const ema7 = calculateEMA(salesData, 7);
  const ema14 = calculateEMA(salesData, 14);
  const ema30 = calculateEMA(salesData, 30);

  // 2. Calculate individual momentums: M(k) = (EMA(t) - EMA(t-k)) / EMA(t-k)
  const m7 = getSingleWindowMomentum(ema7, 7);
  const m14 = getSingleWindowMomentum(ema14, 14);
  const m30 = getSingleWindowMomentum(ema30, 30);

  // 3. Calculate Combined Weighted Score
  // Weights: 50% Short-term, 30% Mid-term, 20% Long-term
  const combinedScore = (0.5 * m7) + (0.3 * m14) + (0.2 * m30);

  // 4. Determine Status
  const status = classifyStatus(combinedScore);

  return {
    productId,
    momentum7: m7,
    momentum14: m14,
    momentum30: m30,
    combined: combinedScore,
    status
  };
}