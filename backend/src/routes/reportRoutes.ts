import express from 'express';
import { getWeeklyReport } from '../controllers/reportController';
import { requireAuth } from '../../lib/auth/middleware';

const router = express.Router();

router.use(requireAuth); 

router.get('/weekly', getWeeklyReport);

export default router;