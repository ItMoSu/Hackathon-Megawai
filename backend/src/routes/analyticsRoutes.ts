// backend/src/routes/analyticsRoutes.ts
import { Router } from 'express';
import { AnalyticsController } from '../controllers/analyticsController';
import { authenticateToken } from '../middleware/authMiddleware';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// Dashboard Summary - Main dashboard data
router.get('/summary', AnalyticsController.getDashboardSummary);

// Product Ranking - Full ranking list
router.get('/ranking', AnalyticsController.getProductRanking);

// Product forecast
router.get('/products/:productId/forecast', AnalyticsController.getProductForecast);

// Product insights
router.get('/products/:productId/insights', AnalyticsController.getProductInsights);

// Weekly report
router.get('/reports/weekly', AnalyticsController.getWeeklyReport);

// Trending products (burst alerts)
router.get('/trending', AnalyticsController.getTrendingProducts);

export default router;
