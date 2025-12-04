"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// backend/src/routes/salesRoutes.ts
const express_1 = require("express");
const salesController_1 = require("../controllers/salesController");
const authMiddleware_1 = require("../middleware/authMiddleware");
const router = (0, express_1.Router)();
router.use(authMiddleware_1.authenticateToken);
router.post('/', salesController_1.createSalesEntry);
router.get('/', salesController_1.getSalesData);
router.get('/:id', salesController_1.getSalesById);
router.delete('/:id', salesController_1.deleteSales);
exports.default = router;
