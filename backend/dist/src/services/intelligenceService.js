"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.intelligenceService = void 0;
const axios_1 = __importDefault(require("axios"));
const calendar_1 = require("../../lib/analytics/calendar");
const queries_1 = require("../../lib/database/queries");
const schema_1 = require("../../lib/database/schema");
const ML_API_URL = (process.env.ML_API_URL || 'http://localhost:8000').replace(/\/$/, '');
const MIN_TRAINING_DAYS = 5; // ✅ LOWERED from 30 to 5 for faster testing
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
    calculateMomentum(salesData) {
        const data = this.normalizeSales(salesData);
        if (!data.length)
            return { combined: 0, status: 'STABLE' };
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
        return { combined: Number(ratio.toFixed(3)), status };
    }
    detectBurst(salesData) {
        const data = this.normalizeSales(salesData);
        if (data.length < 5)
            return { score: 0, severity: 'NORMAL', classification: 'NORMAL' };
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
        const predictions = [];
        const anchor = data.length ? new Date(data[data.length - 1].date) : new Date();
        // Calculate baseline and trend
        const quantities = data.map(d => d.quantity);
        const baseline = quantities.reduce((sum, q) => sum + q, 0) / (quantities.length || 1);
        // Calculate trend (slope) using last 7 days if available
        let trend = 0;
        if (quantities.length >= 3) {
            const recentDays = Math.min(7, quantities.length);
            const recent = quantities.slice(-recentDays);
            const firstHalf = recent.slice(0, Math.floor(recent.length / 2));
            const secondHalf = recent.slice(Math.floor(recent.length / 2));
            const avgFirst = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
            const avgSecond = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
            trend = (avgSecond - avgFirst) / recentDays; // daily trend
        }
        // Calculate variance for realistic bounds
        const variance = quantities.length > 1
            ? Math.sqrt(quantities.reduce((sum, q) => sum + Math.pow(q - baseline, 2), 0) / quantities.length)
            : baseline * 0.2;
        for (let i = 1; i <= days; i += 1) {
            const targetDate = new Date(anchor);
            targetDate.setDate(anchor.getDate() + i);
            const factors = (0, calendar_1.getCalendarFactors)({ date: targetDate });
            // Apply trend + calendar factors
            const trendAdjustment = trend * i;
            const baseExpected = Math.max(1, baseline + trendAdjustment);
            const expected = baseExpected * factors.totalFactor;
            // Add small random variation for more realistic predictions (seeded by date)
            const dayVariation = 1 + (Math.sin(targetDate.getDate() * 0.5) * 0.1);
            const finalExpected = expected * dayVariation;
            // Bounds based on actual variance
            const boundRange = Math.max(variance * 0.5, finalExpected * 0.15, 1);
            predictions.push({
                date: targetDate.toISOString().split('T')[0],
                predicted_quantity: Math.max(1, Math.round(finalExpected)),
                confidence: data.length >= 14 ? 'MEDIUM' : 'LOW',
                lower_bound: Math.max(0, Math.round(finalExpected - boundRange)),
                upper_bound: Math.round(finalExpected + boundRange),
            });
        }
        return predictions;
    }
    // ✅ UNIVERSAL ML PREDICTION
    async callMLUniversalPredict(salesHistory, days = 7) {
        try {
            const salesData = salesHistory.map(s => ({
                date: new Date(s.date).toISOString().split('T')[0],
                quantity: Number(s.quantity)
            }));
            const response = await axios_1.default.post(`${ML_API_URL}/api/ml/predict-universal`, { sales_data: salesData, forecast_days: days }, { timeout: 15000, headers: { 'Content-Type': 'application/json' } });
            if (response.data && response.data.success)
                return response.data;
            return null;
        }
        catch (error) {
            console.error('[IntelligenceService] Universal ML error:', error.message);
            return null;
        }
    }
    async isMLAvailable() {
        try {
            const response = await axios_1.default.get(`${ML_API_URL}/`, { timeout: 3000 });
            return response.status === 200;
        }
        catch {
            return false;
        }
    }
    // ✅ MAIN ANALYSIS - USES UNIVERSAL ML
    async analyzeProduct(productId, productName, salesData) {
        const cleaned = this.normalizeSales(salesData);
        const momentum = this.calculateMomentum(cleaned);
        const burst = this.detectBurst(cleaned);
        const realtimeMetrics = {
            momentum,
            burst: { score: burst.score, severity: burst.severity, level: burst.severity },
            classification: burst.classification,
            lastUpdated: new Date().toISOString(),
        };
        if (!cleaned.length || cleaned.length < MIN_TRAINING_DAYS) {
            const rulePred = this.getRuleBasedPredictions(cleaned, FORECAST_DAYS);
            return {
                productId, productName, realtime: realtimeMetrics,
                forecast: {
                    method: 'rule-based (cold start)',
                    predictions: rulePred,
                    trend: 'STABLE',
                    totalForecast7d: rulePred.reduce((sum, p) => sum + p.predicted_quantity, 0),
                    summary: `Data kurang (${cleaned.length} hari). Butuh ${MIN_TRAINING_DAYS}+ hari.`
                },
                recommendations: [],
                confidence: { overall: 'LOW', dataQuality: 0.1, modelAgreement: 0 }
            };
        }
        const mlAvailable = await this.isMLAvailable();
        if (!mlAvailable) {
            console.warn('[IntelligenceService] ML offline, using fallback');
            const rulePred = this.getRuleBasedPredictions(cleaned, FORECAST_DAYS);
            return {
                productId, productName, realtime: realtimeMetrics,
                forecast: {
                    method: 'rule-based (ML offline)',
                    predictions: rulePred,
                    trend: 'STABLE',
                    totalForecast7d: rulePred.reduce((sum, p) => sum + p.predicted_quantity, 0),
                    summary: 'ML Service offline.'
                },
                recommendations: [],
                confidence: { overall: 'LOW', dataQuality: 0.5, modelAgreement: 0 }
            };
        }
        // ✅ CALL UNIVERSAL ML
        const aiResult = await this.callMLUniversalPredict(cleaned, FORECAST_DAYS);
        if (!aiResult || !aiResult.success) {
            console.warn('[IntelligenceService] ML failed, using fallback');
            const rulePred = this.getRuleBasedPredictions(cleaned, FORECAST_DAYS);
            return {
                productId, productName, realtime: realtimeMetrics,
                forecast: {
                    method: 'rule-based (ML failed)',
                    predictions: rulePred,
                    trend: 'STABLE',
                    totalForecast7d: rulePred.reduce((sum, p) => sum + p.predicted_quantity, 0),
                    summary: 'ML unavailable.'
                },
                recommendations: [],
                confidence: { overall: 'LOW', dataQuality: 0.5, modelAgreement: 0 }
            };
        }
        // ✅ SUCCESS - ML WORKING
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
        const recommendations = [];
        if (momentum.status === 'TRENDING_UP' || momentum.status === 'GROWING') {
            recommendations.push({
                type: 'STOCK_INCREASE', priority: 'HIGH',
                message: `${productName} tren naik. Tambah stok 20-30%.`,
                actionable: true,
                action: `Tingkatkan stok ${productName}`,
                details: [`Momentum: ${momentum.status}`, `Avg: ${(total7d / 7).toFixed(1)} unit/hari`]
            });
        }
        else if (momentum.status === 'DECLINING' || momentum.status === 'FALLING') {
            recommendations.push({
                type: 'STOCK_REDUCE', priority: 'MEDIUM',
                message: `${productName} tren turun. Kurangi stok 10-20%.`,
                actionable: true,
                action: `Kurangi stok ${productName}`,
                details: [`Momentum: ${momentum.status}`, `Avg: ${(total7d / 7).toFixed(1)} unit/hari`]
            });
        }
        if (burst.severity === 'HIGH' || burst.severity === 'CRITICAL') {
            recommendations.push({
                type: 'BURST_ALERT', priority: 'URGENT',
                message: `Lonjakan signifikan: ${productName}!`,
                actionable: true,
                action: 'Siapkan stok tambahan',
                details: [`Burst: ${burst.score}`, `Type: ${burst.classification}`]
            });
        }
        return {
            productId, productName, realtime: realtimeMetrics,
            forecast: {
                method: 'hybrid-ml (universal)',
                predictions: predictions.map((p) => ({
                    date: p.date,
                    predicted_quantity: Math.round(p.predicted_quantity),
                    confidence: p.confidence || 'MEDIUM',
                    lower_bound: Math.round(p.lower_bound || p.predicted_quantity * 0.8),
                    upper_bound: Math.round(p.upper_bound || p.predicted_quantity * 1.2)
                })),
                trend,
                totalForecast7d: Math.round(total7d),
                summary: `Prediksi ML universal (${cleaned.length} hari data).`
            },
            recommendations,
            confidence: {
                overall: 'HIGH',
                dataQuality: cleaned.length >= 60 ? 1.0 : cleaned.length / 60,
                modelAgreement: 0.88
            }
        };
    }
    async getWeeklyReport(userId, topN = 10) {
        try {
            const mlAvailable = await this.isMLAvailable();
            if (mlAvailable) {
                try {
                    const response = await axios_1.default.get(`${ML_API_URL}/api/ml/report/weekly`, {
                        params: { top_n: topN, include_insights: true },
                        timeout: 30000
                    });
                    if (response.data?.success && response.data?.report) {
                        const report = response.data.report;
                        return {
                            summary: report.summary || { burst_alerts: 0 },
                            topPerformers: report.top_performers || [],
                            needsAttention: report.needs_attention || [],
                            insights: report.insights || [],
                            generatedAt: response.data.generated_at || new Date().toISOString()
                        };
                    }
                }
                catch (mlError) {
                    console.warn('[IntelligenceService] ML weekly report failed:', mlError.message);
                }
            }
            // Fallback: Generate report from local data
            return await this.generateLocalWeeklyReport(userId, topN);
        }
        catch (error) {
            console.error('[IntelligenceService] Weekly report error:', error);
            return {
                summary: { burst_alerts: 0 },
                topPerformers: [],
                needsAttention: [],
                insights: [],
                generatedAt: new Date().toISOString()
            };
        }
    }
    async generateLocalWeeklyReport(userId, topN) {
        try {
            // Get all user products
            const products = await schema_1.prisma.products.findMany({
                where: { user_id: userId, is_active: true },
                select: { id: true, name: true }
            });
            const topPerformers = [];
            const needsAttention = [];
            let burstCount = 0;
            for (const product of products) {
                try {
                    const salesData = await (0, queries_1.getSalesData)(userId, product.id, 14);
                    if (salesData.length >= 5) {
                        const momentum = this.calculateMomentum(salesData);
                        const burst = this.detectBurst(salesData);
                        const total = salesData.reduce((sum, s) => sum + Number(s.quantity), 0);
                        const productReport = {
                            product_id: product.id,
                            product_name: product.name,
                            total_sales: total,
                            momentum: momentum,
                            burst: {
                                level: burst.severity,
                                score: burst.score
                            }
                        };
                        // Categorize by momentum
                        if (momentum.status === 'TRENDING_UP' || momentum.status === 'GROWING') {
                            topPerformers.push(productReport);
                        }
                        if (momentum.status === 'DECLINING' || momentum.status === 'FALLING') {
                            needsAttention.push(productReport);
                        }
                        if (burst.severity === 'HIGH' || burst.severity === 'CRITICAL') {
                            burstCount++;
                        }
                    }
                }
                catch (err) {
                    console.error(`[WeeklyReport] Error for ${product.id}:`, err);
                }
            }
            // Sort by total sales
            topPerformers.sort((a, b) => b.total_sales - a.total_sales);
            needsAttention.sort((a, b) => a.momentum.combined - b.momentum.combined);
            return {
                summary: {
                    burst_alerts: burstCount,
                    total_products: products.length,
                    trending_up: topPerformers.length,
                    needs_attention: needsAttention.length
                },
                topPerformers: topPerformers.slice(0, topN),
                needsAttention: needsAttention.slice(0, topN),
                insights: this.generateInsights(topPerformers, needsAttention, burstCount),
                generatedAt: new Date().toISOString()
            };
        }
        catch (error) {
            console.error('[IntelligenceService] Local report error:', error);
            return {
                summary: { burst_alerts: 0 },
                topPerformers: [],
                needsAttention: [],
                insights: [],
                generatedAt: new Date().toISOString()
            };
        }
    }
    generateInsights(topPerformers, needsAttention, burstCount) {
        const insights = [];
        if (topPerformers.length > 0) {
            insights.push(`${topPerformers.length} produk menunjukkan tren naik`);
            if (topPerformers[0]) {
                insights.push(`${topPerformers[0].product_name} adalah produk dengan performa terbaik`);
            }
        }
        if (needsAttention.length > 0) {
            insights.push(`${needsAttention.length} produk membutuhkan perhatian (tren turun)`);
        }
        if (burstCount > 0) {
            insights.push(`${burstCount} produk mengalami lonjakan penjualan`);
        }
        if (insights.length === 0) {
            insights.push('Performa produk stabil minggu ini');
        }
        return insights;
    }
    async getTrendingProducts(userId) {
        try {
            const products = await schema_1.prisma.products.findMany({
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
                                productName: product.name,
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
                    ? [`${trendingProducts.length} produk menunjukkan lonjakan`]
                    : ['Tidak ada lonjakan terdeteksi'],
                generatedAt: new Date().toISOString()
            };
        }
        catch (error) {
            console.error('[IntelligenceService] Trending error:', error);
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
