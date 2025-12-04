export interface Burst {
  score: number;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  classification: string;
}

export interface Momentum {
  combined: number;
  status: 'INCREASING' | 'DECLINING' | 'STABLE';
}

export interface ForecastPrediction {
  date: string;
  predicted_quantity: number;
  confidence?: string;
}

export interface Forecast {
  predictions: ForecastPrediction[];
  trend?: 'INCREASING' | 'STABLE' | 'DECREASING';
  totalForecast7d?: number;
}

export interface Recommendation {
  type: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  message: string;
  actionable: boolean;
}

export function generateRecommendations(
  burst: Burst,
  momentum: Momentum,
  forecast: Forecast,
  productName?: string
): Recommendation[] {
  const recommendations: Recommendation[] = [];
  const totalForecast = forecast.totalForecast7d || 0;
  const avgDaily = totalForecast / 7;
  const trend = forecast.trend || 'STABLE';

  // Rule 1: Viral Opportunity (Burst Critical + Momentum Increasing)
  if (burst.severity === 'CRITICAL' && momentum.status === 'INCREASING') {
    recommendations.push({
      type: 'SCALE_UP',
      priority: 'HIGH',
      message: `Produk ${productName || 'ini'} sedang viral! Siapkan stok tambahan ${Math.round(totalForecast * 1.3)} unit untuk 7 hari ke depan dengan buffer 30%.`,
      actionable: true,
    });

    recommendations.push({
      type: 'MARKETING',
      priority: 'HIGH',
      message: 'Manfaatkan momentum viral dengan kampanye media sosial. Posting story harian dan kolaborasi dengan influencer lokal.',
      actionable: true,
    });

    recommendations.push({
      type: 'SUPPLY_CHAIN',
      priority: 'MEDIUM',
      message: `Hubungi supplier untuk meningkatkan produksi. Target produksi harian: ${Math.round(avgDaily * 1.5)} unit mulai besok.`,
      actionable: true,
    });
  }

  // Rule 2: High Burst Alert (Burst High + Any Momentum)
  else if (burst.severity === 'HIGH') {
    recommendations.push({
      type: 'STOCK_PREPARATION',
      priority: 'HIGH',
      message: `Deteksi lonjakan penjualan (${burst.score.toFixed(1)}x normal). Siapkan stok ${Math.round(totalForecast * 1.2)} unit untuk mencegah kehabisan.`,
      actionable: true,
    });

    recommendations.push({
      type: 'MONITORING',
      priority: 'MEDIUM',
      message: 'Pantau penjualan real-time setiap jam. Siapkan alert otomatis jika stok tersisa kurang dari 20%.',
      actionable: true,
    });

    if (momentum.status === 'INCREASING') {
      recommendations.push({
        type: 'PRICING',
        priority: 'MEDIUM',
        message: 'Pertimbangkan kenaikan harga 5-10% karena demand tinggi, tapi pastikan tetap kompetitif.',
        actionable: true,
      });
    }
  }

  // Rule 3: Declining Momentum Intervention
  else if (momentum.status === 'DECLINING') {
    recommendations.push({
      type: 'PROMOTION',
      priority: 'HIGH',
      message: 'Penjualan menurun. Luncurkan promo "Beli 2 Gratis 1" selama 3 hari untuk membalikkan tren.',
      actionable: true,
    });

    recommendations.push({
      type: 'BUNDLING',
      priority: 'MEDIUM',
      message: `Buat paket bundling dengan produk pelengkap. Misalnya: ${productName || 'Produk'} + minuman dengan diskon 15%.`,
      actionable: true,
    });

    recommendations.push({
      type: 'CUSTOMER_FEEDBACK',
      priority: 'MEDIUM',
      message: 'Kirim survey singkat ke pelanggan untuk mengetahui alasan penurunan. Tawarkan voucher diskon sebagai insentif.',
      actionable: true,
    });
  }

  // Rule 4: Stable Optimization
  else if (momentum.status === 'STABLE' && burst.severity === 'LOW') {
    recommendations.push({
      type: 'INVENTORY_OPTIMIZATION',
      priority: 'MEDIUM',
      message: `Demand stabil. Maintain stok level ${Math.round(avgDaily * 3)} unit (buffer 3 hari) untuk efisiensi biaya.`,
      actionable: true,
    });

    recommendations.push({
      type: 'PROCESS_IMPROVEMENT',
      priority: 'LOW',
      message: 'Optimalkan proses produksi berdasarkan pola demand stabil. Identifikasi bottleneck dan tingkatkan efisiensi.',
      actionable: true,
    });

    recommendations.push({
      type: 'LOYALTY_PROGRAM',
      priority: 'LOW',
      message: 'Perkenalkan program loyalitas untuk pelanggan tetap. Berikan poin untuk setiap pembelian yang bisa ditukar diskon.',
      actionable: true,
    });
  }

  // Rule 5: Medium Burst Response
  else if (burst.severity === 'MEDIUM') {
    recommendations.push({
      type: 'STOCK_ADJUSTMENT',
      priority: 'MEDIUM',
      message: `Lonjakan sedang terdeteksi. Tambah stok ${Math.round(totalForecast * 1.1)} unit dengan buffer 10%.`,
      actionable: true,
    });

    recommendations.push({
      type: 'TREND_ANALYSIS',
      priority: 'LOW',
      message: 'Analisis faktor penyebab lonjakan (hari libur, event lokal, dll) untuk memprediksi pola serupa di masa depan.',
      actionable: true,
    });

    if (trend === 'INCREASING') {
      recommendations.push({
        type: 'EXPANSION',
        priority: 'MEDIUM',
        message: 'Pertimbangkan ekspansi ke outlet baru atau platform online jika tren positif berlanjut.',
        actionable: true,
      });
    }
  }

  // Rule 6: Default Recommendations (Always ensure at least 2-3 recommendations)
  if (recommendations.length < 3) {
    // Add forecast-based recommendation
    recommendations.push({
      type: 'FORECAST_PREPARATION',
      priority: 'MEDIUM',
      message: `Berdasarkan prediksi, siapkan total ${Math.round(totalForecast)} unit untuk 7 hari ke depan. Rata-rata ${Math.round(avgDaily)} unit per hari.`,
      actionable: true,
    });

    // Add data quality improvement
    recommendations.push({
      type: 'DATA_QUALITY',
      priority: 'LOW',
      message: 'Pastikan data penjualan selalu update real-time untuk meningkatkan akurasi prediksi dan rekomendasi.',
      actionable: true,
    });

    // Add competitive analysis
    if (recommendations.length < 3) {
      recommendations.push({
        type: 'COMPETITIVE_ANALYSIS',
        priority: 'LOW',
        message: 'Monitor harga dan promosi kompetitor mingguan. Sesuaikan strategi pricing jika diperlukan.',
        actionable: true,
      });
    }
  }

  // Sort by priority (HIGH first, then MEDIUM, then LOW)
  const priorityOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 };
  recommendations.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  // Ensure maximum 5 recommendations to avoid overwhelming
  return recommendations.slice(0, 5);
}
