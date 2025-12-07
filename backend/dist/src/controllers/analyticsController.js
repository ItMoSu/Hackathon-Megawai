"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnalyticsController = void 0;
const intelligenceService_1 = require("../services/intelligenceService");
const schema_1 = require("../../lib/database/schema");
const queries_1 = require("../../lib/database/queries");
// Helper function to detect burst in sales data
function detectBurst(salesData) {
    if (!salesData || salesData.length < 5) {
        return { score: 0, severity: 'NORMAL', classification: 'NORMAL' };
    }
    const quantities = salesData.map(d => Number(d.quantity));
    const baseline = quantities.slice(0, -1);
    const latest = quantities[quantities.length - 1];
    const mean = baseline.reduce((sum, val) => sum + val, 0) / (baseline.length || 1);
    const variance = baseline.reduce((sum, val) => sum + (val - mean) ** 2, 0) / (baseline.length || 1);
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
        const lastDate = new Date(salesData[salesData.length - 1].date);
        const day = lastDate.getDay();
        classification = (day === 0 || day === 6) ? 'SEASONAL' : 'SPIKE';
    }
    return { score: Number(zScore.toFixed(2)), severity, classification };
}
class AnalyticsController {
    /**
     * GET /api/analytics/summary
     * Get dashboard summary with today's stats, burst alerts, and top products
     */
    static async getDashboardSummary(req, res) {
        try {
            const userId = req.user?.sub;
            if (!userId) {
                return res.status(401).json({
                    success: false,
                    error: 'User tidak terotentikasi'
                });
            }
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);
            // Get today's sales
            const todaySales = await schema_1.prisma.sales.findMany({
                where: {
                    user_id: userId,
                    sale_date: {
                        gte: today
                    }
                },
                include: {
                    products: true
                }
            });
            // Get yesterday's sales for comparison
            const yesterdaySales = await schema_1.prisma.sales.findMany({
                where: {
                    user_id: userId,
                    sale_date: {
                        gte: yesterday,
                        lt: today
                    }
                }
            });
            // Calculate today's totals
            const todayTotal = todaySales.reduce((sum, sale) => sum + Number(sale.quantity), 0);
            const todayRevenue = todaySales.reduce((sum, sale) => sum + Number(sale.revenue || 0), 0);
            // Calculate yesterday's totals for comparison
            const yesterdayTotal = yesterdaySales.reduce((sum, sale) => sum + Number(sale.quantity), 0);
            const yesterdayRevenue = yesterdaySales.reduce((sum, sale) => sum + Number(sale.revenue || 0), 0);
            // Calculate changes
            const quantityChange = yesterdayTotal > 0
                ? ((todayTotal - yesterdayTotal) / yesterdayTotal) * 100
                : 0;
            const revenueChange = yesterdayRevenue > 0
                ? ((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100
                : 0;
            // Calculate burst alerts in real-time from sales data
            const userProducts = await schema_1.prisma.products.findMany({
                where: { user_id: userId, is_active: true },
                select: { id: true, name: true }
            });
            const burstAlerts = [];
            // Check each product for burst activity
            for (const product of userProducts) {
                try {
                    const salesHistory = await (0, queries_1.getSalesData)(userId, product.id, 14); // Last 14 days
                    if (salesHistory.length >= 5) {
                        const burst = detectBurst(salesHistory);
                        if (burst.severity === 'HIGH' || burst.severity === 'CRITICAL') {
                            burstAlerts.push({
                                product_id: product.id,
                                product_name: product.name,
                                burst_score: burst.score,
                                burst_level: burst.severity
                            });
                        }
                    }
                }
                catch (err) {
                    console.error(`[AnalyticsController] Error checking burst for ${product.id}:`, err);
                }
            }
            // Sort by burst score descending
            burstAlerts.sort((a, b) => b.burst_score - a.burst_score);
            // Get top products today
            const productSales = todaySales.reduce((acc, sale) => {
                const id = sale.product_id;
                if (!acc[id]) {
                    acc[id] = {
                        product_id: id,
                        product_name: sale.products?.name || 'Unknown',
                        quantity: 0
                    };
                }
                acc[id].quantity += Number(sale.quantity);
                return acc;
            }, {});
            const topProducts = Object.values(productSales)
                .sort((a, b) => b.quantity - a.quantity)
                .slice(0, 3);
            res.json({
                success: true,
                summary: {
                    today: {
                        total_quantity: todayTotal,
                        total_revenue: todayRevenue,
                        sales_count: todaySales.length
                    },
                    changes: {
                        quantity_change: Math.round(quantityChange * 10) / 10,
                        revenue_change: Math.round(revenueChange * 10) / 10
                    },
                    burst_alerts: burstAlerts.slice(0, 5), // Return top 5 burst alerts
                    top_products: topProducts
                }
            });
        }
        catch (error) {
            console.error('[AnalyticsController] Summary error:', error);
            res.status(500).json({
                success: false,
                error: error.message || 'Gagal mendapatkan summary'
            });
        }
    }
    /**
     * GET /api/analytics/products/:productId/forecast
     * Get ML forecast for a specific product
     */
    static async getProductForecast(req, res) {
        try {
            const { productId } = req.params;
            const days = parseInt(req.query.days) || 7;
            const userId = req.user?.sub;
            if (!userId) {
                return res.status(401).json({
                    success: false,
                    error: 'User tidak terotentikasi'
                });
            }
            // Get product from database
            const product = await schema_1.prisma.products.findFirst({
                where: {
                    id: productId,
                    user_id: userId // Ensure user owns this product
                }
            });
            if (!product) {
                return res.status(404).json({
                    success: false,
                    error: 'Product tidak ditemukan'
                });
            }
            // Get sales history
            const salesHistory = await (0, queries_1.getSalesData)(userId, productId, 60); // Last 60 days
            // Analyze with ML service
            const analysis = await intelligenceService_1.intelligenceService.analyzeProduct(product.id, product.name, salesHistory);
            res.json({
                success: true,
                product: {
                    id: product.id,
                    name: product.name,
                    unit: product.unit,
                    price: product.price
                },
                ...analysis
            });
        }
        catch (error) {
            console.error('[AnalyticsController] Forecast error:', error);
            res.status(500).json({
                success: false,
                error: error.message || 'Gagal mendapatkan forecast'
            });
        }
    }
    /**
     * GET /api/analytics/reports/weekly
     * Get weekly analytics report with ML rankings
     */
    static async getWeeklyReport(req, res) {
        try {
            const topN = parseInt(req.query.top_n) || 10;
            const userId = req.user?.sub;
            if (!userId) {
                return res.status(401).json({
                    success: false,
                    error: 'User tidak terotentikasi'
                });
            }
            // Get weekly report from ML service
            const report = await intelligenceService_1.intelligenceService.getWeeklyReport(userId, topN);
            res.json({
                success: true,
                ...report
            });
        }
        catch (error) {
            console.error('[AnalyticsController] Weekly report error:', error);
            res.status(500).json({
                success: false,
                error: error.message || 'Gagal mendapatkan weekly report'
            });
        }
    }
    /**
     * GET /api/analytics/products/ranking
     * Get product ranking based on ML priority scores
     */
    static async getProductRanking(req, res) {
        try {
            const limit = parseInt(req.query.limit) || 50;
            const userId = req.user?.sub;
            if (!userId) {
                return res.status(401).json({
                    success: false,
                    error: 'User tidak terotentikasi'
                });
            }
            // Get weekly report (contains rankings)
            const report = await intelligenceService_1.intelligenceService.getWeeklyReport(userId, limit);
            res.json({
                success: true,
                rankings: report.topPerformers || [],
                summary: report.summary,
                generatedAt: report.generatedAt
            });
        }
        catch (error) {
            console.error('[AnalyticsController] Ranking error:', error);
            res.status(500).json({
                success: false,
                error: error.message || 'Gagal mendapatkan ranking'
            });
        }
    }
    /**
     * GET /api/analytics/products/:productId/insights
     * Get AI insights for a specific product
     */
    static async getProductInsights(req, res) {
        try {
            const { productId } = req.params;
            const userId = req.user?.sub;
            if (!userId) {
                return res.status(401).json({
                    success: false,
                    error: 'User tidak terotentikasi'
                });
            }
            // Get product
            const product = await schema_1.prisma.products.findFirst({
                where: {
                    id: productId,
                    user_id: userId
                }
            });
            if (!product) {
                return res.status(404).json({
                    success: false,
                    error: 'Product tidak ditemukan'
                });
            }
            // Get latest daily analytics
            const analytics = await schema_1.prisma.daily_analytics.findFirst({
                where: { product_id: productId },
                orderBy: { metric_date: 'desc' }
            });
            if (!analytics) {
                return res.status(404).json({
                    success: false,
                    error: 'Analytics belum tersedia'
                });
            }
            res.json({
                success: true,
                product: {
                    id: product.id,
                    name: product.name
                },
                insights: {
                    momentum: {
                        combined: Number(analytics.momentum_combined || 0),
                        status: analytics.momentum_label || 'UNKNOWN'
                    },
                    burst: {
                        score: Number(analytics.burst_score || 0),
                        level: analytics.burst_level || 'NORMAL',
                        type: analytics.burst_type || 'NORMAL'
                    },
                    priority: {
                        score: Number(analytics.priority_score || 0),
                        rank: analytics.priority_rank || null
                    },
                    ai_insight: analytics.ai_insight || null
                },
                lastUpdated: analytics.updated_at
            });
        }
        catch (error) {
            console.error('[AnalyticsController] Insights error:', error);
            res.status(500).json({
                success: false,
                error: error.message || 'Gagal mendapatkan insights'
            });
        }
    }
    /**
     * GET /api/analytics/trending
     * Get trending products (burst alerts)
     */
    static async getTrendingProducts(req, res) {
        try {
            const userId = req.user?.sub;
            if (!userId) {
                return res.status(401).json({
                    success: false,
                    error: 'User tidak terotentikasi'
                });
            }
            // Get trending from intelligence service
            const trending = await intelligenceService_1.intelligenceService.getTrendingProducts(userId);
            res.json({
                success: true,
                trending: trending.topPerformers || [],
                count: trending.topPerformers?.length || 0,
                generatedAt: trending.generatedAt
            });
        }
        catch (error) {
            console.error('[AnalyticsController] Trending error:', error);
            res.status(500).json({
                success: false,
                error: error.message || 'Gagal mendapatkan trending products'
            });
        }
    }
}
exports.AnalyticsController = AnalyticsController;
