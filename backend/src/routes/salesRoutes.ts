// backend/src/routes/salesRoutes.ts
import { Router } from 'express';
import { 
  createSalesEntry, 
  getSalesData, 
  getSalesById, 
  deleteSales,
  createBulkSales,
  getSalesHistory,
  uploadSalesFile
} from '../controllers/salesController';
import { authenticateToken } from '../middleware/authMiddleware';
import multer from 'multer';

const router = Router();
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

router.use(authenticateToken);

router.post('/', createSalesEntry);
router.post('/bulk', createBulkSales);
router.post('/upload', upload.single('file'), uploadSalesFile);
router.get('/', getSalesData);
router.get('/history', getSalesHistory);
router.get('/:id', getSalesById);
router.delete('/:id', deleteSales);

export default router;