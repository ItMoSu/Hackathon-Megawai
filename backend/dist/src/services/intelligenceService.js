"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.intelligenceService = void 0;
const axios_1 = __importDefault(require("axios"));
const client_1 = require("@prisma/client");
const calendar_1 = require("../../lib/analytics/calendar");
const queries_1 = require("../../lib/database/queries");
const prisma = new client_1.PrismaClient();
// ✅ UPDATED: Use ML_API_URL from .env
const ML_API_URL = (process.env.ML_API_URL || 'http://localhost:8000').replace(/\/$/, '');
const MIN_TRAINING_DAYS = 30;
const FORECAST_DAYS = 7;
class IntelligenceService {
    normalizeSales(salesData) {
        return (salesData || [])
            .map((row) => ({
            date: new Date(row.date),
            quantity: Number(row.quantity ?? 0),
            productName: row.productName,
        }))
            .filter((row) => !Number.isNaN(row.date.getTime()))
            .sort((a, b) => a.date.getTime() - b.date.getTime());
    }
    // --- LOCAL CALCULATIONS (Kept for fallback) ---
    calculateMomentum(salesData) {
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
        if (ratio > 1.15)
            status = 'TRENDING_UP';
        else if (ratio < 0.85)
            status = 'DECLINING';
        else if (ratio > 1.05)
            status = 'GROWING';
        else if (ratio < 0.95)
            status = 'FALLING';
        return {
            combined: Number(ratio.toFixed(3)),
            status,
        };
    }
    detectBurst(salesData) {
        const data = this.normalizeSales(salesData);
        if (data.length < 5) {
            return { score: 0, severity: 'NORMAL', classification: 'NORMAL' };
        }
        const quantities = data.map((d) => d.quantity);
        const baseline = quantities.slice(0, -1);
        const latest = quantities[quantities.length - 1];
        const mean = baseline.reduce((sum, value) => sum + value, 0) / (baseline.length || 1);
        const variance = baseline.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (baseline.length || 1);
        const stdDev = Math.sqrt(variance) || 1;
        const zScore = (latest - mean) / stdDev;
        let severity = 'NORMAL';
        if (zScore > 3)
            severity = 'CRITICAL';
        else if (zScore > 2)
            severity = 'HIGH';
        else if (zScore > 1.5)
            severity = 'MEDIUM';
        let classification = 'NORMAL';
        if (severity !== 'NORMAL') {
            const d = new Date(data[data.length - 1].date);
            const day = d.getDay();
            if (day === 0 || day === 6)
                classification = 'SEASONAL';
            else
                classification = 'SPIKE';
        }
        return { score: Number(zScore.toFixed(2)), severity, classification };
    }
    getRuleBasedPredictions(salesData, days) {
        const data = this.normalizeSales(salesData);
        const baseline = data.reduce((sum, row) => sum + row.quantity, 0) / (data.length || 1);
        const predictions = [];
        const anchor = data.length ? new Date(data[data.length - 1].date) : new Date();
        for (let i = 1; i <= days; i += 1) {
            const targetDate = new Date(anchor);
            targetDate.setDate(anchor.getDate() + i);
            const factors = (0, calendar_1.getCalendarFactors)({ date: targetDate });
            const expected = baseline * factors.totalFactor;
            predictions.push({
                date: targetDate.toISOString().split('T')[0],
                predicted_quantity: Number(expected.toFixed(2)),
                confidence: 'LOW',
                lower_bound: Number((expected * 0.8).toFixed(2)),
                upper_bound: Number((expected * 1.2).toFixed(2)),
            });
        }
        return predictions;
    }
    // ✅ NEW: Call Python ML API for Forecast
    async callMLForecast(productName, days = 7) {
        try {
            const response = await axios_1.default.get(`${ML_API_URL}/api/ml/forecast`, {
                params: {
                    productId: productName,
                    days: days
                },
                timeout: 10000
            });
            if (response.data && response.data.success) {
                return response.data;
            }
            return null;
        }
        catch (error) {
            console.error('[IntelligenceService] ML Forecast error:', error.message);
            return null;
        }
    }
    // ✅ NEW: Call Python ML API for Weekly Report
    async callMLWeeklyReport(topN = 10) {
        try {
            const response = await axios_1.default.get(`${ML_API_URL}/api/ml/report/weekly`, {
                params: { top_n: topN, strategy: 'balanced' },
                timeout: 15000
            });
            if (response.data && response.data.success) {
                return response.data;
            }
            return null;
        }
        catch (error) {
            console.error('[IntelligenceService] ML Weekly Report error:', error.message);
            return null;
        }
    }
    // ✅ NEW: Check if ML service is available
    async isMLAvailable() {
        try {
            const response = await axios_1.default.get(`${ML_API_URL}/`, { timeout: 3000 });
            return response.status === 200;
        }
        catch {
            return false;
        }
    }
    // --- MAIN ANALYSIS FUNCTION ---
    async analyzeProduct(productId, productName, salesData) {
        const cleaned = this.normalizeSales(salesData);
        // 1. Calculate local realtime metrics (fast)
        const momentum = this.calculateMomentum(cleaned);
        const burst = this.detectBurst(cleaned);
        const realtimeMetrics = {
            momentum,
            burst: { score: burst.score, severity: burst.severity, level: burst.severity },
            classification: burst.classification,
            lastUpdated: new Date().toISOString(),
        };
        // 2. Check if data is sufficient
        if (!cleaned.length || cleaned.length < MIN_TRAINING_DAYS) {
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
                recommendations: [],
                confidence: { overall: 'LOW', dataQuality: 0.1, modelAgreement: 0 }
            };
        }
        // 3. ✅ UPDATED: Try to call Python ML API
        const mlAvailable = await this.isMLAvailable();
        if (!mlAvailable) {
            console.warn('[IntelligenceService] ML service not available, using fallback');
            const rulePred = this.getRuleBasedPredictions(cleaned, FORECAST_DAYS);
            return {
                productId, productName,
                realtime: realtimeMetrics,
                forecast: {
                    method: 'rule-based (ML offline)',
                    predictions: rulePred,
                    trend: 'STABLE',
                    totalForecast7d: rulePred.reduce((sum, p) => sum + p.predicted_quantity, 0),
                    summary: 'ML Service offline. Menggunakan prediksi dasar.'
                },
                recommendations: [],
                confidence: { overall: 'LOW', dataQuality: 0.5, modelAgreement: 0 }
            };
        }
        // 4. Call ML API
        const aiResult = await this.callMLForecast(productName || productId, FORECAST_DAYS);
        // 5. Process ML results or fallback
        if (!aiResult || !aiResult.success) {
            console.warn('[IntelligenceService] ML forecast failed, using fallback');
            const rulePred = this.getRuleBasedPredictions(cleaned, FORECAST_DAYS);
            return {
                productId, productName,
                realtime: realtimeMetrics,
                forecast: {
                    method: 'rule-based (ML failed)',
                    predictions: rulePred,
                    trend: 'STABLE',
                    totalForecast7d: rulePred.reduce((sum, p) => sum + p.predicted_quantity, 0),
                    summary: 'ML prediction gagal. Menggunakan prediksi dasar.'
                },
                recommendations: [],
                confidence: { overall: 'LOW', dataQuality: 0.5, modelAgreement: 0 }
            };
        }
        // 6. ✅ SUCCESS: Map ML results to frontend format
        const predictions = aiResult.predictions || [];
        const total7d = predictions.reduce((sum, p) => sum + (p.predicted_quantity || 0), 0);
        let trend = 'STABLE';
        if (predictions.length > 0) {
            const first = predictions[0].predicted_quantity;
            const last = predictions[predictions.length - 1].predicted_quantity;
            if (last > first * 1.05)
                trend = 'INCREASING';
            else if (last < first * 0.95)
                trend = 'DECREASING';
        }
        // 7. ✅ Extract recommendations from ML (if available)
        const recommendations = [];
        // Check if ML provided recommendations in weekly report format
        // For single product, we can generate basic recommendation based on momentum
        if (momentum.status === 'TRENDING_UP' || momentum.status === 'GROWING') {
            recommendations.push({
                type: 'STOCK_INCREASE',
                priority: 'HIGH',
                message: `${productName} menunjukkan tren naik. Pertimbangkan menambah stok.`,
                actionable: true,
                action: `Tingkatkan stok sebesar 20-30% untuk produk ${productName}`,
                details: [`Momentum: ${momentum.status}`, `Avg 7d forecast: ${(total7d / 7).toFixed(1)} unit/hari`]
            });
        }
        else if (momentum.status === 'DECLINING' || momentum.status === 'FALLING') {
            recommendations.push({
                type: 'STOCK_REDUCE',
                priority: 'MEDIUM',
                message: `${productName} menunjukkan tren turun. Pertimbangkan mengurangi stok.`,
                actionable: true,
                action: `Kurangi stok sebesar 10-20% untuk produk ${productName}`,
                details: [`Momentum: ${momentum.status}`, `Avg 7d forecast: ${(total7d / 7).toFixed(1)} unit/hari`]
            });
        }
        if (burst.severity === 'HIGH' || burst.severity === 'CRITICAL') {
            recommendations.push({
                type: 'BURST_ALERT',
                priority: 'URGENT',
                message: `Lonjakan signifikan terdeteksi pada ${productName}!`,
                actionable: true,
                action: 'Periksa stok dan siapkan tambahan untuk antisipasi permintaan tinggi',
                details: [`Burst Score: ${burst.score}`, `Classification: ${burst.classification}`]
            });
        }
        return {
            productId,
            productName,
            realtime: realtimeMetrics,
            forecast: {
                method: 'hybrid-ml',
                predictions: predictions.map((p) => ({
                    date: p.date,
                    predicted_quantity: p.predicted_quantity,
                    confidence: p.confidence || 'MEDIUM',
                    lower_bound: p.lower_bound,
                    upper_bound: p.upper_bound
                })),
                trend: trend,
                totalForecast7d: Number(total7d.toFixed(0)),
                summary: `Prediksi ML berdasarkan ${cleaned.length} hari data (MAE: ${aiResult.debug?.model_mae?.toFixed(2) || 'N/A'}).`
            },
            recommendations: recommendations,
            confidence: {
                overall: (aiResult.predictions?.[0]?.confidence || 'MEDIUM'),
                dataQuality: cleaned.length >= 60 ? 1.0 : cleaned.length / 60,
                modelAgreement: 0.85 // Based on 88.7% business-ready rate
            }
        };
    }
    // ✅ NEW: Get weekly report with ML
    async getWeeklyReport(userId, topN = 10) {
        try {
            // Check ML availability
            const mlAvailable = await this.isMLAvailable();
            if (!mlAvailable) {
                // Fallback to local trending calculation
                return await this.getTrendingProducts(userId);
            }
            // Call ML weekly report
            const mlReport = await this.callMLWeeklyReport(topN);
            if (!mlReport || !mlReport.success) {
                return await this.getTrendingProducts(userId);
            }
            // Enrich ML data with database product info
            const products = await prisma.products.findMany({
                where: { user_id: userId, is_active: true },
                select: { id: true, name: true, unit: true, price: true }
            });
            const productMap = new Map(products.map(p => [p.name, p]));
            // Map ML top performers to our format
            const topPerformers = mlReport.report.top_performers
                .map((perf) => {
                const product = productMap.get(perf.product_id);
                if (!product)
                    return null;
                return {
                    productId: product.id,
                    productName: product.name,
                    priorityScore: perf.priority_score,
                    momentumStatus: perf.momentum_status,
                    burstLevel: perf.burst_level,
                    avgDemand7d: perf.avg_demand_7d,
                    trend: perf.trend,
                    rank: perf.rank
                };
            })
                .filter((item) => item !== null);
            // Map products needing attention
            const needsAttention = mlReport.report.needs_attention
                .map((item) => {
                const product = productMap.get(item.product_id);
                if (!product)
                    return null;
                return {
                    productId: product.id,
                    productName: product.name,
                    reason: item.reason,
                    action: item.action,
                    momentumStatus: item.momentum_status,
                    burstLevel: item.burst_level
                };
            })
                .filter((item) => item !== null);
            return {
                summary: mlReport.report.summary,
                topPerformers,
                needsAttention,
                insights: mlReport.report.insights,
                generatedAt: mlReport.generated_at
            };
        }
        catch (error) {
            console.error('[IntelligenceService] Weekly report error:', error);
            // Fallback
            return await this.getTrendingProducts(userId);
        }
    }
    // --- TRENDING PRODUCTS (Fallback/Local) ---
    async getTrendingProducts(userId) {
        try {
            const products = await prisma.products.findMany({
                where: { user_id: userId, is_active: true },
                select: { id: true, name: true },
            });
            const trendingProducts = [];
            for (const product of products) {
                try {
                    const salesData = await (0, queries_1.getSalesData)(userId, product.id, 30);
                    if (salesData.length >= 5) {
                        const burst = this.detectBurst(salesData);
                        if (burst.severity === 'HIGH' || burst.severity === 'CRITICAL') {
                            trendingProducts.push({
                                productId: product.id,
                                productName: product.name || 'Unknown Product',
                                burstScore: burst.score,
                                severity: burst.severity,
                                lastUpdated: new Date().toISOString(),
                            });
                        }
                    }
                }
                catch (error) {
                    console.error(`Error analyzing product ${product.id}:`, error);
                }
            }
            trendingProducts.sort((a, b) => b.burstScore - a.burstScore);
            return {
                summary: { burst_alerts: trendingProducts.length },
                topPerformers: trendingProducts.slice(0, 10),
                needsAttention: trendingProducts,
                insights: trendingProducts.length > 0
                    ? [`${trendingProducts.length} produk menunjukkan lonjakan signifikan`]
                    : ['Tidak ada lonjakan signifikan terdeteksi'],
                generatedAt: new Date().toISOString()
            };
        }
        catch (error) {
            console.error('[IntelligenceService] Trending products error:', error);
            return {
                summary: { burst_alerts: 0 },
                topPerformers: [],
                needsAttention: [],
                insights: [],
                generatedAt: new Date().toISOString()
            };
        }
    }
}
exports.intelligenceService = new IntelligenceService();
