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
    predictions: { 
      date: string; 
      predicted_quantity: number; 
      confidence: string; 
      lower_bound?: number | null; 
      upper_bound?: number | null 
    }[];
    summary?: string;
    trend?: 'INCREASING' | 'STABLE' | 'DECREASING';
    totalForecast7d?: number;
  };
  recommendations: {
    type: string;
    priority: 'URGENT' | 'HIGH' | 'MEDIUM' | 'LOW'; // Update tipe priority
    message: string;
    actionable: boolean;
    details?: string[];
    action?: string;
    suggestions?: string[];
    reasoning?: string[];
    phases?: any[];
    savings?: any;
    peak_info?: any;
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

  // --- LOGIC MATEMATIKA LOKAL (NODE.JS) ---
  // Kita hitung ini dulu untuk dikirim ke Python sebagai "Konteks Realtime"

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
    if (ratio > 1.15) status = 'TRENDING_UP'; // Sesuaikan dengan Python
    else if (ratio < 0.85) status = 'DECLINING';
    else if (ratio > 1.05) status = 'GROWING'; // Tambahan status
    else if (ratio < 0.95) status = 'FALLING'; // Tambahan status

    return {
      combined: Number(ratio.toFixed(3)),
      status,
    };
  }

  private detectBurst(salesData: SalesPoint[]) {
    const data = this.normalizeSales(salesData);
    if (data.length < 5) {
      return { score: 0, severity: 'NORMAL', classification: 'NORMAL' };
    }

    const quantities = data.map((d) => d.quantity);
    const baseline = quantities.slice(0, -1);
    const latest = quantities[quantities.length - 1];
    
    // Hitung statistik sederhana
    const mean = baseline.reduce((sum, value) => sum + value, 0) / (baseline.length || 1);
    const variance = baseline.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (baseline.length || 1);
    const stdDev = Math.sqrt(variance) || 1;
    
    const zScore = (latest - mean) / stdDev;

    let severity = 'NORMAL';
    if (zScore > 3) severity = 'CRITICAL';
    else if (zScore > 2) severity = 'HIGH';
    else if (zScore > 1.5) severity = 'MEDIUM'; // Sesuaikan threshold

    // Klasifikasi sederhana (Python akan memperkaya ini)
    let classification = 'NORMAL';
    if (severity !== 'NORMAL') {
        const d = new Date(data[data.length-1].date);
        const day = d.getDay();
        if (day === 0 || day === 6) classification = 'SEASONAL'; // Weekend check sederhana
        else classification = 'SPIKE';
    }

    return { score: Number(zScore.toFixed(2)), severity, classification };
  }

  // --- RULE-BASED FALLBACK (JIKA PYTHON MATI/COLD START) ---
  private getRuleBasedPredictions(salesData: SalesPoint[], days: number) {
    const data = this.normalizeSales(salesData);
    const baseline = data.reduce((sum, row) => sum + row.quantity, 0) / (data.length || 1);
    const predictions = [];
    const anchor = data.length ? new Date(data[data.length - 1].date) : new Date();

    for (let i = 1; i <= days; i += 1) {
      const targetDate = new Date(anchor);
      targetDate.setDate(anchor.getDate() + i);
      const factors = getCalendarFactors({ date: targetDate });
      const expected = baseline * factors.totalFactor;
      predictions.push({
        date: targetDate.toISOString().split('T')[0],
        predicted_quantity: Number(expected.toFixed(2)),
        confidence: 'LOW', // Rule based selalu LOW/MEDIUM
        lower_bound: Number((expected * 0.8).toFixed(2)),
        upper_bound: Number((expected * 1.2).toFixed(2)),
      });
    }
    return predictions;
  }

  // --- INTERAKSI KE PYTHON (CORE) ---

  private toPayload(salesData: SalesPoint[]) {
    return salesData.map((row) => ({
      date: new Date(row.date).toISOString().split('T')[0],
      quantity: row.quantity,
    }));
  }

  async trainModel(productId: string, salesData: SalesPoint[]) {
    try {
        const payload = {
            product_id: productId, // Sesuaikan key dengan main.py Python (snake_case)
            sales_data: this.toPayload(salesData),
        };
        // Panggil endpoint TRAIN
        const res = await axios.post(`${PYTHON_SERVICE_URL}/api/ml/train`, payload);
        return res.data;
    } catch (e) {
        console.error("Training Error:", e);
        return { success: false };
    }
  }

  // Panggil endpoint HYBRID FORECAST (Ensemble)
  private async getHybridForecast(productId: string, realtimeMetrics: any, days: number) {
    try {
        const payload = {
            product_id: productId,
            realtime_data: realtimeMetrics, // Kirim hasil hitungan momentum/burst kita
            days: days
        };
        const res = await axios.post(`${PYTHON_SERVICE_URL}/api/ml/forecast-hybrid`, payload);
        return res.data;
    } catch (error) {
        console.error("Hybrid Forecast Error:", error);
        return null;
    }
  }

  // --- FUNGSI UTAMA ---
  async analyzeProduct(
    productId: string,
    productName: string | undefined,
    salesData: SalesPoint[],
  ): Promise<ProductIntelligence> {
    const cleaned = this.normalizeSales(salesData);
    
    // 1. Hitung Realtime Metrics di Node.js (Cepat)
    const momentum = this.calculateMomentum(cleaned);
    const burst = this.detectBurst(cleaned);
    
    // Siapkan object realtime
    const realtimeMetrics = {
        momentum,
        burst: { score: burst.score, severity: burst.severity, level: burst.severity }, // Python kadang pakai 'level'
        classification: burst.classification,
        lastUpdated: new Date().toISOString(),
    };

    // 2. Cek Data Cukup?
    if (!cleaned.length || cleaned.length < MIN_TRAINING_DAYS) {
        // Fallback ke Rule Based murni jika data sedikit
        const rulePred = this.getRuleBasedPredictions(cleaned, FORECAST_DAYS);
        return {
            productId, productName,
            realtime: realtimeMetrics,
            forecast: {
                method: 'rule-based (cold start)',
                predictions: rulePred,
                trend: 'STABLE',
                totalForecast7d: rulePred.reduce((sum, p) => sum + p.predicted_quantity, 0),
                summary: 'Data belum cukup untuk AI (butuh 30 hari). Menggunakan estimasi dasar.'
            },
            recommendations: [], // Bisa ditambah logic rekomendasi manual disini jika mau
            confidence: { overall: 'LOW', dataQuality: 0.1, modelAgreement: 0 }
        };
    }

    // 3. Panggil Python AI (Hybrid Forecast)
    let aiResult = await this.getHybridForecast(productId, realtimeMetrics, FORECAST_DAYS);

    // Jika gagal atau belum ada model, coba training dulu trigger-nya
    if (!aiResult || !aiResult.success) {
        console.log(`Model not found/ready for ${productId}, triggering training...`);
        await this.trainModel(productId, cleaned);
        // Coba forecast lagi setelah training
        aiResult = await this.getHybridForecast(productId, realtimeMetrics, FORECAST_DAYS);
    }

    // 4. Susun Hasil Akhir
    // Jika masih gagal (misal Python mati), fallback ke rule based
    if (!aiResult || !aiResult.success) {
        console.warn("Python AI failed, using fallback.");
        const rulePred = this.getRuleBasedPredictions(cleaned, FORECAST_DAYS);
        return {
            productId, productName,
            realtime: realtimeMetrics,
            forecast: {
                method: 'rule-based (fallback)',
                predictions: rulePred,
                trend: 'STABLE',
                totalForecast7d: rulePred.reduce((sum, p) => sum + p.predicted_quantity, 0),
                summary: 'AI Service tidak merespon. Menggunakan prediksi dasar.'
            },
            recommendations: [],
            confidence: { overall: 'LOW', dataQuality: 0.5, modelAgreement: 0 }
        };
    }

    // Jika Sukses: Mapping data dari Python ke format Frontend
    const predictions = aiResult.predictions || [];
    const total7d = predictions.reduce((sum: any, p: any) => sum + (p.predicted_quantity || 0), 0);
    
    // Tentukan trend dari data prediksi
    let trend: 'INCREASING' | 'STABLE' | 'DECREASING' = 'STABLE';
    if (predictions.length > 0) {
        const first = predictions[0].predicted_quantity;
        const last = predictions[predictions.length - 1].predicted_quantity;
        if (last > first * 1.05) trend = 'INCREASING';
        else if (last < first * 0.95) trend = 'DECREASING';
    }

    return {
        productId,
        productName,
        realtime: realtimeMetrics,
        forecast: {
            method: 'hybrid-ensemble',
            predictions: predictions,
            trend: aiResult.trend || trend, // Python mungkin kirim trend juga
            totalForecast7d: Number(total7d.toFixed(0)),
            summary: `Prediksi Hybrid (ML + Rules) berdasarkan ${cleaned.length} hari data.`
        },
        // INI BAGIAN PENTING: Ambil rekomendasi dari Python
        recommendations: aiResult.recommendation ? [aiResult.recommendation] : [], 
        confidence: {
            overall: aiResult.confidence || 'HIGH', // Python kirim string 'HIGH'/'MEDIUM'
            dataQuality: 1.0, // Asumsi data bagus karena sudah lolos cleaning
            modelAgreement: aiResult.agreement_score || 0.8
        }
    };
  }
}

export const intelligenceService = new IntelligenceService();