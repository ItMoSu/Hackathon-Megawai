"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// backend/src/routes/analyticsRoutes.ts
const express_1 = require("express");
const analyticsController_1 = require("../controllers/analyticsController");
const authMiddleware_1 = require("../middleware/authMiddleware");
const router = (0, express_1.Router)();
// All routes require authentication
router.use(authMiddleware_1.authenticateToken);
// Product forecast
router.get('/products/:productId/forecast', analyticsController_1.AnalyticsController.getProductForecast);
// Product insights
router.get('/products/:productId/insights', analyticsController_1.AnalyticsController.getProductInsights);
// Rankings
router.get('/products/ranking', analyticsController_1.AnalyticsController.getProductRanking);
// Weekly report
router.get('/reports/weekly', analyticsController_1.AnalyticsController.getWeeklyReport);
// Trending products
router.get('/trending', analyticsController_1.AnalyticsController.getTrendingProducts);
exports.default = router;
