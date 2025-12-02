import express from 'express';
import { requireAuth } from '../../lib/auth/middleware';
import { getSalesData } from '../../lib/database/queries';
import { calculateMomentum } from '../../lib/analytics/momentum';

const router = express.Router();

router.use(requireAuth);

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

    // Fetch sales data for the last 90 days (sufficient for 30-day window + lag)
    const sales = await getSalesData(String(userId), productId, 90);

    if (!sales.length) {
      return res.status(400).json({
        success: false,
        error: 'No sales data found for this product',
      });
    }

    // Map database results to SalesData format required by the analytics engine
    const salesData = sales.map((row) => ({
      date: row.date,    
      value: row.quantity,
    }));

    // Calculate momentum using the weighted EMA formula
    const result = calculateMomentum(productId, salesData);

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