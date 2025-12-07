import { Request, Response } from 'express';
import { intelligenceService } from '../services/intelligenceService';
import { prisma } from '../../lib/database/schema';
import { getSalesData } from '../../lib/database/queries';

// Helper function to detect burst in sales data
function detectBurst(salesData: { date: Date | string; quantity: number }[]) {
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
  if (zScore > 3) severity = 'CRITICAL';
  else if (zScore > 2) severity = 'HIGH';
  else if (zScore > 1.5) severity = 'MEDIUM';

  let classification = 'NORMAL';
  if (severity !== 'NORMAL') {
    const lastDate = new Date(salesData[salesData.length - 1].date);
    const day = lastDate.getDay();
    classification = (day === 0 || day === 6) ? 'SEASONAL' : 'SPIKE';
  }

  return { score: Number(zScore.toFixed(2)), severity, classification };
}

export class AnalyticsController {

  /**
   * GET /api/analytics/summary
   * Get dashboard summary with today's stats, burst alerts, and top products
   */
  static async getDashboardSummary(req: Request, res: Response) {
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
      const todaySales = await prisma.sales.findMany({
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
      const yesterdaySales = await prisma.sales.findMany({
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
      const userProducts = await prisma.products.findMany({
        where: { user_id: userId, is_active: true },
        select: { id: true, name: true }
      });

      const burstAlerts: Array<{
        product_id: string;
        product_name: string;
        burst_score: number;
        burst_level: string;
      }> = [];

      // Check each product for burst activity
      for (const product of userProducts) {
        try {
          const salesHistory = await getSalesData(userId, product.id, 14); // Last 14 days
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
        } catch (err) {
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
      }, {} as Record<string, any>);

      const topProducts = Object.values(productSales)
        .sort((a: any, b: any) => b.quantity - a.quantity)
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

    } catch (error: any) {
      console.error('[AnalyticsController] Summary error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Gagal mendapatkan summary'
      });
    }
  }

  /**
   * GET /api/analytics/summary
   * Get dashboard summary with today's stats, changes, burst alerts, and top products
   */
  static async getDashboardSummary(req: Request, res: Response) {
    try {
      const userId = req.user?.sub;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'User tidak terotentikasi'
        });
      }

      // Calculate dates
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      
      const endOfToday = new Date(today);
      endOfToday.setHours(23, 59, 59, 999);

      // Today's totals
      const todaySales = await prisma.sales.aggregate({
        _sum: {
          quantity: true,
          revenue: true
        },
        _count: true,
        where: {
          user_id: userId,
          sale_date: {
            gte: today,
            lte: endOfToday
          }
        }
      });

      // Yesterday's totals for comparison
      const yesterdaySales = await prisma.sales.aggregate({
        _sum: {
          quantity: true,
          revenue: true
        },
        where: {
          user_id: userId,
          sale_date: {
            gte: yesterday,
            lt: today
          }
        }
      });

      const todayQty = Number(todaySales._sum.quantity) || 0;
      const todayRev = Number(todaySales._sum.revenue) || 0;
      const yesterdayQty = Number(yesterdaySales._sum.quantity) || 1; // avoid division by 0
      const yesterdayRev = Number(yesterdaySales._sum.revenue) || 1;

      const quantityChange = yesterdayQty > 0 
        ? ((todayQty - yesterdayQty) / yesterdayQty) * 100 
        : 0;
      const revenueChange = yesterdayRev > 0 
        ? ((todayRev - yesterdayRev) / yesterdayRev) * 100 
        : 0;

      // Get burst alerts from daily_analytics
      const twoDaysAgo = new Date(today);
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

      const burstAlerts = await prisma.daily_analytics.findMany({
        where: {
          user_id: userId,
          metric_date: { gte: twoDaysAgo },
          burst_level: { in: ['HIGH', 'CRITICAL'] }
        },
        include: {
          products: {
            select: { id: true, name: true }
          }
        },
        orderBy: { burst_score: 'desc' },
        take: 5
      });

      // Get top products by quantity today
      const topProductsRaw = await prisma.sales.groupBy({
        by: ['product_id'],
        _sum: { quantity: true },
        where: {
          user_id: userId,
          sale_date: { gte: today, lte: endOfToday }
        },
        orderBy: { _sum: { quantity: 'desc' } },
        take: 5
      });

      const topProducts = await Promise.all(topProductsRaw.map(async (item) => {
        const product = await prisma.products.findUnique({
          where: { id: item.product_id },
          select: { id: true, name: true }
        });
        return {
          product_id: item.product_id,
          product_name: product?.name || 'Unknown',
          quantity: Number(item._sum.quantity) || 0
        };
      }));

      res.json({
        success: true,
        summary: {
          today: {
            total_quantity: todayQty,
            total_revenue: todayRev,
            sales_count: todaySales._count || 0
          },
          changes: {
            quantity_change: Number(quantityChange.toFixed(1)),
            revenue_change: Number(revenueChange.toFixed(1))
          },
          burst_alerts: burstAlerts.map(alert => ({
            product_id: alert.product_id,
            product_name: alert.products.name,
            burst_score: Number(alert.burst_score) || 0,
            burst_level: alert.burst_level || 'NORMAL'
          })),
          top_products: topProducts
        }
      });

    } catch (error: any) {
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
  static async getProductForecast(req: Request, res: Response) {
    try {
      const { productId } = req.params;
      const days = parseInt(req.query.days as string) || 7;
      const userId = req.user?.sub;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'User tidak terotentikasi'
        });
      }

      // Get product from database
      const product = await prisma.products.findFirst({
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
      const salesHistory = await getSalesData(userId, productId, 60); // Last 60 days

      // Analyze with ML service
      const analysis = await intelligenceService.analyzeProduct(
        product.id,
        product.name,
        salesHistory
      );

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
      
    } catch (error: any) {
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
  static async getWeeklyReport(req: Request, res: Response) {
    try {
      const topN = parseInt(req.query.top_n as string) || 10;
      const userId = req.user?.sub;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'User tidak terotentikasi'
        });
      }

      // Get weekly report from ML service
      const report = await intelligenceService.getWeeklyReport(userId, topN);
      
      res.json({
        success: true,
        ...report
      });
      
    } catch (error: any) {
      console.error('[AnalyticsController] Weekly report error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Gagal mendapatkan weekly report'
      });
    }
  }
  
  /**
   * GET /api/analytics/ranking
   * Get product ranking based on ML priority scores
   */
  static async getProductRanking(req: Request, res: Response) {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const userId = req.user?.sub;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'User tidak terotentikasi'
        });
      }

      // Get all active products
      const products = await prisma.products.findMany({
        where: { 
          user_id: userId,
          is_active: true 
        },
        select: { id: true, name: true, unit: true }
      });

      // Analyze each product
      const rankings = [];

      for (const product of products) {
        try {
          const salesHistory = await getSalesData(userId, product.id, 60);
          
          if (salesHistory.length >= 3) {
            const analysis = await intelligenceService.analyzeProduct(
              product.id,
              product.name,
              salesHistory
            );

            // Calculate average quantity
            const totalQty = salesHistory.reduce((sum, s) => sum + Number(s.quantity), 0);
            const avgQty = salesHistory.length > 0 ? totalQty / salesHistory.length : 0;

            // Calculate priority score from momentum and burst
            const momentum = analysis.realtime?.momentum?.combined || 1;
            const burstScore = analysis.realtime?.burst?.score || 0;
            const momentumFactor = Math.abs(momentum - 1);
            const burstFactor = Math.min(burstScore / 3, 1);
            const priorityScore = 0.7 * momentumFactor + 0.3 * burstFactor;

            rankings.push({
              productId: product.id,
              productName: product.name,
              unit: product.unit,
              priorityScore: priorityScore,
              momentum: {
                combined: momentum,
                status: analysis.realtime?.momentum?.status || 'STABLE'
              },
              burst: {
                score: burstScore,
                level: analysis.realtime?.burst?.severity || 'NORMAL'
              },
              avgQuantity: Number(avgQty.toFixed(1)),
              forecast: analysis.forecast?.predictions?.slice(0, 3) || [],
              confidence: analysis.confidence?.overall || 'LOW'
            });
          }
        } catch (err) {
          console.error(`Error analyzing product ${product.id}:`, err);
        }
      }

      // Sort by priority score (descending)
      rankings.sort((a, b) => b.priorityScore - a.priorityScore);

      res.json({
        success: true,
        rankings: rankings.slice(0, limit),
        total: rankings.length,
        generatedAt: new Date().toISOString()
      });
      
    } catch (error: any) {
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
  static async getProductInsights(req: Request, res: Response) {
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
      const product = await prisma.products.findFirst({
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
      const analytics = await prisma.daily_analytics.findFirst({
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

    } catch (error: any) {
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
  static async getTrendingProducts(req: Request, res: Response) {
    try {
      const userId = req.user?.sub;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'User tidak terotentikasi'
        });
      }

      // Get trending from intelligence service
      const trending = await intelligenceService.getTrendingProducts(userId);

      res.json({
        success: true,
        trending: trending.topPerformers || [],
        count: trending.topPerformers?.length || 0,
        generatedAt: trending.generatedAt
      });

    } catch (error: any) {
      console.error('[AnalyticsController] Trending error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Gagal mendapatkan trending products'
      });
    }
  }
}
