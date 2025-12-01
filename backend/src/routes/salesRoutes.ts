import express from 'express';
import { createSalesEntry } from '../controllers/salesController';

const router = express.Router();

router.post('/', createSalesEntry); 

export default router;