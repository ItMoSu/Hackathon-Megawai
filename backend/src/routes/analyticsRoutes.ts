import express from 'express';
import { requireAuth } from '../../lib/auth/middleware';
import { getSalesData } from '../../lib/database/queries';
// Update import ke fungsi baru
import { calculateMomentum } from '../../lib/analytics/momentum';
import { triggerBurstAnalysis } from '../controllers/analyticsController';

const router = express.Router();

router.use(requireAuth);
router.get('/burst', triggerBurstAnalysis);

// GET /api/analytics/momentum?productId=...
router.get('/momentum', async (req, res) => {
  try {
    const userId = req.user?.sub;
    const { productId } = req.query;

    if (!userId) {
      return res
        .status(401)
        .json({ success: false, error: 'User not authenticated' });
    }

    if (!productId || typeof productId !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'productId parameter is required',
      });
    }

    // Ambil data penjualan 90 hari terakhir (cukup untuk window 30 hari + lag)
    const sales = await getSalesData(String(userId), productId, 90);

    if (!sales.length) {
      return res.status(400).json({
        success: false,
        error: 'No sales data found for this product',
      });
    }

    // Mapping data database ke format SalesData yang diminta momentum.ts
    // (date: string | Date, value: number)
    const salesData = sales.map((row) => ({
      date: row.date,    // Pastikan ini Date object atau ISO string
      value: row.quantity,
    }));

    // Panggil fungsi BARU: calculateMomentum
    const result = calculateMomentum(productId, salesData);

    // Kirim response
    return res.json({
      success: true,
      data: result,
    });

  } catch (error) {
    console.error('GET /api/analytics/momentum error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to calculate product momentum',
    });
  }
});

export default router;