"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteSales = exports.getSalesById = exports.getSalesData = exports.createSalesEntry = void 0;
const schema_1 = require("../../lib/database/schema");
const queries_1 = require("../../lib/database/queries");
const intelligenceService_1 = require("../services/intelligenceService");
const burstService_1 = require("../services/burstService");
/**
 * POST /api/sales
 * Create new sales entry with AI analysis
 */
const createSalesEntry = async (req, res) => {
    try {
        const userId = req.user?.sub;
        let { product_id, sale_date, quantity, dataset_id, product_name } = req.body;
        if (!userId) {
            return res.status(401).json({
                success: false,
                error: "User tidak terotentikasi"
            });
        }
        // Validate quantity
        const qtyNumber = Number(quantity);
        if (qtyNumber < 0) {
            return res.status(400).json({
                success: false,
                error: "Quantity tidak boleh negatif"
            });
        }
        const saleDateObj = new Date(sale_date);
        // 1. Get or create dataset
        if (!dataset_id) {
            const userDataset = await schema_1.prisma.datasets.findFirst({
                where: { user_id: userId },
                orderBy: { created_at: 'desc' }
            });
            if (userDataset) {
                dataset_id = userDataset.id;
            }
            else {
                // Create default dataset for user
                const newDataset = await schema_1.prisma.datasets.create({
                    data: {
                        user_id: userId,
                        name: 'Default Dataset',
                        source_file_name: 'manual_input',
                        source_file_type: 'manual',
                        storage_path: '',
                        status: 'active'
                    }
                });
                dataset_id = newDataset.id;
            }
        }
        // 2. Upsert sales data
        await (0, queries_1.bulkUpsertSales)(userId, dataset_id, [{
                productName: product_name,
                date: saleDateObj,
                quantity: qtyNumber,
                source: 'manual'
            }]);
        // 3. Find product ID if not provided
        if (!product_id && product_name) {
            const existingProduct = await schema_1.prisma.products.findFirst({
                where: {
                    name: product_name,
                    user_id: userId
                }
            });
            if (existingProduct) {
                product_id = existingProduct.id;
            }
        }
        // 4. ✅ NEW: AI Analysis with ML Service
        let aiAnalysis = null;
        if (product_id) {
            try {
                // Get sales history
                const history = await schema_1.prisma.sales.findMany({
                    where: {
                        product_id: product_id,
                        user_id: userId
                    },
                    orderBy: { sale_date: 'desc' },
                    take: 60, // Last 60 days for better analysis
                    select: {
                        sale_date: true,
                        quantity: true
                    }
                });
                if (history.length >= 5) { // Minimum data for analysis
                    // Convert to SalesPoint format
                    const salesData = history.map(h => ({
                        date: h.sale_date,
                        quantity: Number(h.quantity),
                        productName: product_name
                    }));
                    // Get product details
                    const product = await schema_1.prisma.products.findUnique({
                        where: { id: product_id }
                    });
                    // Analyze with ML service
                    aiAnalysis = await intelligenceService_1.intelligenceService.analyzeProduct(product_id, product?.name || product_name, salesData);
                    // Update daily analytics with AI results
                    if (aiAnalysis) {
                        await (0, queries_1.upsertAnalyticsResult)(userId, dataset_id, product_id, saleDateObj, {
                            actualQty: qtyNumber,
                            burstScore: aiAnalysis.realtime.burst.score,
                            burstLevel: aiAnalysis.realtime.burst.severity,
                            momentumCombined: aiAnalysis.realtime.momentum.combined,
                            momentumLabel: aiAnalysis.realtime.momentum.status,
                            aiInsight: {
                                source: 'intelligenceService',
                                method: aiAnalysis.forecast.method,
                                confidence: aiAnalysis.confidence.overall,
                                recommendations: aiAnalysis.recommendations,
                                trend: aiAnalysis.forecast.trend
                            }
                        });
                    }
                    // ✅ Trigger burst analytics update for this date
                    await (0, burstService_1.generateBurstAnalytics)(userId, saleDateObj);
                }
            }
            catch (analysisError) {
                console.error('[SalesController] AI Analysis error:', analysisError);
                // Continue without AI analysis if it fails
            }
        }
        // 5. Response
        res.status(201).json({
            success: true,
            message: "Sales data saved successfully",
            data: {
                product_id,
                product_name,
                sale_date: saleDateObj.toISOString().split('T')[0],
                quantity: qtyNumber
            },
            ai_analysis: aiAnalysis ? {
                momentum: aiAnalysis.realtime.momentum,
                burst: aiAnalysis.realtime.burst,
                forecast_summary: aiAnalysis.forecast.summary,
                recommendations: aiAnalysis.recommendations,
                confidence: aiAnalysis.confidence.overall
            } : null
        });
    }
    catch (error) {
        console.error("[SalesController] Error:", error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : "Server Error"
        });
    }
};
exports.createSalesEntry = createSalesEntry;
/**
 * GET /api/sales
 * Get sales data (with optional filters)
 */
const getSalesData = async (req, res) => {
    try {
        const userId = req.user?.sub;
        const { product_id, start_date, end_date, limit } = req.query;
        if (!userId) {
            return res.status(401).json({
                success: false,
                error: 'User tidak terotentikasi'
            });
        }
        // Build query filters
        const where = { user_id: userId };
        if (product_id) {
            where.product_id = String(product_id);
        }
        if (start_date || end_date) {
            where.sale_date = {};
            if (start_date) {
                where.sale_date.gte = new Date(String(start_date));
            }
            if (end_date) {
                where.sale_date.lte = new Date(String(end_date));
            }
        }
        // Query sales data
        const salesData = await schema_1.prisma.sales.findMany({
            where,
            include: {
                products: {
                    select: {
                        id: true,
                        name: true,
                        unit: true,
                        price: true
                    }
                }
            },
            orderBy: { sale_date: 'desc' },
            take: limit ? parseInt(String(limit)) : 100
        });
        res.status(200).json({
            success: true,
            count: salesData.length,
            data: salesData
        });
    }
    catch (error) {
        console.error("[SalesController] Get sales error:", error);
        res.status(500).json({
            success: false,
            error: "Gagal mengambil data sales"
        });
    }
};
exports.getSalesData = getSalesData;
/**
 * GET /api/sales/:id
 * Get single sales entry
 */
const getSalesById = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user?.sub;
        if (!userId) {
            return res.status(401).json({
                success: false,
                error: 'User tidak terotentikasi'
            });
        }
        const sale = await schema_1.prisma.sales.findFirst({
            where: {
                id,
                user_id: userId
            },
            include: {
                products: true
            }
        });
        if (!sale) {
            return res.status(404).json({
                success: false,
                error: 'Sales data tidak ditemukan'
            });
        }
        res.json({
            success: true,
            data: sale
        });
    }
    catch (error) {
        console.error("[SalesController] Get sale by ID error:", error);
        res.status(500).json({
            success: false,
            error: "Gagal mengambil data sales"
        });
    }
};
exports.getSalesById = getSalesById;
/**
 * DELETE /api/sales/:id
 * Delete sales entry
 */
const deleteSales = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user?.sub;
        if (!userId) {
            return res.status(401).json({
                success: false,
                error: 'User tidak terotentikasi'
            });
        }
        // Verify ownership
        const sale = await schema_1.prisma.sales.findFirst({
            where: { id, user_id: userId }
        });
        if (!sale) {
            return res.status(404).json({
                success: false,
                error: 'Sales data tidak ditemukan'
            });
        }
        // Delete
        await schema_1.prisma.sales.delete({
            where: { id }
        });
        res.json({
            success: true,
            message: 'Sales data berhasil dihapus'
        });
    }
    catch (error) {
        console.error("[SalesController] Delete sales error:", error);
        res.status(500).json({
            success: false,
            error: "Gagal menghapus data sales"
        });
    }
};
exports.deleteSales = deleteSales;
