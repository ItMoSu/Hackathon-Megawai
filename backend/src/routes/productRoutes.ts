import express from 'express';
import { getProducts, createProduct, getProductTrend, updateProduct, getProductsWithRanking, getProductDetail, deleteProduct } from '../controllers/productController';
import { requireAuth } from '../../lib/auth/middleware';
import { prisma } from '../../lib/database/schema';

const router = express.Router();

// SECURITY FIX: Internal endpoint now requires auth and API key
// Used for batch training/scripts - requires both authentication AND internal API key
router.get('/internal/list', requireAuth, async (req, res) => {
  try {
    // Verify internal API key for additional security
    const internalKey = req.headers['x-internal-api-key'];
    if (!internalKey || internalKey !== process.env.INTERNAL_API_KEY) {
      return res.status(403).json({ error: 'Forbidden: Invalid or missing internal API key' });
    }

    // Only return products for the authenticated user
    const userId = req.user?.sub;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const products = await prisma.products.findMany({
      where: { user_id: userId },
      select: {
        id: true,
        name: true,
        unit: true,
        is_active: true,
      }
    });
    res.json({ success: true, products });
  } catch (error) {
    console.error('Internal list error:', error);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// Apply auth middleware to all routes below
router.use(requireAuth);

// Specific routes MUST come before /:id (order matters!)
router.get('/trend', getProductTrend);
router.get('/ranking', getProductsWithRanking);

// Public endpoint
router.get('/', getProducts);

// Dynamic routes (must be last)
router.get('/:id', getProductDetail);
router.post('/', createProduct);
router.put('/:id', updateProduct);
router.delete('/:id', deleteProduct);

export default router;
