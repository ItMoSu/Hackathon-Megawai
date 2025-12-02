import axios from 'axios';
import { getCalendarFactors } from '../../lib/analytics/calendar';

export type SalesPoint = { date: Date | string; quantity: number; productName?: string };

export type ProductIntelligence = {
  productId: string;
  productName?: string;
  realtime: {
    momentum: { combined: number; status: string };
    burst: { score: number; severity: string };
    classification: string;
    lastUpdated: string;
  };
  forecast: {
    method: string;
    predictions: { date: string; predicted_quantity: number; confidence: string }[];
    summary?: string;
    trend?: 'INCREASING' | 'STABLE' | 'DECREASING';
    totalForecast7d?: number;
  };
  recommendations: {
    type: string;
    priority: 'HIGH' | 'MEDIUM' | 'LOW';
    message: string;
    actionable: boolean;
  }[];
  confidence: {
    overall: 'HIGH' | 'MEDIUM' | 'LOW';
    dataQuality: number;
    modelAgreement: number;
  };
};

const PYTHON_SERVICE_URL = (process.env.PYTHON_SERVICE_URL || 'http://localhost:8000').replace(/\/$/, '');
const MIN_TRAINING_DAYS = 30;
const FORECAST_DAYS = 7;

class IntelligenceService {
  private normalizeSales(salesData: SalesPoint[]): SalesPoint[] {
    return (salesData || [])
      .map((row) => ({
        date: new Date(row.date),
        quantity: Number(row.quantity ?? 0),
        productName: row.productName,
      }))
      .filter((row) => !Number.isNaN(row.date.getTime()))
      .sort((a, b) => a.date.getTime() - b.date.getTime());
  }

  private calculateMomentum(salesData: SalesPoint[]) {
    const data = this.normalizeSales(salesData);
    if (!data.length) {
      return { combined: 0, status: 'STABLE' };
    }

    const qty = data.map((d) => d.quantity);
    const recent = qty.slice(-7);
    const previous = qty.slice(-14, -7);
    const avgRecent = recent.reduce((a, b) => a + b, 0) / (recent.length || 1);
    const avgPrevious = previous.reduce((a, b) => a + b, 0) / (previous.length || 1);

    const ratio = avgPrevious ? avgRecent / avgPrevious : 1;
    let status = 'STABLE';
    if (ratio > 1.15) status = 'INCREASING';
    else if (ratio < 0.85) status = 'DECLINING';

    return {
      combined: Number(ratio.toFixed(3)),
      status,
    };
  }

  private detectBurst(salesData: SalesPoint[]) {
    const data = this.normalizeSales(salesData);
    if (data.length < 5) {
      return { score: 0, severity: 'LOW', classification: 'NORMAL' };
    }

    const quantities = data.map((d) => d.quantity);
    const baseline = quantities.slice(0, -1);
    const latest = quantities[quantities.length - 1];
    const mean =
      baseline.reduce((sum, value) => sum + value, 0) / (baseline.length || 1);
    const variance =
      baseline.reduce((sum, value) => sum + (value - mean) ** 2, 0) /
      (baseline.length || 1);
    const stdDev = Math.sqrt(variance) || 1;
    const zScore = (latest - mean) / stdDev;

    let severity = 'LOW';
    if (zScore > 3) severity = 'CRITICAL';
    else if (zScore > 2) severity = 'HIGH';
    else if (zScore > 1) severity = 'MEDIUM';

    const classification =
      severity === 'CRITICAL' || severity === 'HIGH'
        ? 'SPIKE'
        : severity === 'MEDIUM'
        ? 'SURGE'
        : 'NORMAL';

    return { score: Number(zScore.toFixed(2)), severity, classification };
  }

  private getRuleBasedPredictions(
    salesData: SalesPoint[],
    days: number,
  ): { date: string; predicted_quantity: number; confidence: string }[] {
    const data = this.normalizeSales(salesData);
    const baseline =
      data.reduce((sum, row) => sum + row.quantity, 0) / (data.length || 1);

    const predictions: {
      date: string;
      predicted_quantity: number;
      confidence: string;
    }[] = [];

    const anchor = data.length ? new Date(data[data.length - 1].date) : new Date();

    for (let i = 1; i <= days; i += 1) {
      const targetDate = new Date(anchor);
      targetDate.setDate(anchor.getDate() + i);
      const factors = getCalendarFactors({ date: targetDate });
      const expected = baseline * factors.totalFactor;
      predictions.push({
        date: targetDate.toISOString().split('T')[0],
        predicted_quantity: Number(expected.toFixed(2)),
        confidence: 'MEDIUM',
      });
    }

    return predictions;
  }

  private determineTrend(predictions: { predicted_quantity: number }[]) {
    if (!predictions?.length) return 'STABLE';
    const first = predictions[0]?.predicted_quantity ?? 0;
    const last = predictions[predictions.length - 1]?.predicted_quantity ?? 0;
    const ratio = first ? last / first : 1;
    if (ratio > 1.1) return 'INCREASING';
    if (ratio < 0.9) return 'DECREASING';
    return 'STABLE';
  }

  private calculateAgreement(
    rulePred: { date: string; predicted_quantity: number }[],
    mlPred: { date: string; predicted_quantity: number }[],
  ): number {
    if (!rulePred?.length || !mlPred?.length) return 0.0;
    const mlMap = new Map(mlPred.map((p) => [p.date, p.predicted_quantity]));
    const scores: number[] = [];
    rulePred.forEach((r) => {
      const mlVal = mlMap.get(r.date);
      if (mlVal === undefined) return;
      const diff = Math.abs((r.predicted_quantity || 0) - mlVal);
      const denom = Math.max(mlVal, 1);
      scores.push(1 - Math.min(diff / denom, 1));
    });
    if (!scores.length) return 0.0;
    return Number((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(3));
  }

  private buildConfidence(
    dataQualityDays: number,
    agreement: number,
    ensembleConfidence?: string,
  ): { overall: 'HIGH' | 'MEDIUM' | 'LOW'; dataQuality: number; modelAgreement: number } {
    const dataQualityScore = Math.min(dataQualityDays / 90, 1);
    const modelAgreement = Math.max(agreement, 0);
    const base =
      ensembleConfidence === 'HIGH'
        ? 0.8
        : ensembleConfidence === 'MEDIUM'
        ? 0.6
        : 0.4;
    const blended = (dataQualityScore * 0.4 + modelAgreement * 0.4 + base * 0.2);
    const overall: 'HIGH' | 'MEDIUM' | 'LOW' =
      blended >= 0.75 ? 'HIGH' : blended >= 0.55 ? 'MEDIUM' : 'LOW';
    return {
      overall,
      dataQuality: Number(dataQualityScore.toFixed(3)),
      modelAgreement: Number(modelAgreement.toFixed(3)),
    };
  }

  private toPayload(salesData: SalesPoint[]) {
    return salesData.map((row) => ({
      date: new Date(row.date).toISOString().split('T')[0],
      quantity: row.quantity,
    }));
  }

  async trainModel(productId: string, salesData: SalesPoint[]) {
    const payload = {
      productId,
      salesData: this.toPayload(salesData),
    };
    const res = await axios.post(`${PYTHON_SERVICE_URL}/api/ml/train`, payload);
    return res.data;
  }

  private async getMLForecast(productId: string, days: number) {
    const res = await axios.get(`${PYTHON_SERVICE_URL}/api/ml/forecast`, {
      params: { productId, days },
    });
    return res.data;
  }

  private async getHybridForecast(
    productId: string,
    rulePredictions: { date: string; predicted_quantity: number }[],
    dataQualityDays: number,
    agreementScore: number,
    burst: { score: number; severity: string; classification?: string },
    momentum: { combined: number; status: string },
    days: number,
  ) {
    const payload = {
      productId,
      rulePredictions,
      dataQualityDays,
      agreementScore,
      burst,
      momentum,
      days,
    };
    const res = await axios.post(
      `${PYTHON_SERVICE_URL}/api/ml/forecast-hybrid`,
      payload,
    );
    return res.data;
  }

  private fallbackToRuleBased(
    productId: string,
    productName: string | undefined,
    salesData: SalesPoint[],
  ): ProductIntelligence {
    const momentum = this.calculateMomentum(salesData);
    const burst = this.detectBurst(salesData);
    const rulePred = this.getRuleBasedPredictions(salesData, FORECAST_DAYS);
    const trend = this.determineTrend(rulePred);
    return {
      productId,
      productName,
      realtime: {
        momentum,
        burst: { score: burst.score, severity: burst.severity },
        classification: burst.classification,
        lastUpdated: new Date().toISOString(),
      },
      forecast: {
        method: 'rule-based',
        predictions: rulePred,
        trend,
        totalForecast7d: Number(
          rulePred.reduce((sum, p) => sum + (p.predicted_quantity || 0), 0).toFixed(2),
        ),
        summary: 'Fallback to rule-based forecast (ML unavailable)',
      },
      recommendations: [],
      confidence: this.buildConfidence(salesData.length, 0, 'LOW'),
    };
  }

  async analyzeProduct(
    productId: string,
    productName: string | undefined,
    salesData: SalesPoint[],
  ): Promise<ProductIntelligence> {
    const cleaned = this.normalizeSales(salesData);
    const momentum = this.calculateMomentum(cleaned);
    const burst = this.detectBurst(cleaned);
    const rulePred = this.getRuleBasedPredictions(cleaned, FORECAST_DAYS);
    const agreementScore = 0; // will update once ML is present

    if (!cleaned.length || cleaned.length < MIN_TRAINING_DAYS) {
      return this.fallbackToRuleBased(productId, productName, cleaned);
    }

    try {
      let mlForecast;
      try {
        mlForecast = await this.getMLForecast(productId, FORECAST_DAYS);
      } catch (err) {
        await this.trainModel(productId, cleaned);
        mlForecast = await this.getMLForecast(productId, FORECAST_DAYS);
      }

      if (!mlForecast?.predictions?.length) {
        await this.trainModel(productId, cleaned);
        mlForecast = await this.getMLForecast(productId, FORECAST_DAYS);
      }

      const mlPredictions =
        mlForecast?.predictions?.map((p: any) => ({
          date: p.date,
          predicted_quantity: p.predicted_quantity,
        })) || [];

      const agreement = this.calculateAgreement(rulePred, mlPredictions);
      const hybrid = await this.getHybridForecast(
        productId,
        rulePred,
        mlForecast?.data_quality_days || cleaned.length,
        mlForecast?.ensemble?.agreement_score || agreementScore || agreement,
        burst,
        momentum,
        FORECAST_DAYS,
      );

      const ensemblePredictions =
        hybrid?.ensemble?.predictions?.map((p: any) => ({
          date: p.date,
          predicted_quantity: p.predicted_quantity,
          lower_bound: p.lower_bound ?? null,
          upper_bound: p.upper_bound ?? null,
          confidence: p.confidence || 'MEDIUM',
        })) || rulePred;

      const trend = hybrid?.ensemble?.trend || this.determineTrend(ensemblePredictions);
      const totalForecast7d = Number(
        ensemblePredictions.reduce(
          (sum: number, p: any) => sum + (p.predicted_quantity || 0),
          0,
        ).toFixed(2),
      );

      const confidence = this.buildConfidence(
        mlForecast?.data_quality_days || cleaned.length,
        hybrid?.ensemble?.agreement_score ?? agreement,
        hybrid?.ensemble?.confidence,
      );

      return {
        productId,
        productName,
        realtime: {
          momentum,
          burst: { score: burst.score, severity: burst.severity },
          classification: burst.classification,
          lastUpdated: new Date().toISOString(),
        },
        forecast: {
          method: 'hybrid',
          predictions: ensemblePredictions,
          trend,
          totalForecast7d,
          summary: 'Hybrid forecast combining rule-based and ML predictions',
        },
        recommendations: hybrid?.recommendations || [],
        confidence,
      };
    } catch (error) {
      console.error('analyzeProduct fallback triggered:', error);
      return this.fallbackToRuleBased(productId, productName, cleaned);
    }
  }
}

export const intelligenceService = new IntelligenceService();
