import { Router } from 'express';
import { authenticateToken } from '../middleware/authMiddleware';
import { intelligenceService } from '../services/intelligenceService';
import { prisma } from '../../lib/database/schema';

const router = Router();

// All intelligence routes require authentication
router.use(authenticateToken);

// GET /api/intelligence/analyze/:productId
// Get AI analysis for a specific product
router.get('/analyze/:productId', async (req, res) => {
  try {
    const { productId } = req.params;
    const userId = req.user?.sub;
    const forecastDays = Math.min(30, Math.max(7, Number(req.query.days) || 7));

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized'
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
        error: 'Product not found'
      });
    }

    // Get sales history (last 60 days)
    const salesHistory = await prisma.sales.findMany({
      where: {
        product_id: productId,
        user_id: userId
      },
      select: {
        sale_date: true,
        quantity: true
      },
      orderBy: {
        sale_date: 'asc'
      },
      take: 60
    });

    // Transform to SalesPoint format expected by intelligenceService
    const salesData = salesHistory.map(s => ({
      date: s.sale_date,
      quantity: Number(s.quantity),
      productName: product.name
    }));

    // Call intelligence service to analyze product
    const intelligence = await intelligenceService.analyzeProduct(
      product.id,
      product.name,
      salesData,
      forecastDays
    );

    // Return in format expected by frontend
    res.json({
      success: true,
      data: intelligence
    });

  } catch (error: any) {
    console.error('[IntelligenceRoutes] Analyze error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to analyze product'
    });
  }
});

// Weekly report (uses ML when available, falls back to local trending)
router.get('/weekly-report', async (req, res) => {
  try {
    const userId = req.user?.sub;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const topNParam = Number(req.query.topN ?? req.query.top_n ?? 10);
    const topN = Number.isFinite(topNParam) && topNParam > 0 ? topNParam : 10;
    const report = await intelligenceService.getWeeklyReport(userId, topN);
    res.json(report);
  } catch (error) {
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

    const trending = await intelligenceService.getTrendingProducts(userId);
    res.json(trending);
  } catch (error) {
    console.error('[IntelligenceRoutes] trending error:', error);
    res.status(500).json({ error: 'Failed to fetch trending products' });
  }
});

export default router;
