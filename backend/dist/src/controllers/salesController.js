"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadSalesFile = exports.getSalesHistory = exports.createBulkSales = exports.deleteSales = exports.getSalesById = exports.getSalesData = exports.createSalesEntry = void 0;
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
            // dataset khusus untuk manual input
            let targetDataset = await schema_1.prisma.datasets.findFirst({
                where: {
                    user_id: userId,
                    source_file_type: 'csv'
                }
            });
            if (targetDataset) {
                dataset_id = targetDataset.id;
            }
            else {
                const newDataset = await schema_1.prisma.datasets.create({
                    data: {
                        user_id: userId,
                        name: 'Manual_Input_Sales',
                        source_file_name: 'manual_entry',
                        source_file_type: 'csv',
                        storage_path: '',
                        status: 'ready'
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
                source: 'csv'
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
/**
 * POST /api/sales/bulk
 * Bulk create sales entries for multiple products at once
 */
const createBulkSales = async (req, res) => {
    try {
        const userId = req.user?.sub;
        const { sale_date, entries } = req.body;
        if (!userId) {
            return res.status(401).json({
                success: false,
                error: "User tidak terotentikasi"
            });
        }
        if (!entries || !Array.isArray(entries) || entries.length === 0) {
            return res.status(400).json({
                success: false,
                error: "Entries harus berupa array dan tidak boleh kosong"
            });
        }
        const saleDateObj = new Date(sale_date);
        // Get or create dataset
        let targetDataset = await schema_1.prisma.datasets.findFirst({
            where: {
                user_id: userId,
                source_file_type: 'csv'
            }
        });
        let dataset_id;
        if (targetDataset) {
            dataset_id = targetDataset.id;
        }
        else {
            const newDataset = await schema_1.prisma.datasets.create({
                data: {
                    user_id: userId,
                    name: 'Manual_Input_Sales',
                    source_file_name: 'manual_entry',
                    source_file_type: 'csv',
                    storage_path: '',
                    status: 'ready'
                }
            });
            dataset_id = newDataset.id;
        }
        // Filter entries with quantity > 0
        const validEntries = entries.filter((e) => e.quantity > 0);
        if (validEntries.length === 0) {
            return res.status(400).json({
                success: false,
                error: "Tidak ada produk dengan quantity > 0"
            });
        }
        // Prepare bulk upsert data
        const salesData = validEntries.map((entry) => ({
            productName: entry.product_name,
            date: saleDateObj,
            quantity: Number(entry.quantity),
            source: 'csv'
        }));
        // Bulk upsert
        await (0, queries_1.bulkUpsertSales)(userId, dataset_id, salesData);
        // Run AI analysis for each product (async, don't block response)
        const analysisPromises = validEntries.map(async (entry) => {
            try {
                const product = await schema_1.prisma.products.findFirst({
                    where: { id: entry.product_id, user_id: userId }
                });
                if (!product)
                    return null;
                const history = await schema_1.prisma.sales.findMany({
                    where: {
                        product_id: entry.product_id,
                        user_id: userId
                    },
                    orderBy: { sale_date: 'desc' },
                    take: 60
                });
                if (history.length >= 5) {
                    const salesHistory = history.map(h => ({
                        date: h.sale_date,
                        quantity: Number(h.quantity),
                        productName: product.name
                    }));
                    const analysis = await intelligenceService_1.intelligenceService.analyzeProduct(product.id, product.name, salesHistory);
                    if (analysis) {
                        await (0, queries_1.upsertAnalyticsResult)(userId, dataset_id, product.id, saleDateObj, {
                            actualQty: Number(entry.quantity),
                            burstScore: analysis.realtime.burst.score,
                            burstLevel: analysis.realtime.burst.severity,
                            momentumCombined: analysis.realtime.momentum.combined,
                            momentumLabel: analysis.realtime.momentum.status,
                            aiInsight: {
                                source: 'intelligenceService',
                                method: analysis.forecast.method,
                                confidence: analysis.confidence.overall,
                                trend: analysis.forecast.trend
                            }
                        });
                    }
                }
            }
            catch (err) {
                console.error(`[BulkSales] Analysis error for ${entry.product_id}:`, err);
            }
        });
        // Don't await all analysis - let them run in background
        Promise.all(analysisPromises).catch(console.error);
        // Trigger burst analytics
        (0, burstService_1.generateBurstAnalytics)(userId, saleDateObj).catch(console.error);
        res.status(201).json({
            success: true,
            message: `${validEntries.length} produk berhasil disimpan`,
            data: {
                sale_date: saleDateObj.toISOString().split('T')[0],
                products_saved: validEntries.length,
                entries: validEntries.map((e) => ({
                    product_id: e.product_id,
                    product_name: e.product_name,
                    quantity: e.quantity
                }))
            }
        });
    }
    catch (error) {
        console.error("[SalesController] Bulk create error:", error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : "Server Error"
        });
    }
};
exports.createBulkSales = createBulkSales;
/**
 * GET /api/sales/history
 * Get recent sales history for display
 */
const getSalesHistory = async (req, res) => {
    try {
        const userId = req.user?.sub;
        const limit = Math.min(Number(req.query.limit) || 20, 100);
        if (!userId) {
            return res.status(401).json({ success: false, error: "User tidak terotentikasi" });
        }
        const sales = await schema_1.prisma.sales.findMany({
            where: {
                products: {
                    user_id: String(userId)
                }
            },
            include: {
                products: {
                    select: { name: true }
                }
            },
            orderBy: { sale_date: 'desc' },
            take: limit
        });
        const history = sales.map(s => ({
            date: s.sale_date.toISOString().split('T')[0],
            product_name: s.products?.name || 'Unknown',
            quantity: Number(s.quantity)
        }));
        res.json({ success: true, data: history });
    }
    catch (error) {
        console.error("[SalesController] History error:", error);
        res.status(500).json({ success: false, error: "Gagal mengambil riwayat" });
    }
};
exports.getSalesHistory = getSalesHistory;
/**
 * POST /api/sales/upload
 * Upload Excel/CSV/Word file for bulk sales import
 */
const uploadSalesFile = async (req, res) => {
    try {
        const userId = req.user?.sub;
        const file = req.file;
        if (!userId) {
            return res.status(401).json({ success: false, error: "User tidak terotentikasi" });
        }
        if (!file) {
            return res.status(400).json({ success: false, error: "File tidak ditemukan" });
        }
        const fileName = file.originalname.toLowerCase();
        let parsedData = [];
        // Parse based on file type
        if (fileName.endsWith('.csv')) {
            parsedData = parseCSV(file.buffer.toString('utf-8'));
        }
        else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
            // For Excel files, we'd need xlsx library - for now return error
            return res.status(400).json({
                success: false,
                error: "Upload Excel akan segera tersedia. Gunakan CSV untuk saat ini."
            });
        }
        else if (fileName.endsWith('.docx')) {
            return res.status(400).json({
                success: false,
                error: "Upload Word akan segera tersedia. Gunakan CSV untuk saat ini."
            });
        }
        else {
            return res.status(400).json({ success: false, error: "Format file tidak didukung" });
        }
        if (parsedData.length === 0) {
            return res.status(400).json({ success: false, error: "Tidak ada data valid dalam file" });
        }
        // Get sale_date from request or use today
        const defaultDate = req.body.sale_date || new Date().toISOString().split('T')[0];
        // Convert to bulk upsert format - date must be Date object
        const rows = parsedData.map(item => {
            const dateStr = item.date || defaultDate;
            const dateObj = new Date(dateStr + 'T00:00:00');
            return {
                productName: item.productName,
                quantity: item.quantity,
                date: dateObj
            };
        }).filter(row => !isNaN(row.date.getTime())); // Filter invalid dates
        if (rows.length === 0) {
            return res.status(400).json({ success: false, error: "Tidak ada data valid dengan tanggal yang benar" });
        }
        // Return immediately, process in background
        const { randomUUID } = require('crypto');
        const uploadDatasetId = randomUUID();
        const userIdStr = String(userId);
        const rowCount = rows.length;
        // Send response FIRST
        res.json({
            success: true,
            message: `Memproses ${rowCount} data di background...`,
            processed: rowCount
        });
        // Process in background (after response sent)
        setImmediate(async () => {
            try {
                console.log(`[Upload] Background processing ${rowCount} rows for user ${userIdStr}`);
                await (0, queries_1.bulkUpsertSales)(userIdStr, uploadDatasetId, rows);
                console.log(`[Upload] Background done: ${rowCount} rows`);
            }
            catch (err) {
                console.error(`[Upload] Background error:`, err);
            }
        });
    }
    catch (error) {
        console.error("[SalesController] Upload error:", error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : "Gagal memproses file"
        });
    }
};
exports.uploadSalesFile = uploadSalesFile;
// Helper function to parse CSV - supports multiple formats
function parseCSV(content) {
    const lines = content.split('\n').filter(line => line.trim());
    const result = [];
    if (lines.length === 0)
        return result;
    // Detect header and column positions
    const header = lines[0].toLowerCase();
    let startIndex = 0;
    let colMap = { product: 0, quantity: 1, date: -1 };
    // Check if first line is header
    const isHeader = header.includes('tanggal') || header.includes('produk') ||
        header.includes('product') || header.includes('nama') ||
        header.includes('qty') || header.includes('menu');
    if (isHeader) {
        startIndex = 1;
        const headerCols = lines[0].split(',').map(c => c.trim().toLowerCase().replace(/"/g, ''));
        // Find column indices dynamically
        headerCols.forEach((col, idx) => {
            if (col.includes('nama') || col.includes('produk') || col.includes('product') || col.includes('menu')) {
                colMap.product = idx;
            }
            if (col.includes('qty') || col.includes('quantity') || col.includes('jumlah') || col.includes('terjual')) {
                colMap.quantity = idx;
            }
            if (col.includes('tanggal') || col.includes('date') || col.includes('tgl')) {
                colMap.date = idx;
            }
        });
    }
    for (let i = startIndex; i < lines.length; i++) {
        const cols = lines[i].split(',').map(c => c.trim().replace(/"/g, ''));
        if (cols.length >= 2) {
            const productName = cols[colMap.product] || '';
            const quantity = parseInt(cols[colMap.quantity], 10);
            let date = undefined;
            // Get date if available
            if (colMap.date >= 0 && cols[colMap.date]) {
                const rawDate = cols[colMap.date];
                // Parse various date formats
                const parsed = parseFlexibleDate(rawDate);
                if (parsed)
                    date = parsed;
            }
            if (productName && !isNaN(quantity) && quantity >= 0) {
                result.push({ productName, quantity, date });
            }
        }
    }
    return result;
}
// Parse various date formats to YYYY-MM-DD
function parseFlexibleDate(dateStr) {
    if (!dateStr)
        return undefined;
    // Try different date formats
    const formats = [
        // YYYY-MM-DD
        /^(\d{4})-(\d{1,2})-(\d{1,2})$/,
        // DD-MM-YYYY or DD/MM/YYYY
        /^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/,
        // MM-DD-YYYY or MM/DD/YYYY
        /^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/,
    ];
    // YYYY-MM-DD format
    let match = dateStr.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (match) {
        const [_, y, m, d] = match;
        return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
    // DD-MM-YYYY or DD/MM/YYYY format
    match = dateStr.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})/);
    if (match) {
        const [_, d, m, y] = match;
        return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
    // Try native Date parsing as fallback
    try {
        const d = new Date(dateStr);
        if (!isNaN(d.getTime())) {
            return d.toISOString().split('T')[0];
        }
    }
    catch { }
    return undefined;
}
