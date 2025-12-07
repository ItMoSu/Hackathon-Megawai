"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// backend/src/routes/salesRoutes.ts
const express_1 = require("express");
const salesController_1 = require("../controllers/salesController");
const authMiddleware_1 = require("../middleware/authMiddleware");
const multer_1 = __importDefault(require("multer"));
const router = (0, express_1.Router)();
const upload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});
router.use(authMiddleware_1.authenticateToken);
router.post('/', salesController_1.createSalesEntry);
router.post('/bulk', salesController_1.createBulkSales);
router.post('/upload', upload.single('file'), salesController_1.uploadSalesFile);
router.get('/', salesController_1.getSalesData);
router.get('/history', salesController_1.getSalesHistory);
router.get('/:id', salesController_1.getSalesById);
router.delete('/:id', salesController_1.deleteSales);
exports.default = router;
