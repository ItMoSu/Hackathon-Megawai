"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadLimiter = exports.authLimiter = void 0;
const express_1 = __importDefault(require("express"));
const dotenv_1 = __importDefault(require("dotenv"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const productRoutes_1 = __importDefault(require("./routes/productRoutes"));
const salesRoutes_1 = __importDefault(require("./routes/salesRoutes"));
const authRoutes_1 = __importDefault(require("./routes/authRoutes"));
const reportRoutes_1 = __importDefault(require("./routes/reportRoutes"));
const intelligenceRoutes_1 = __importDefault(require("./routes/intelligenceRoutes"));
const analyticsRoutes_1 = __importDefault(require("./routes/analyticsRoutes"));
const middleware_1 = require("../lib/auth/middleware");
const logger_1 = require("./middleware/logger");
const schema_1 = require("../lib/database/schema");
dotenv_1.default.config();
// Warmup database connection on cold start
(0, schema_1.warmupConnection)().catch(console.error);
const app = (0, express_1.default)();
const PORT = process.env.PORT || 5000;
// Trust proxy (required for Vercel/reverse proxy)
app.set('trust proxy', 1);
// Security headers
app.use((0, helmet_1.default)({
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
const generalLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // 100 requests per windowMs
    message: { error: 'Too many requests, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
});
// Rate limiting - Auth (stricter)
const authLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // 10 requests per windowMs for auth
    message: { error: 'Too many authentication attempts, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
});
exports.authLimiter = authLimiter;
// Rate limiting - Upload (moderate)
const uploadLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 20, // 20 uploads per hour
    message: { error: 'Upload limit reached, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
});
exports.uploadLimiter = uploadLimiter;
app.use(generalLimiter);
// CORS configuration - FIXED: Properly reject unauthorized origins
const allowedOrigins = process.env.FRONTEND_URL
    ? [process.env.FRONTEND_URL.replace(/\/$/, ''), 'http://localhost:3000']
    : ['http://localhost:3000'];
app.use((0, cors_1.default)({
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
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
// Add cache headers for API responses
app.use('/api', (req, res, next) => {
    // Cache GET requests for 30 seconds (stale-while-revalidate for 60s)
    if (req.method === 'GET') {
        res.set('Cache-Control', 'public, max-age=30, stale-while-revalidate=60');
    }
    next();
});
// Request logging
app.use(logger_1.requestLogger);
// Auth middleware
app.use(middleware_1.optionalAuth);
app.use('/api/auth', authRoutes_1.default);
app.use('/api/products', productRoutes_1.default);
app.use('/api/sales', salesRoutes_1.default);
app.use('/api/intelligence', intelligenceRoutes_1.default);
app.use('/api/analytics', analyticsRoutes_1.default);
app.use('/api/reports', reportRoutes_1.default);
app.get('/health', async (req, res) => {
    const dbStatus = await (0, schema_1.checkConnection)();
    res.json({
        status: dbStatus.ok ? 'OK' : 'DEGRADED',
        message: 'Backend is running!',
        timestamp: new Date().toISOString(),
        database: dbStatus,
        routes: ['/api/products', '/api/products/ranking', '/api/products/:id']
    });
});
// Error handling middleware (must be last)
app.use(logger_1.errorLogger);
// For local development
if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => {
        console.log(`Backend running on port ${PORT}`);
    });
}
// Export for Vercel
exports.default = app;
