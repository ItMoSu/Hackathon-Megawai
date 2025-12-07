"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const productController_1 = require("../controllers/productController");
const middleware_1 = require("../../lib/auth/middleware");
const schema_1 = require("../../lib/database/schema");
const router = express_1.default.Router();
// SECURITY FIX: Internal endpoint now requires auth and API key
// Used for batch training/scripts - requires both authentication AND internal API key
router.get('/internal/list', middleware_1.requireAuth, async (req, res) => {
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
        const products = await schema_1.prisma.products.findMany({
            where: { user_id: userId },
            select: {
                id: true,
                name: true,
                unit: true,
                is_active: true,
            }
        });
        res.json({ success: true, products });
    }
    catch (error) {
        console.error('Internal list error:', error);
        res.status(500).json({ error: 'Failed to fetch products' });
    }
});
// Apply auth middleware to all routes below
router.use(middleware_1.requireAuth);
// Specific routes MUST come before /:id (order matters!)
router.get('/trend', productController_1.getProductTrend);
router.get('/ranking', productController_1.getProductsWithRanking);
// Public endpoint
router.get('/', productController_1.getProducts);
// Dynamic routes (must be last)
router.get('/:id', productController_1.getProductDetail);
router.post('/', productController_1.createProduct);
router.put('/:id', productController_1.updateProduct);
router.delete('/:id', productController_1.deleteProduct);
exports.default = router;
