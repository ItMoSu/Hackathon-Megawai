import express from 'express';
import { getProducts, createProduct, getProductTrend } from '../controllers/productController';
import { requireAuth } from '../../lib/auth/middleware';
import { prisma } from '../../lib/database/schema';

const router = express.Router();

// Internal endpoint (no auth) for batch training/scripts
router.get('/internal/list', async (_req, res) => {
  try {
    const products = await prisma.products.findMany();
    res.json({ success: true, products });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// Public endpoint
router.get('/', getProducts);

// Protected routes
router.use(requireAuth);
router.get('/trend', getProductTrend);
router.post('/', createProduct);

export default router;
