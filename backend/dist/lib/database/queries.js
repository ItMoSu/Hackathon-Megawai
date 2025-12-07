"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createDataset = createDataset;
exports.upsertProductsForDataset = upsertProductsForDataset;
exports.bulkUpsertSales = bulkUpsertSales;
exports.getAnalyticsOverview = getAnalyticsOverview;
exports.getProductAnalytics = getProductAnalytics;
exports.testDbConnection = testDbConnection;
exports.upsertAnalyticsResult = upsertAnalyticsResult;
exports.getSalesData = getSalesData;
exports.getLatestAnalytics = getLatestAnalytics;
exports.getTopProductsByPriority = getTopProductsByPriority;
exports.getProductsWithBurstAlerts = getProductsWithBurstAlerts;
exports.bulkUpsertDailyAnalytics = bulkUpsertDailyAnalytics;
exports.getUserProducts = getUserProducts;
const schema_1 = require("./schema");
const defaultDatasetStatus = 'pending';
const defaultStoragePath = '';
const defaultSalesSource = 'csv';
const ensureValidRange = (range) => {
    if (!range?.startDate || !range?.endDate) {
        throw new Error('Date range is required');
    }
    const startTime = range.startDate.getTime();
    const endTime = range.endDate.getTime();
    if (Number.isNaN(startTime) || Number.isNaN(endTime)) {
        throw new Error('Invalid date range provided');
    }
    if (startTime > endTime) {
        throw new Error('startDate must be before or equal to endDate');
    }
};
const ensureDatasetForUser = async (userId, datasetId) => {
    const dataset = await schema_1.prisma.datasets.findFirst({
        where: { id: datasetId, user_id: userId },
    });
    if (!dataset) {
        // Create dataset if not exists (for uploads and bulk inserts)
        const newDataset = await schema_1.prisma.datasets.create({
            data: {
                id: datasetId,
                user_id: userId,
                name: `Upload ${new Date().toLocaleDateString('id-ID')}`,
                status: 'ready',
                source_file_type: 'csv',
                source_file_name: 'upload.csv',
                storage_path: `/uploads/${userId}/${datasetId}`,
            }
        });
        return newDataset;
    }
    return dataset;
};
const ensureProductForUser = async (userId, datasetId, productId) => {
    const product = await schema_1.prisma.products.findFirst({
        where: { id: productId, dataset_id: datasetId, user_id: userId },
    });
    if (!product) {
        throw new Error('Product not found for user');
    }
    return product;
};
/**
 * Create a dataset row scoped to the provided user.
 */
async function createDataset(userId, payload) {
    try {
        if (!userId) {
            throw new Error('userId is required');
        }
        if (!payload?.name) {
            throw new Error('Dataset name is required');
        }
        const dataset = await schema_1.prisma.datasets.create({
            data: {
                user_id: userId,
                name: payload.name,
                source_file_name: payload.name,
                source_file_type: payload.sourceFileType ?? 'unknown',
                storage_path: defaultStoragePath,
                status: defaultDatasetStatus,
                error_message: null,
                rows_count: null,
            },
        });
        return dataset;
    }
    catch (error) {
        console.error('createDataset failed', error);
        throw error;
    }
}
/**
 * Upsert products within a dataset by name for the given user.
 */
async function upsertProductsForDataset(userId, datasetId, products) {
    try {
        if (!userId) {
            throw new Error('userId is required');
        }
        if (!datasetId) {
            throw new Error('datasetId is required');
        }
        if (!Array.isArray(products)) {
            throw new Error('products must be an array');
        }
        await ensureDatasetForUser(userId, datasetId);
        if (!products.length) {
            return schema_1.prisma.products.findMany({
                where: { user_id: userId, dataset_id: datasetId },
                orderBy: { name: 'asc' },
            });
        }
        const normalized = products.map((product) => {
            if (!product.name) {
                throw new Error('Product name is required');
            }
            return {
                name: product.name,
                unit: product.unit ?? 'pcs',
            };
        });
        const productInputs = new Map(normalized.map((product) => [product.name, product]));
        const productNames = Array.from(productInputs.keys());
        const existingProducts = await schema_1.prisma.products.findMany({
            where: {
                user_id: userId,
                dataset_id: datasetId,
                name: { in: productNames },
            },
        });
        const existingByName = new Map(existingProducts.map((product) => [product.name, product]));
        const operations = productNames.map((name) => {
            const product = productInputs.get(name);
            if (!product) {
                throw new Error(`Product input missing for ${name}`);
            }
            const match = existingByName.get(name);
            if (match) {
                return schema_1.prisma.products.update({
                    where: { id: match.id },
                    data: {
                        unit: product.unit,
                    },
                });
            }
            return schema_1.prisma.products.create({
                data: {
                    user_id: userId,
                    dataset_id: datasetId,
                    name: product.name,
                    unit: product.unit,
                },
            });
        });
        if (operations.length) {
            await schema_1.prisma.$transaction(operations);
        }
        return schema_1.prisma.products.findMany({
            where: { user_id: userId, dataset_id: datasetId },
            orderBy: { name: 'asc' },
        });
    }
    catch (error) {
        console.error('upsertProductsForDataset failed', error);
        throw error;
    }
}
/**
 * Bulk upsert sales rows for a dataset, creating products as needed.
 * Optimized for large datasets (30k-40k rows) with batch processing.
 */
async function bulkUpsertSales(userId, datasetId, rows) {
    try {
        if (!userId)
            throw new Error('userId is required');
        if (!datasetId)
            throw new Error('datasetId is required');
        if (!Array.isArray(rows))
            throw new Error('rows must be an array');
        if (!rows.length)
            return;
        // Quick validation (sample first 10 rows only for speed)
        const sampleSize = Math.min(10, rows.length);
        for (let i = 0; i < sampleSize; i++) {
            const row = rows[i];
            if (!row.productName)
                throw new Error('productName is required for each row');
            if (!(row.date instanceof Date) || Number.isNaN(row.date.getTime())) {
                throw new Error('date must be a valid Date');
            }
        }
        console.log(`[BulkUpsert] Starting: ${rows.length} rows`);
        const startTime = Date.now();
        // Run dataset check in parallel with product name extraction
        const [, productNames] = await Promise.all([
            ensureDatasetForUser(userId, datasetId),
            Promise.resolve(Array.from(new Set(rows.map(r => r.productName))))
        ]);
        console.log(`[BulkUpsert] Dataset + ${productNames.length} unique products: ${Date.now() - startTime}ms`);
        // 1. Get existing products in ONE query
        const existingProducts = await schema_1.prisma.products.findMany({
            where: { user_id: userId, name: { in: productNames } },
            select: { id: true, name: true, price: true } // Only select needed fields
        });
        // Build lookup map (case-insensitive)
        const productMap = new Map();
        for (const p of existingProducts) {
            const key = p.name.toLowerCase();
            if (!productMap.has(key)) {
                productMap.set(key, { id: p.id, price: p.price ? Number(p.price) : null });
            }
        }
        // 2. Create missing products in ONE query
        const missingNames = productNames.filter(n => !productMap.has(n.toLowerCase()));
        if (missingNames.length) {
            await schema_1.prisma.products.createMany({
                data: missingNames.map(name => ({ user_id: userId, dataset_id: datasetId, name })),
                skipDuplicates: true,
            });
            const newProducts = await schema_1.prisma.products.findMany({
                where: { user_id: userId, name: { in: missingNames } },
                select: { id: true, name: true, price: true }
            });
            for (const p of newProducts) {
                productMap.set(p.name.toLowerCase(), { id: p.id, price: p.price ? Number(p.price) : null });
            }
        }
        console.log(`[BulkUpsert] Products ready: ${Date.now() - startTime}ms`);
        // 3. Build sales data - use object pooling for memory efficiency
        const salesData = [];
        for (const row of rows) {
            const product = productMap.get(row.productName.toLowerCase());
            if (!product)
                continue;
            const qty = Number(row.quantity) || 0;
            salesData.push({
                user_id: userId,
                dataset_id: datasetId,
                product_id: product.id,
                sale_date: row.date,
                quantity: qty,
                revenue: (product.price || 0) * qty,
                has_promo: row.hasPromo ?? false,
                source: row.source ?? defaultSalesSource,
            });
        }
        if (!salesData.length) {
            console.log(`[BulkUpsert] No valid sales data`);
            return;
        }
        // 4. OPTIMIZED: Use raw SQL for bulk delete (much faster than Prisma OR queries)
        // Group by product_id for efficient deletion
        const productDateMap = new Map();
        for (const s of salesData) {
            const dateStr = s.sale_date.toISOString().split('T')[0];
            if (!productDateMap.has(s.product_id)) {
                productDateMap.set(s.product_id, new Set());
            }
            productDateMap.get(s.product_id).add(dateStr);
        }
        // Delete existing records per product (parallel, batched)
        const BATCH_SIZE = 5000;
        const productIds = Array.from(productDateMap.keys());
        // Delete in parallel batches
        const deletePromises = [];
        for (let i = 0; i < productIds.length; i += 50) {
            const batchProductIds = productIds.slice(i, i + 50);
            deletePromises.push(schema_1.prisma.sales.deleteMany({
                where: {
                    product_id: { in: batchProductIds },
                    user_id: userId
                }
            }));
        }
        await Promise.all(deletePromises);
        console.log(`[BulkUpsert] Deleted old records: ${Date.now() - startTime}ms`);
        // 5. Insert in batches (Prisma has limits on single query size)
        for (let i = 0; i < salesData.length; i += BATCH_SIZE) {
            const batch = salesData.slice(i, i + BATCH_SIZE);
            await schema_1.prisma.sales.createMany({
                data: batch,
                skipDuplicates: true,
            });
            if (salesData.length > BATCH_SIZE) {
                console.log(`[BulkUpsert] Inserted batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(salesData.length / BATCH_SIZE)}: ${Date.now() - startTime}ms`);
            }
        }
        console.log(`[BulkUpsert] DONE: ${salesData.length} sales in ${Date.now() - startTime}ms`);
    }
    catch (error) {
        console.error('bulkUpsertSales failed', error);
        throw error;
    }
}
/**
 * Fetch analytics overview for a dataset and date range.
 */
async function getAnalyticsOverview(userId, datasetId, range) {
    try {
        if (!userId) {
            throw new Error('userId is required');
        }
        if (!datasetId) {
            throw new Error('datasetId is required');
        }
        ensureValidRange(range);
        await ensureDatasetForUser(userId, datasetId);
        return schema_1.prisma.daily_analytics.findMany({
            where: {
                user_id: userId,
                dataset_id: datasetId,
                metric_date: {
                    gte: range.startDate,
                    lte: range.endDate,
                },
            },
            orderBy: [
                { metric_date: 'asc' },
                { priority_score: 'desc' },
            ],
            include: { products: true },
        });
    }
    catch (error) {
        console.error('getAnalyticsOverview failed', error);
        throw error;
    }
}
/**
 * Fetch analytics for a single product within a dataset and date range.
 */
async function getProductAnalytics(userId, datasetId, productId, range) {
    try {
        if (!userId) {
            throw new Error('userId is required');
        }
        if (!datasetId) {
            throw new Error('datasetId is required');
        }
        if (!productId) {
            throw new Error('productId is required');
        }
        ensureValidRange(range);
        await ensureDatasetForUser(userId, datasetId);
        await ensureProductForUser(userId, datasetId, productId);
        return schema_1.prisma.daily_analytics.findMany({
            where: {
                user_id: userId,
                dataset_id: datasetId,
                product_id: productId,
                metric_date: {
                    gte: range.startDate,
                    lte: range.endDate,
                },
            },
            orderBy: [
                { metric_date: 'asc' },
                { priority_score: 'desc' },
            ],
            include: { products: true },
        });
    }
    catch (error) {
        console.error('getProductAnalytics failed', error);
        throw error;
    }
}
async function testDbConnection() {
    await schema_1.prisma.$queryRaw `SELECT 1`;
}
/**
 * ✅ UPDATED: Upsert analytics result with enhanced ML data support
 */
async function upsertAnalyticsResult(userId, datasetId, productId, date, data) {
    try {
        if (!userId)
            throw new Error('userId is required');
        if (!productId)
            throw new Error('productId is required');
        // Normalize date to midnight
        const normalizedDate = new Date(date);
        normalizedDate.setHours(0, 0, 0, 0);
        return await schema_1.prisma.daily_analytics.upsert({
            where: {
                product_id_metric_date: {
                    product_id: productId,
                    metric_date: normalizedDate,
                },
            },
            create: {
                user_id: userId,
                dataset_id: datasetId,
                product_id: productId,
                metric_date: normalizedDate,
                actual_quantity: data.actualQty,
                burst_score: data.burstScore ?? null,
                burst_level: data.burstLevel ?? null,
                momentum_combined: data.momentumCombined ?? null,
                momentum_label: data.momentumLabel ?? null,
                priority_score: data.priorityScore ?? null,
                ai_insight: data.aiInsight ?? null,
            },
            update: {
                actual_quantity: data.actualQty,
                burst_score: data.burstScore ?? undefined,
                burst_level: data.burstLevel ?? undefined,
                momentum_combined: data.momentumCombined ?? undefined,
                momentum_label: data.momentumLabel ?? undefined,
                priority_score: data.priorityScore ?? undefined,
                ai_insight: data.aiInsight ?? undefined,
                updated_at: new Date(),
            },
        });
    }
    catch (error) {
        console.error('upsertAnalyticsResult failed', error);
        throw error;
    }
}
/**
 * Fetch aggregated sales data for a product within the last N days.
 */
async function getSalesData(userId, productId, days) {
    try {
        if (!userId) {
            throw new Error('userId is required');
        }
        if (!productId) {
            throw new Error('productId is required');
        }
        if (!days || days <= 0) {
            throw new Error('days must be positive');
        }
        const endDate = new Date();
        const startDate = new Date();
        startDate.setHours(0, 0, 0, 0);
        startDate.setDate(endDate.getDate() - (days - 1));
        const sales = await schema_1.prisma.sales.findMany({
            where: {
                user_id: userId,
                product_id: productId,
                sale_date: {
                    gte: startDate,
                    lte: endDate,
                },
            },
            select: {
                sale_date: true,
                quantity: true,
                products: { select: { name: true } },
            },
            orderBy: { sale_date: 'asc' },
        });
        const grouped = new Map();
        sales.forEach((row) => {
            const key = row.sale_date.toISOString().split('T')[0];
            const existing = grouped.get(key);
            const qty = Number(row.quantity || 0);
            if (existing) {
                grouped.set(key, {
                    ...existing,
                    quantity: existing.quantity + qty,
                    productName: existing.productName || row.products?.name,
                });
            }
            else {
                grouped.set(key, {
                    date: new Date(key),
                    quantity: qty,
                    productName: row.products?.name,
                });
            }
        });
        return Array.from(grouped.values()).sort((a, b) => a.date.getTime() - b.date.getTime());
    }
    catch (error) {
        console.error('getSalesData failed', error);
        throw error;
    }
}
/**
 * ✅ NEW: Get latest analytics for a product
 */
async function getLatestAnalytics(userId, productId) {
    try {
        if (!userId)
            throw new Error('userId is required');
        if (!productId)
            throw new Error('productId is required');
        return await schema_1.prisma.daily_analytics.findFirst({
            where: {
                user_id: userId,
                product_id: productId,
            },
            orderBy: {
                metric_date: 'desc',
            },
            include: {
                products: true,
            },
        });
    }
    catch (error) {
        console.error('getLatestAnalytics failed', error);
        throw error;
    }
}
/**
 * ✅ NEW: Get top products by priority score
 */
async function getTopProductsByPriority(userId, limit = 10, datasetId) {
    try {
        if (!userId)
            throw new Error('userId is required');
        const where = {
            user_id: userId,
            priority_score: {
                not: null,
            },
        };
        if (datasetId) {
            where.dataset_id = datasetId;
        }
        // Get latest analytics for each product
        const latestDates = await schema_1.prisma.daily_analytics.groupBy({
            by: ['product_id'],
            where,
            _max: {
                metric_date: true,
            },
        });
        const latestDateFilters = latestDates
            .map(item => ({
            product_id: item.product_id,
            metric_date: item._max.metric_date,
        }))
            .filter((item) => item.metric_date !== null);
        if (!latestDateFilters.length) {
            return [];
        }
        // Get analytics for those dates
        const analytics = await schema_1.prisma.daily_analytics.findMany({
            where: {
                user_id: userId,
                OR: latestDateFilters,
            },
            include: {
                products: true,
            },
            orderBy: {
                priority_score: 'desc',
            },
            take: limit,
        });
        return analytics;
    }
    catch (error) {
        console.error('getTopProductsByPriority failed', error);
        throw error;
    }
}
/**
 * ✅ NEW: Get products with burst alerts
 */
async function getProductsWithBurstAlerts(userId, minBurstLevel = 'HIGH', datasetId) {
    try {
        if (!userId)
            throw new Error('userId is required');
        const where = {
            user_id: userId,
            burst_level: {
                in: minBurstLevel === 'HIGH'
                    ? ['HIGH', 'CRITICAL']
                    : ['MEDIUM', 'HIGH', 'CRITICAL'],
            },
        };
        if (datasetId) {
            where.dataset_id = datasetId;
        }
        // Get latest date for each product with burst
        const latestDates = await schema_1.prisma.daily_analytics.groupBy({
            by: ['product_id'],
            where,
            _max: {
                metric_date: true,
            },
        });
        const latestDateFilters = latestDates
            .map(item => ({
            product_id: item.product_id,
            metric_date: item._max.metric_date,
        }))
            .filter((item) => item.metric_date !== null);
        if (!latestDateFilters.length) {
            return [];
        }
        // Get analytics for those dates
        const analytics = await schema_1.prisma.daily_analytics.findMany({
            where: {
                user_id: userId,
                OR: latestDateFilters,
            },
            include: {
                products: true,
            },
            orderBy: {
                burst_score: 'desc',
            },
        });
        return analytics;
    }
    catch (error) {
        console.error('getProductsWithBurstAlerts failed', error);
        throw error;
    }
}
/**
 * ✅ NEW: Bulk upsert daily analytics (for ML batch updates)
 */
async function bulkUpsertDailyAnalytics(userId, analytics) {
    try {
        if (!userId)
            throw new Error('userId is required');
        if (!Array.isArray(analytics) || analytics.length === 0) {
            return;
        }
        await schema_1.prisma.$transaction(analytics.map(item => {
            const normalizedDate = new Date(item.date);
            normalizedDate.setHours(0, 0, 0, 0);
            return schema_1.prisma.daily_analytics.upsert({
                where: {
                    product_id_metric_date: {
                        product_id: item.productId,
                        metric_date: normalizedDate,
                    },
                },
                create: {
                    user_id: userId,
                    dataset_id: item.datasetId ?? null,
                    product_id: item.productId,
                    metric_date: normalizedDate,
                    actual_quantity: item.actualQty ?? 0,
                    burst_score: item.burstScore ?? null,
                    burst_level: item.burstLevel ?? null,
                    momentum_combined: item.momentumCombined ?? null,
                    momentum_label: item.momentumLabel ?? null,
                    priority_score: item.priorityScore ?? null,
                    ai_insight: item.aiInsight ?? null,
                },
                update: {
                    actual_quantity: item.actualQty ?? undefined,
                    burst_score: item.burstScore ?? undefined,
                    burst_level: item.burstLevel ?? undefined,
                    momentum_combined: item.momentumCombined ?? undefined,
                    momentum_label: item.momentumLabel ?? undefined,
                    priority_score: item.priorityScore ?? undefined,
                    ai_insight: item.aiInsight ?? undefined,
                    updated_at: new Date(),
                },
            });
        }));
    }
    catch (error) {
        console.error('bulkUpsertDailyAnalytics failed', error);
        throw error;
    }
}
/**
 * ✅ NEW: Get products list for user (for ML processing)
 */
async function getUserProducts(userId, datasetId) {
    try {
        if (!userId)
            throw new Error('userId is required');
        const where = {
            user_id: userId,
            is_active: true,
        };
        if (datasetId) {
            where.dataset_id = datasetId;
        }
        return await schema_1.prisma.products.findMany({
            where,
            orderBy: {
                name: 'asc',
            },
        });
    }
    catch (error) {
        console.error('getUserProducts failed', error);
        throw error;
    }
}
