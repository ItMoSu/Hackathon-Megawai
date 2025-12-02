import express from 'express';
import { requireAuth } from '../../lib/auth/middleware';
import { getSalesData } from '../../lib/database/queries';
import { summarizeProductMomentum } from '../../lib/analytics/momentum';

const router = express.Router();

router.use(requireAuth);

router.get('/momentum', async (req, res) => {
  try {
    const userId = req.user?.sub;
    const { productId } = req.query;

    if (!userId) {
      return res
        .status(401)
        .json({ success: false, error: 'User tidak terotentikasi' });
    }

    if (!productId || typeof productId !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'parameter productId wajib diisi',
      });
    }

    // Ambil data penjualan maksimal 90 hari terakhir, cukup untuk window 7/14/30 hari.
    const sales = await getSalesData(String(userId), productId, 90);

    if (!sales.length) {
      return res.status(400).json({
        success: false,
        error: 'Belum ada data penjualan untuk produk ini',
      });
    }

    const series = sales.map((row) => ({
      date: row.date,
      value: row.quantity,
    }));

    const momentum = summarizeProductMomentum({
      productId,
      productName: sales[0]?.productName,
      series,
      windows: [7, 14, 30],
    });

    if (!momentum) {
      return res.status(400).json({
        success: false,
        error: 'Data tidak cukup untuk menghitung momentum',
      });
    }

    return res.json({
      success: true,
      data: momentum,
    });
  } catch (error) {
    console.error('GET /api/analytics/momentum error:', error);
    return res.status(500).json({
      success: false,
      error: 'Gagal menghitung momentum produk',
    });
  }
});

export default router;


