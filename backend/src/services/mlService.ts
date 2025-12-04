import axios from 'axios';

const ML_API_BASE = process.env.ML_API_URL || 'http://localhost:8000';

export interface MLForecastResponse {
  success: boolean;
  productId: string;
  predictions: Array<{
    date: string;
    predicted_quantity: number;
    lower_bound: number;
    upper_bound: number;
    confidence: 'HIGH' | 'MEDIUM' | 'LOW';
    day_of_week: number;
    is_weekend: boolean;
  }>;
  data_quality_days: number;
  debug: {
    first_pred: number;
    last_pred: number;
    avg_pred: number;
    model_mae: number;
    model_std_error: number;
  };
}

export interface MLWeeklyReportResponse {
  success: boolean;
  report: {
    period: {
      start_date: string;
      end_date: string;
      days: number;
    };
    ranking_strategy: string;
    summary: {
      total_products: number;
      avg_momentum: number;
      products_trending_up: number;
      products_declining: number;
      burst_alerts: number;
    };
    top_performers: Array<{
      rank: number;
      product_id: string;
      priority_score: number;
      momentum_status: string;
      burst_level: string;
      avg_demand_7d: number;
      trend: string;
    }>;
    needs_attention: Array<{
      rank: number;
      product_id: string;
      reason: string;
      action: string;
      momentum_status: string;
      burst_level: string;
    }>;
    insights: string[];
  };
  generated_at: string;
}

export class MLService {
  
  /**
   * Get forecast predictions from ML model
   */
  static async getForecast(productName: string, days: number = 7): Promise<MLForecastResponse> {
    try {
      const response = await axios.get(`${ML_API_BASE}/api/ml/forecast`, {
        params: { productId: productName, days },
        timeout: 10000
      });
      return response.data;
    } catch (error) {
      console.error('[MLService] Forecast error:', error);
      throw new Error('Failed to get ML forecast');
    }
  }
  
  /**
   * Get weekly analytics report with rankings
   */
  static async getWeeklyReport(topN: number = 10, strategy: string = 'balanced'): Promise<MLWeeklyReportResponse> {
    try {
      const response = await axios.get(`${ML_API_BASE}/api/ml/report/weekly`, {
        params: { top_n: topN, strategy },
        timeout: 15000
      });
      return response.data;
    } catch (error) {
      console.error('[MLService] Weekly report error:', error);
      throw new Error('Failed to get ML weekly report');
    }
  }
  
  /**
   * Get inventory optimization recommendations
   */
  static async getInventoryOptimization(
    productName: string,
    currentStock: number,
    leadTimeDays: number = 3,
    serviceLevel: 'low' | 'medium' | 'high' | 'critical' = 'medium'
  ) {
    try {
      const response = await axios.post(`${ML_API_BASE}/api/ml/inventory/optimize`, {
        product_id: productName,
        current_stock: currentStock,
        lead_time_days: leadTimeDays,
        service_level: serviceLevel
      }, {
        timeout: 10000
      });
      return response.data;
    } catch (error) {
      console.error('[MLService] Inventory optimization error:', error);
      throw new Error('Failed to get inventory optimization');
    }
  }
  
  /**
   * Get profit forecast
   */
  static async getProfitForecast(
    productName: string,
    costPerUnit: number,
    pricePerUnit: number,
    fixedCostsWeekly: number = 0,
    days: number = 7
  ) {
    try {
      const response = await axios.post(`${ML_API_BASE}/api/ml/profit/forecast`, {
        product_id: productName,
        cost_per_unit: costPerUnit,
        price_per_unit: pricePerUnit,
        fixed_costs_weekly: fixedCostsWeekly,
        days
      }, {
        timeout: 10000
      });
      return response.data;
    } catch (error) {
      console.error('[MLService] Profit forecast error:', error);
      throw new Error('Failed to get profit forecast');
    }
  }
  
  /**
   * Get list of all trained models
   */
  static async getAllModels() {
    try {
      const response = await axios.get(`${ML_API_BASE}/api/ml/models`, {
        timeout: 5000
      });
      return response.data;
    } catch (error) {
      console.error('[MLService] Get models error:', error);
      throw new Error('Failed to get ML models list');
    }
  }
  
  /**
   * Health check for ML service
   */
  static async healthCheck(): Promise<boolean> {
    try {
      const response = await axios.get(`${ML_API_BASE}/`, { timeout: 3000 });
      return response.status === 200;
    } catch (error) {
      return false;
    }
  }
}