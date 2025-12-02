import express from 'express';
import { getProducts, createProduct, getProductTrend } from '../controllers/productController';
import { requireAuth } from '../../lib/auth/middleware';

const router = express.Router();

router.use(requireAuth);

router.get('/', getProducts);
router.get('/trend', getProductTrend);

router.post('/', createProduct);

export default router;
