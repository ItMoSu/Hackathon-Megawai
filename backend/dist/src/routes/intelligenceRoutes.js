"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IntelligenceService = void 0;
const client_1 = require("@prisma/client");
const express_1 = require("express");
const mlService_1 = require("../services/mlService");
const authMiddleware_1 = require("../middleware/authMiddleware");
const intelligenceService_1 = require("../services/intelligenceService");
const prisma = new client_1.PrismaClient();
const router = (0, express_1.Router)();
// All intelligence routes require authentication
router.use(authMiddleware_1.authenticateToken);
// Weekly report (uses ML when available, falls back to local trending)
router.get('/weekly-report', async (req, res) => {
    try {
        const userId = req.user?.sub;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const topNParam = Number(req.query.topN ?? req.query.top_n ?? 10);
        const topN = Number.isFinite(topNParam) && topNParam > 0 ? topNParam : 10;
        const report = await intelligenceService_1.intelligenceService.getWeeklyReport(userId, topN);
        res.json(report);
    }
    catch (error) {
        console.error('[IntelligenceRoutes] weekly-report error:', error);
        res.status(500).json({ error: 'Failed to fetch weekly report' });
    }
});
// Trending / burst alerts fallback
router.get('/trending', async (req, res) => {
    try {
        const userId = req.user?.sub;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const trending = await intelligenceService_1.intelligenceService.getTrendingProducts(userId);
        res.json(trending);
    }
    catch (error) {
        console.error('[IntelligenceRoutes] trending error:', error);
        res.status(500).json({ error: 'Failed to fetch trending products' });
    }
});
class IntelligenceService {
    /**
     * Get or calculate daily analytics for a product
     * Uses cached DB data if available, otherwise calls ML
     */
    static async getDailyAnalytics(productId, date) {
        try {
            // Check if analytics already exist for this date
            const existing = await prisma.daily_analytics.findUnique({
                where: {
                    product_id_metric_date: {
                        product_id: productId,
                        metric_date: date
                    }
                },
                include: {
                    products: true
                }
            });
            if (existing) {
                return existing;
            }
            // Analytics don't exist, calculate from ML
            const product = await prisma.products.findUnique({
                where: { id: productId }
            });
            if (!product) {
                throw new Error('Product not found');
            }
            // Get ML forecast
            const mlForecast = await mlService_1.MLService.getForecast(product.name, 7);
            // Extract ML metrics for today
            const todayPrediction = mlForecast.predictions[0];
            // Get actual sales for today
            const todaySales = await prisma.sales.findUnique({
                where: {
                    product_id_sale_date: {
                        product_id: productId,
                        sale_date: date
                    }
                }
            });
            // Create daily analytics record
            const analytics = await prisma.daily_analytics.create({
                data: {
                    user_id: product.user_id,
                    product_id: productId,
                    dataset_id: product.dataset_id,
                    metric_date: date,
                    actual_quantity: todaySales?.quantity || 0,
                    forecast_quantity: todayPrediction.predicted_quantity,
                    // ML provides these via debug/metrics
                    // You'll need to extend ML API to return these
                    momentum_combined: 0, // TODO: Get from ML
                    momentum_label: 'CALCULATING', // TODO: Get from ML
                    burst_score: 0, // TODO: Get from ML
                    burst_level: 'NORMAL', // TODO: Get from ML
                    burst_type: 'NORMAL', // TODO: Get from ML
                    priority_score: 0, // TODO: Get from ML
                    ai_insight: {
                        confidence: todayPrediction.confidence,
                        lower_bound: todayPrediction.lower_bound,
                        upper_bound: todayPrediction.upper_bound,
                        ml_mae: mlForecast.debug.model_mae
                    }
                },
                include: {
                    products: true
                }
            });
            return analytics;
        }
        catch (error) {
            console.error('[IntelligenceService] Get daily analytics error:', error);
            throw error;
        }
    }
    /**
     * Get product forecast with ML
     */
    static async getProductForecast(productId, days = 7) {
        try {
            const product = await prisma.products.findUnique({
                where: { id: productId }
            });
            if (!product) {
                throw new Error('Product not found');
            }
            // Call ML for forecast
            const mlForecast = await mlService_1.MLService.getForecast(product.name, days);
            // Get historical sales
            const historicalSales = await prisma.sales.findMany({
                where: { product_id: productId },
                orderBy: { sale_date: 'desc' },
                take: 30
            });
            return {
                product,
                forecast: mlForecast.predictions,
                ml_metrics: mlForecast.debug,
                historical: historicalSales
            };
        }
        catch (error) {
            console.error('[IntelligenceService] Forecast error:', error);
            throw error;
        }
    }
    /**
     * Get weekly report with ML rankings
     */
    static async getWeeklyReport(topN = 10, strategy = 'balanced') {
        try {
            // Get ML report
            const mlReport = await mlService_1.MLService.getWeeklyReport(topN, strategy);
            // Get all products for enrichment
            const products = await prisma.products.findMany({
                where: {
                    is_active: true
                }
            });
            const productMap = new Map(products.map(p => [p.name, p]));
            // Enrich top performers
            const enrichedTopPerformers = mlReport.report.top_performers.map(perf => {
                const product = productMap.get(perf.product_id);
                return {
                    rank: perf.rank,
                    product_id: product?.id,
                    product_name: perf.product_id,
                    product_category: product?.unit,
                    priority_score: perf.priority_score,
                    momentum_status: perf.momentum_status,
                    burst_level: perf.burst_level,
                    avg_demand_7d: perf.avg_demand_7d,
                    trend: perf.trend,
                    product_details: product
                };
            }).filter(item => item.product_id);
            // Enrich needs attention
            const enrichedNeedsAttention = mlReport.report.needs_attention.map(item => {
                const product = productMap.get(item.product_id);
                return {
                    rank: item.rank,
                    product_id: product?.id,
                    product_name: item.product_id,
                    reason: item.reason,
                    action: item.action,
                    momentum_status: item.momentum_status,
                    burst_level: item.burst_level,
                    product_details: product
                };
            }).filter(item => item.product_id);
            // Update daily_analytics with ML insights (async, don't wait)
            this.updateDailyAnalyticsFromML(mlReport).catch(err => console.error('Failed to update daily analytics:', err));
            return {
                success: true,
                report: {
                    ...mlReport.report,
                    top_performers: enrichedTopPerformers,
                    needs_attention: enrichedNeedsAttention
                },
                generated_at: mlReport.generated_at
            };
        }
        catch (error) {
            console.error('[IntelligenceService] Weekly report error:', error);
            throw error;
        }
    }
    /**
     * Background job: Update daily_analytics table with ML results
     */
    static async updateDailyAnalyticsFromML(mlReport) {
        try {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            // For each product in report, update/create daily_analytics
            for (const productData of Object.values(mlReport.report.products)) {
                const product = await prisma.products.findFirst({
                    where: { name: productData.product_id }
                });
                if (!product)
                    continue;
                // Upsert daily analytics
                await prisma.daily_analytics.upsert({
                    where: {
                        product_id_metric_date: {
                            product_id: product.id,
                            metric_date: today
                        }
                    },
                    create: {
                        user_id: product.user_id,
                        product_id: product.id,
                        dataset_id: product.dataset_id,
                        metric_date: today,
                        actual_quantity: 0, // Will be updated when sale is recorded
                        momentum_combined: productData.momentum?.combined || 0,
                        momentum_label: productData.momentum?.status || 'UNKNOWN',
                        burst_score: productData.burst?.burst_score || 0,
                        burst_level: productData.burst?.level || 'NORMAL',
                        burst_type: productData.burst?.burst_type || 'NORMAL',
                        priority_score: productData.priority_score || 0,
                        ai_insight: {
                            source: 'ml_api',
                            updated_at: new Date().toISOString()
                        }
                    },
                    update: {
                        momentum_combined: productData.momentum?.combined || 0,
                        momentum_label: productData.momentum?.status || 'UNKNOWN',
                        burst_score: productData.burst?.burst_score || 0,
                        burst_level: productData.burst?.level || 'NORMAL',
                        burst_type: productData.burst?.burst_type || 'NORMAL',
                        priority_score: productData.priority_score || 0,
                        updated_at: new Date(),
                        ai_insight: {
                            source: 'ml_api',
                            updated_at: new Date().toISOString()
                        }
                    }
                });
            }
            console.log('[IntelligenceService] Updated daily_analytics with ML data');
        }
        catch (error) {
            console.error('[IntelligenceService] Update daily analytics error:', error);
        }
    }
}
exports.IntelligenceService = IntelligenceService;
exports.default = router;
