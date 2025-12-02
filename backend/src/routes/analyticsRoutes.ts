import express from 'express';
import { getDashboardSummary } from '../controllers/analyticsController';
import { requireAuth } from '../../lib/auth/middleware';

const router = express.Router();

router.use(requireAuth);

router.get('/analytics/summary', getDashboardSummary);

export default router;
