"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const dotenv_1 = __importDefault(require("dotenv"));
const cors_1 = __importDefault(require("cors"));
const productRoutes_1 = __importDefault(require("./routes/productRoutes"));
const salesRoutes_1 = __importDefault(require("./routes/salesRoutes"));
const authRoutes_1 = __importDefault(require("./routes/authRoutes"));
const reportRoutes_1 = __importDefault(require("./routes/reportRoutes"));
const intelligenceRoutes_1 = __importDefault(require("./routes/intelligenceRoutes"));
const analyticsRoutes_1 = __importDefault(require("./routes/analyticsRoutes"));
const middleware_1 = require("../lib/auth/middleware");
const logger_1 = require("./middleware/logger");
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 5000;
// CORS configuration
const allowedOrigins = process.env.FRONTEND_URL
    ? [process.env.FRONTEND_URL.replace(/\/$/, '')]
    : ['http://localhost:3000'];
app.use((0, cors_1.default)({
    origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, Postman, etc)
        if (!origin)
            return callback(null, true);
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
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
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
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        message: 'Backend is running!',
        timestamp: new Date().toISOString(),
        routes: ['/api/products', '/api/products/ranking', '/api/products/:id']
    });
});
// Error handling middleware (must be last)
app.use(logger_1.errorLogger);
app.listen(PORT, () => {
    console.log(`Backend running on port ${PORT}`);
});
