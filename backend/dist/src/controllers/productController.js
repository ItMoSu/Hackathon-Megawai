"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getProductTrend = exports.createProduct = exports.getProducts = void 0;
const schema_1 = require("../../lib/database/schema");
const allowedTrendRanges = new Set([7, 14, 30, 60, 90]);
function toStartOfDay(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
}
function toEndOfDay(date) {
    const d = new Date(date);
    d.setHours(23, 59, 59, 999);
    return d;
}
function formatDate(date) {
    return date.toISOString().split('T')[0];
}
const getProducts = async (req, res) => {
    try {
        const userId = req.user?.sub;
        if (!userId) {
            return res.status(401).json({ error: "User tidak terotentikasi" });
        }
        const products = await schema_1.prisma.products.findMany({
            where: { user_id: String(userId) },
            orderBy: { created_at: 'desc' }
        });
        res.json({ success: true, data: products });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: "Gagal mengambil data produk" });
    }
};
exports.getProducts = getProducts;
const createProduct = async (req, res) => {
    try {
        const userId = req.user?.sub;
        const { name, unit } = req.body;
        if (!userId) {
            return res.status(401).json({ error: "User tidak terotentikasi" });
        }
        if (!name) {
            return res.status(400).json({ error: "Nama Produk wajib diisi" });
        }
        const existing = await schema_1.prisma.products.findFirst({
            where: { user_id: userId, name }
        });
        if (existing) {
            return res.status(400).json({ error: "Produk dengan nama ini sudah ada" });
        }
        const newProduct = await schema_1.prisma.products.create({
            data: {
                user_id: userId,
                name,
                unit: unit || 'pcs',
                is_active: true,
                dataset_id: null
            }
        });
        res.status(201).json({ success: true, data: newProduct });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: "Gagal menyimpan produk" });
    }
};
exports.createProduct = createProduct;
const getProductTrend = async (req, res) => {
    try {
        const userId = req.user?.sub;
        const productId = typeof req.query.productId === 'string' ? req.query.productId : undefined;
        const daysParam = Number(req.query.days);
        const days = allowedTrendRanges.has(daysParam) ? daysParam : 30;
        if (!userId) {
            return res.status(401).json({ error: "User tidak terotentikasi" });
        }
        if (!req.query.days) {
            // still allow default but clarify to client
            console.warn('days param tidak diberikan, default 30 digunakan');
        }
        const endDate = toEndOfDay(new Date());
        const startDate = toStartOfDay(new Date());
        startDate.setDate(endDate.getDate() - (days - 1));
        let productName;
        if (productId) {
            const product = await schema_1.prisma.products.findFirst({
                where: { id: productId, user_id: String(userId) },
                select: { id: true, name: true },
            });
            if (!product) {
                return res.status(404).json({ error: "Produk tidak ditemukan" });
            }
            productName = product.name;
        }
        const sales = await schema_1.prisma.sales.findMany({
            where: {
                user_id: String(userId),
                ...(productId ? { product_id: productId } : {}),
                sale_date: {
                    gte: startDate,
                    lte: endDate,
                },
            },
            select: {
                sale_date: true,
                quantity: true,
                product_id: true,
                products: { select: { name: true } },
            },
            orderBy: { sale_date: 'asc' },
        });
        const dateMap = new Map();
        const cursor = new Date(startDate);
        while (cursor <= endDate) {
            dateMap.set(formatDate(cursor), 0);
            cursor.setDate(cursor.getDate() + 1);
        }
        sales.forEach((sale) => {
            const key = formatDate(new Date(sale.sale_date));
            const prev = dateMap.get(key) ?? 0;
            dateMap.set(key, prev + Number(sale.quantity || 0));
        });
        const series = Array.from(dateMap.entries()).map(([date, value]) => ({
            date,
            sales: value,
        }));
        const resolvedName = productId
            ? productName ?? sales.find((s) => s.products?.name)?.products?.name ?? 'Produk'
            : 'Semua Produk';
        return res.json({
            success: true,
            data: {
                productName: resolvedName,
                data: series,
            },
        });
    }
    catch (error) {
        console.error('getProductTrend error:', error);
        res.status(500).json({ error: "Gagal mengambil data trend" });
    }
};
exports.getProductTrend = getProductTrend;
