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
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 5000;
app.use((0, cors_1.default)({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express_1.default.json());
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
        timestamp: new Date().toISOString()
    });
});
app.listen(PORT, () => {
    console.log(`🚀 Backend running on http://localhost:${PORT}`);
});
