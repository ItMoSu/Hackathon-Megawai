// backend/src/routes/analyticsRoutes.ts
import { Router } from 'express';
import { AnalyticsController } from '../controllers/analyticsController';
import { authenticateToken } from '../middleware/authMiddleware';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// Product forecast
router.get('/products/:productId/forecast', AnalyticsController.getProductForecast);

// Product insights
router.get('/products/:productId/insights', AnalyticsController.getProductInsights);

// Rankings
router.get('/products/ranking', AnalyticsController.getProductRanking);

// Weekly report
router.get('/reports/weekly', AnalyticsController.getWeeklyReport);

// Trending products
router.get('/trending', AnalyticsController.getTrendingProducts);

export default router;