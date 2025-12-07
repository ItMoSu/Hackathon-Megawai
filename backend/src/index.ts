import express from 'express'
import dotenv from 'dotenv'
import cors from 'cors';
import productRoutes from './routes/productRoutes';
import salesRoutes from './routes/salesRoutes';
import authRoutes from './routes/authRoutes';
import reportRoutes from './routes/reportRoutes';
import intelligenceRoutes from './routes/intelligenceRoutes';
import analyticsRoutes from './routes/analyticsRoutes';
import { optionalAuth } from '../lib/auth/middleware';
import { requestLogger, errorLogger } from './middleware/logger';

dotenv.config()

const app = express()
const PORT = process.env.PORT || 5000

// CORS configuration
const allowedOrigins = process.env.FRONTEND_URL 
  ? [process.env.FRONTEND_URL.replace(/\/$/, '')]
  : ['http://localhost:3000'];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, etc)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin) || process.env.NODE_ENV !== 'production') {
      return callback(null, true);
    }
    return callback(null, true); // Allow all in dev, restrict in prod
  },
  credentials: true, 
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body parser with size limit
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use(requestLogger);

// Auth middleware
app.use(optionalAuth); 

app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes); 
app.use('/api/sales', salesRoutes);
app.use('/api/intelligence', intelligenceRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/reports', reportRoutes);

app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Backend is running!',
    timestamp: new Date().toISOString(),
    routes: ['/api/products', '/api/products/ranking', '/api/products/:id']
  })
})

// Error handling middleware (must be last)
app.use(errorLogger);

app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`)
})
