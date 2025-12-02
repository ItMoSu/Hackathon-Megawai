import express from 'express';
import { requireAuth } from '../../lib/auth/middleware';
import { getSalesData } from '../../lib/database/queries';
import { prisma } from '../../lib/database/schema';
import { intelligenceService } from '../services/intelligenceService';

const router = express.Router();

router.use(requireAuth);

router.get('/analyze/:productId', async (req, res) => {
  try {
    const userId = req.user?.sub;
    const { productId } = req.params;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'User tidak terotentikasi' });
    }

    const product = await prisma.products.findFirst({
      where: { id: productId, user_id: String(userId) },
      select: { id: true, name: true },
    });

    if (!product) {
      return res.status(404).json({ success: false, error: 'Produk tidak ditemukan' });
    }

    const salesData = await getSalesData(String(userId), productId, 90);

    if (!salesData.length) {
      return res.status(400).json({ success: false, error: 'Belum ada data penjualan untuk produk ini' });
    }

    const intelligence = await intelligenceService.analyzeProduct(
      productId,
      product.name,
      salesData,
    );

    if (salesData.length < 30) {
      intelligence.forecast.summary = 'Data < 30 hari, menggunakan fallback rule-based';
    }

    return res.json({ success: true, data: intelligence });
  } catch (error) {
    console.error('analyze route error:', error);
    return res.status(500).json({
      success: false,
      error: 'Gagal melakukan analisis intelijen',
    });
  }
});

router.post('/train/:productId', async (req, res) => {
  try {
    const userId = req.user?.sub;
    const { productId } = req.params;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'User tidak terotentikasi' });
    }

    const salesData = await getSalesData(String(userId), productId, 90);
    if (salesData.length < 30) {
      return res.status(400).json({
        success: false,
        error: 'Minimal 30 hari data diperlukan untuk melatih model',
      });
    }

    await intelligenceService.trainModel(productId, salesData);

    return res.json({ success: true, message: 'Training model berhasil dijalankan' });
  } catch (error) {
    console.error('train route error:', error);
    return res.status(500).json({ success: false, error: 'Gagal melatih model' });
  }
});

export default router;
