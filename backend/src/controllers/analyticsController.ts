import { Request, Response } from 'express';
import { intelligenceService } from '../services/intelligenceService';
import { prisma } from '../../lib/database/schema';
import { getSalesData } from '../../lib/database/queries';

export class AnalyticsController {
  
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
   * GET /api/analytics/products/ranking
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

      // Get weekly report (contains rankings)
      const report = await intelligenceService.getWeeklyReport(userId, limit);
      
      res.json({
        success: true,
        rankings: report.topPerformers || [],
        summary: report.summary,
        generatedAt: report.generatedAt
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