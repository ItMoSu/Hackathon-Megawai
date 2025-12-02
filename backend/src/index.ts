import express from 'express'
import dotenv from 'dotenv'
import cors from 'cors';
import productRoutes from './routes/productRoutes';
import salesRoutes from './routes/salesRoutes';
import authRoutes from './routes/authRoutes';
import intelligenceRoutes from './routes/intelligenceRoutes';
import analyticsRoutes from './routes/analyticsRoutes';
import { optionalAuth } from '../lib/auth/middleware';

dotenv.config()

const app = express()
const PORT = process.env.PORT || 5000

app.use(cors({
  origin: true, 
  credentials: true, 
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(optionalAuth); 

app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes); 
app.use('/api/sales', salesRoutes);
app.use('/api/intelligence', intelligenceRoutes);
app.use('/api/analytics', analyticsRoutes);

app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Backend is running!',
    timestamp: new Date().toISOString()
  })
})

app.listen(PORT, () => {
  console.log(`🚀 Backend running on http://localhost:${PORT}`)
})
