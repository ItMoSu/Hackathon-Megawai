export type RealtimeMomentum = {
  combined: number;
  status: string;
};

export type RealtimeBurst = {
  score: number;
  severity: string;
  classification?: string;
};

export type RealtimeMetrics = {
  momentum: RealtimeMomentum;
  burst: RealtimeBurst;
  classification?: string;
  lastUpdated: string;
};

export type ForecastPrediction = {
  date: string;
  predicted_quantity: number;
  confidence?: 'HIGH' | 'MEDIUM' | 'LOW' | string;
  lower_bound?: number | null;
  upper_bound?: number | null;
  rule_based?: number;
  ml_p50?: number;
};

export type ForecastData = {
  method: string;
  predictions: ForecastPrediction[];
  trend?: 'INCREASING' | 'STABLE' | 'DECREASING';
  totalForecast7d?: number;
  summary?: string;
};

export type RecommendationPriority = 'URGENT' | 'HIGH' | 'MEDIUM' | 'LOW';

export type Recommendation = {
  type: string;
  priority: RecommendationPriority;
  message: string;
  actionable: boolean;
  details?: string[];
  actionText?: string;
  icon?: string;
  action?: string;
  suggestions?: string[];
  reasoning?: string[];
  phases?: {
    phase_name: string;
    icon?: string;
    stock_needed: number;
    daily_avg: number;
    advice: string;
    warning?: string;
    days?: number[];
  }[];
  savings?: {
    amount: number;
    total_smart: number;
    total_naive: number;
    percentage: number;
  };
  peak_info?: {
    date: string;
    day_name?: string;
    quantity?: number;
    index?: number;
  };
};

export type ProductIntelligence = {
  productId: string;
  productName?: string;
  realtime: RealtimeMetrics;
  forecast: ForecastData;
  recommendations: Recommendation[];
  confidence: {
    overall: 'HIGH' | 'MEDIUM' | 'LOW';
    dataQuality: number;
    modelAgreement: number;
  };
};
