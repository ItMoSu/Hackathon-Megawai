import express from 'express'
import dotenv from 'dotenv'
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import productRoutes from './routes/productRoutes';
import salesRoutes from './routes/salesRoutes';
import authRoutes from './routes/authRoutes';
import reportRoutes from './routes/reportRoutes';
import intelligenceRoutes from './routes/intelligenceRoutes';
import analyticsRoutes from './routes/analyticsRoutes';
import { optionalAuth } from '../lib/auth/middleware';
import { requestLogger, errorLogger } from './middleware/logger';
import { warmupConnection, checkConnection } from '../lib/database/schema';

dotenv.config()

// Warmup database connection on cold start
warmupConnection().catch(console.error)

const app = express()
const PORT = process.env.PORT || 5000

// Trust proxy (required for Vercel/reverse proxy)
app.set('trust proxy', 1)

// Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

// Rate limiting - General
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per windowMs
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiting - Auth (stricter)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 requests per windowMs for auth
  message: { error: 'Too many authentication attempts, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiting - Upload (moderate)
const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // 20 uploads per hour
  message: { error: 'Upload limit reached, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(generalLimiter);

// CORS configuration - FIXED: Properly reject unauthorized origins
const allowedOrigins = process.env.FRONTEND_URL
  ? [process.env.FRONTEND_URL.replace(/\/$/, ''), 'http://localhost:3000']
  : ['http://localhost:3000'];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (health checks, Postman, curl, etc)
    if (!origin) {
      return callback(null, true);
    }

    // Check if origin is in allowed list
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    // In development, allow all origins for easier testing
    if (process.env.NODE_ENV !== 'production') {
      return callback(null, true);
    }

    // In production, reject unauthorized origins
    return callback(new Error('Not allowed by CORS'), false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body parser with size limit
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Add cache headers for API responses
app.use('/api', (req, res, next) => {
  // Cache GET requests for 30 seconds (stale-while-revalidate for 60s)
  if (req.method === 'GET') {
    res.set('Cache-Control', 'public, max-age=30, stale-while-revalidate=60');
  }
  next();
});

// Request logging
app.use(requestLogger);

// Auth middleware
app.use(optionalAuth);

// Export limiters for use in routes
export { authLimiter, uploadLimiter }; 

app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes); 
app.use('/api/sales', salesRoutes);
app.use('/api/intelligence', intelligenceRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/reports', reportRoutes);

app.get('/health', async (req, res) => {
  const dbStatus = await checkConnection()
  res.json({ 
    status: dbStatus.ok ? 'OK' : 'DEGRADED', 
    message: 'Backend is running!',
    timestamp: new Date().toISOString(),
    database: dbStatus,
    routes: ['/api/products', '/api/products/ranking', '/api/products/:id']
  })
})

// Error handling middleware (must be last)
app.use(errorLogger);

// For local development
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`Backend running on port ${PORT}`)
  })
}

// Export for Vercel
export default app;
