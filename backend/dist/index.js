var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});

// src/index.ts
import "dotenv/config";
import express5 from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit2 from "express-rate-limit";

// src/routes/productRoutes.ts
import express from "express";

// lib/database/schema.ts
import { PrismaClient } from "@prisma/client";
var globalForPrisma = globalThis;
var prisma = globalForPrisma.prisma ?? new PrismaClient({ log: ["error"] });
if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

// src/controllers/productController.ts
var allowedTrendRanges = /* @__PURE__ */ new Set([7, 14, 30, 60, 90]);
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
  return date.toISOString().split("T")[0];
}
var getProducts = async (req, res) => {
  try {
    const userId = req.user?.sub;
    if (!userId) {
      return res.status(401).json({ error: "User tidak terotentikasi" });
    }
    const allProducts = await prisma.products.findMany({
      where: { user_id: String(userId), is_active: true },
      orderBy: [
        { price: "desc" },
        // Prefer products with price
        { created_at: "asc" }
      ]
    });
    const seenNames = /* @__PURE__ */ new Set();
    const products = allProducts.filter((p) => {
      const lowerName = p.name.toLowerCase();
      if (seenNames.has(lowerName)) return false;
      seenNames.add(lowerName);
      return true;
    });
    res.json({ success: true, data: products });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Gagal mengambil data produk" });
  }
};
var PRODUCT_NAME_REGEX = /^[a-zA-Z0-9\s\-\_\.\,\(\)]+$/;
var VALID_UNITS = ["pcs", "porsi", "cup", "botol", "bungkus", "kg", "box", "unit", "lembar", "pack"];
var sanitizeString = (str) => {
  return str.trim().slice(0, 100);
};
var validateProductName = (name) => {
  if (!name || typeof name !== "string") {
    return "Nama Produk wajib diisi";
  }
  const sanitized = name.trim();
  if (sanitized.length < 2) {
    return "Nama produk minimal 2 karakter";
  }
  if (sanitized.length > 100) {
    return "Nama produk maksimal 100 karakter";
  }
  if (!PRODUCT_NAME_REGEX.test(sanitized)) {
    return "Nama produk mengandung karakter tidak valid";
  }
  return null;
};
var createProduct = async (req, res) => {
  try {
    const userId = req.user?.sub;
    const { name, unit, price } = req.body;
    if (!userId) {
      return res.status(401).json({ error: "User tidak terotentikasi" });
    }
    const nameError = validateProductName(name);
    if (nameError) {
      return res.status(400).json({ error: nameError });
    }
    const sanitizedUnit = unit ? sanitizeString(unit).toLowerCase() : "pcs";
    if (!VALID_UNITS.includes(sanitizedUnit)) {
      return res.status(400).json({ error: "Unit tidak valid" });
    }
    let parsedPrice = null;
    if (price !== void 0 && price !== null && price !== "") {
      const parsed = parseFloat(price);
      if (isNaN(parsed) || parsed < 0 || parsed > 999999999) {
        return res.status(400).json({ error: "Harga tidak valid" });
      }
      parsedPrice = parsed;
    }
    const sanitizedName = sanitizeString(name);
    const allProducts = await prisma.products.findMany({
      where: { user_id: userId },
      select: { name: true }
    });
    const isDuplicate = allProducts.some(
      (p) => p.name.toLowerCase() === sanitizedName.toLowerCase()
    );
    if (isDuplicate) {
      return res.status(400).json({ error: `Produk "${sanitizedName}" sudah ada (tidak case-sensitive)` });
    }
    const newProduct = await prisma.products.create({
      data: {
        user_id: userId,
        name: sanitizedName,
        unit: sanitizedUnit,
        price: parsedPrice,
        is_active: true,
        dataset_id: null
      }
    });
    res.status(201).json({ success: true, data: newProduct });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Gagal menyimpan produk" });
  }
};
var updateProduct = async (req, res) => {
  try {
    const userId = req.user?.sub;
    const { id } = req.params;
    const { name, unit, price } = req.body;
    if (!userId) {
      return res.status(401).json({ error: "User tidak terotentikasi" });
    }
    const existing = await prisma.products.findFirst({
      where: { id, user_id: userId }
    });
    if (!existing) {
      return res.status(404).json({ error: "Produk tidak ditemukan" });
    }
    const updated = await prisma.products.update({
      where: { id },
      data: {
        ...name && { name },
        ...unit && { unit },
        ...price !== void 0 && { price: price ? parseFloat(price) : null }
      }
    });
    res.json({ success: true, data: updated });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Gagal update produk" });
  }
};
var getProductsWithRanking = async (req, res) => {
  try {
    const userId = req.user?.sub;
    if (!userId) {
      return res.status(401).json({ error: "User tidak terotentikasi" });
    }
    const allProducts = await prisma.products.findMany({
      where: { user_id: String(userId), is_active: true },
      orderBy: [
        { price: "desc" },
        // Prefer products with price
        { created_at: "asc" }
      ]
    });
    const seenNames = /* @__PURE__ */ new Set();
    const products = allProducts.filter((p) => {
      const lowerName = p.name.toLowerCase();
      if (seenNames.has(lowerName)) return false;
      seenNames.add(lowerName);
      return true;
    });
    const productIds = products.map((p) => p.id);
    const allAnalytics = await prisma.daily_analytics.findMany({
      where: { product_id: { in: productIds } },
      orderBy: { metric_date: "desc" }
    });
    const analyticsMap = /* @__PURE__ */ new Map();
    for (const a of allAnalytics) {
      if (!analyticsMap.has(a.product_id)) {
        analyticsMap.set(a.product_id, a);
      }
    }
    const allSales = await prisma.sales.findMany({
      where: {
        product_id: { in: productIds }
      },
      orderBy: { sale_date: "desc" },
      take: productIds.length * 30
      // Rough estimate: 30 per product
    });
    const salesMap = /* @__PURE__ */ new Map();
    const totalSalesMap = /* @__PURE__ */ new Map();
    for (const s of allSales) {
      const qty = Number(s.quantity);
      totalSalesMap.set(s.product_id, (totalSalesMap.get(s.product_id) || 0) + qty);
      if (!salesMap.has(s.product_id)) {
        salesMap.set(s.product_id, []);
      }
      const arr = salesMap.get(s.product_id);
      if (arr.length < 7) {
        arr.push(qty);
      }
    }
    for (const [key, arr] of salesMap) {
      salesMap.set(key, arr.reverse());
    }
    const productsWithAnalytics = products.map((product) => {
      const latestAnalytics = analyticsMap.get(product.id);
      const sparklineData = salesMap.get(product.id) || [];
      const totalSales = totalSalesMap.get(product.id) || 0;
      return {
        ...product,
        price: product.price ? Number(product.price) : null,
        analytics: latestAnalytics ? {
          momentum_combined: Number(latestAnalytics.momentum_combined || 0),
          momentum_label: latestAnalytics.momentum_label || "STABLE",
          burst_score: Number(latestAnalytics.burst_score || 0),
          burst_level: latestAnalytics.burst_level || "NORMAL",
          priority_score: Number(latestAnalytics.priority_score || 0),
          priority_rank: latestAnalytics.priority_rank
        } : null,
        sparkline: sparklineData,
        totalSales7d: totalSales
        // Now shows total of all time, not just 7 days
      };
    });
    const sorted = productsWithAnalytics.sort((a, b) => {
      const scoreA = a.analytics?.priority_score || 0;
      const scoreB = b.analytics?.priority_score || 0;
      if (scoreB !== scoreA) return scoreB - scoreA;
      return b.totalSales7d - a.totalSales7d;
    });
    res.json({ success: true, data: sorted });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Gagal mengambil data produk" });
  }
};
var getProductDetail = async (req, res) => {
  try {
    const userId = req.user?.sub;
    const { id } = req.params;
    if (!userId) {
      return res.status(401).json({ error: "User tidak terotentikasi" });
    }
    const product = await prisma.products.findFirst({
      where: { id, user_id: String(userId) }
    });
    if (!product) {
      return res.status(404).json({ error: "Produk tidak ditemukan" });
    }
    const thirtyDaysAgo = /* @__PURE__ */ new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const analyticsHistory = await prisma.daily_analytics.findMany({
      where: {
        product_id: id,
        metric_date: { gte: thirtyDaysAgo }
      },
      orderBy: { metric_date: "asc" }
    });
    const salesHistory = await prisma.sales.findMany({
      where: {
        product_id: id,
        sale_date: { gte: thirtyDaysAgo }
      },
      orderBy: { sale_date: "asc" }
    });
    const latestAnalytics = analyticsHistory[analyticsHistory.length - 1];
    res.json({
      success: true,
      data: {
        product: {
          ...product,
          price: product.price ? Number(product.price) : null
        },
        analytics: latestAnalytics ? {
          momentum_combined: Number(latestAnalytics.momentum_combined || 0),
          momentum_label: latestAnalytics.momentum_label || "STABLE",
          burst_score: Number(latestAnalytics.burst_score || 0),
          burst_level: latestAnalytics.burst_level || "NORMAL",
          priority_score: Number(latestAnalytics.priority_score || 0)
        } : null,
        salesHistory: salesHistory.map((s) => ({
          date: s.sale_date,
          quantity: Number(s.quantity),
          revenue: s.revenue ? Number(s.revenue) : null
        })),
        analyticsHistory: analyticsHistory.map((a) => ({
          date: a.metric_date,
          actual: Number(a.actual_quantity),
          forecast: a.forecast_quantity ? Number(a.forecast_quantity) : null,
          momentum: Number(a.momentum_combined || 0)
        }))
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Gagal mengambil detail produk" });
  }
};
var getProductTrend = async (req, res) => {
  try {
    const userId = req.user?.sub;
    const productId = typeof req.query.productId === "string" ? req.query.productId : void 0;
    const daysParam = Number(req.query.days);
    const days = allowedTrendRanges.has(daysParam) ? daysParam : 30;
    if (!userId) {
      return res.status(401).json({ error: "User tidak terotentikasi" });
    }
    if (!req.query.days) {
      console.warn("days param tidak diberikan, default 30 digunakan");
    }
    const endDate = toEndOfDay(/* @__PURE__ */ new Date());
    const startDate = toStartOfDay(/* @__PURE__ */ new Date());
    startDate.setDate(endDate.getDate() - (days - 1));
    let productName;
    if (productId) {
      const product = await prisma.products.findFirst({
        where: { id: productId, user_id: String(userId) },
        select: { id: true, name: true }
      });
      if (!product) {
        return res.status(404).json({ error: "Produk tidak ditemukan" });
      }
      productName = product.name;
    }
    const sales = await prisma.sales.findMany({
      where: {
        user_id: String(userId),
        ...productId ? { product_id: productId } : {},
        sale_date: {
          gte: startDate,
          lte: endDate
        }
      },
      select: {
        sale_date: true,
        quantity: true,
        product_id: true,
        products: { select: { name: true } }
      },
      orderBy: { sale_date: "asc" }
    });
    const dateMap = /* @__PURE__ */ new Map();
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
      sales: value
    }));
    const resolvedName = productId ? productName ?? sales.find((s) => s.products?.name)?.products?.name ?? "Produk" : "Semua Produk";
    return res.json({
      success: true,
      data: {
        productName: resolvedName,
        data: series
      }
    });
  } catch (error) {
    console.error("getProductTrend error:", error);
    res.status(500).json({ error: "Gagal mengambil data trend" });
  }
};
var deleteProduct = async (req, res) => {
  try {
    const userId = req.user?.sub;
    const { id } = req.params;
    console.log("Delete request:", { userId, productId: id });
    if (!userId) {
      return res.status(401).json({ error: "User tidak terotentikasi" });
    }
    const existing = await prisma.products.findFirst({
      where: { id, user_id: String(userId) }
    });
    console.log("Found product:", existing);
    if (!existing) {
      return res.status(404).json({ error: "Produk tidak ditemukan atau bukan milik Anda" });
    }
    await prisma.products.delete({
      where: { id }
    });
    console.log("Product deleted successfully (with cascade)");
    res.json({
      success: true,
      message: "Produk berhasil dihapus"
    });
  } catch (error) {
    console.error("deleteProduct error:", error);
    if (error.code === "P2025") {
      return res.status(404).json({ error: "Produk sudah tidak ada" });
    }
    if (error.code === "P2003") {
      return res.status(400).json({ error: "Produk masih terhubung ke data lain" });
    }
    res.status(500).json({ error: error.message || "Gagal menghapus produk" });
  }
};

// lib/auth/jwt.service.ts
import { jwtVerify } from "jose";
var jwtSecret = process.env.SUPABASE_JWT_SECRET;
if (!jwtSecret) {
  throw new Error("SUPABASE_JWT_SECRET wajib ada di .env");
}
var secretKey = new TextEncoder().encode(jwtSecret);
async function verifyToken(token) {
  if (!token) {
    throw new Error("Token tidak ditemukan");
  }
  try {
    const { payload } = await jwtVerify(token, secretKey);
    if (!payload?.sub) {
      throw new Error("Payload token tidak memiliki sub");
    }
    return payload;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Token tidak valid";
    console.error("JWT Verify Error:", message);
    throw new Error(`Verifikasi token gagal: ${message}`);
  }
}

// lib/auth/middleware.ts
function extractBearerToken(authHeader) {
  if (!authHeader) return null;
  const match = authHeader.match(/^[Bb]earer\s+(.+)$/);
  return match ? match[1].trim() : null;
}
async function requireAuth(req, res, next) {
  try {
    const token = extractBearerToken(req.headers.authorization);
    if (!token) {
      res.status(401).json({ error: "Authorization header dengan Bearer token diperlukan" });
      return;
    }
    const payload = await verifyToken(token);
    req.user = payload;
    req.token = token;
    next();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unauthorized";
    res.status(401).json({ error: message });
  }
}
async function optionalAuth(req, res, next) {
  try {
    const token = extractBearerToken(req.headers.authorization);
    if (!token) {
      return next();
    }
    const payload = await verifyToken(token);
    req.user = payload;
    req.token = token;
    next();
  } catch (error) {
    next();
  }
}

// src/routes/productRoutes.ts
var router = express.Router();
router.get("/internal/list", requireAuth, async (req, res) => {
  try {
    const internalKey = req.headers["x-internal-api-key"];
    if (!internalKey || internalKey !== process.env.INTERNAL_API_KEY) {
      return res.status(403).json({ error: "Forbidden: Invalid or missing internal API key" });
    }
    const userId = req.user?.sub;
    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }
    const products = await prisma.products.findMany({
      where: { user_id: userId },
      select: {
        id: true,
        name: true,
        unit: true,
        is_active: true
      }
    });
    res.json({ success: true, products });
  } catch (error) {
    console.error("Internal list error:", error);
    res.status(500).json({ error: "Failed to fetch products" });
  }
});
router.use(requireAuth);
router.get("/trend", getProductTrend);
router.get("/ranking", getProductsWithRanking);
router.get("/", getProducts);
router.get("/:id", getProductDetail);
router.post("/", createProduct);
router.put("/:id", updateProduct);
router.delete("/:id", deleteProduct);
var productRoutes_default = router;

// src/routes/salesRoutes.ts
import { Router } from "express";

// lib/database/queries.ts
var defaultSalesSource = "csv";
var ensureDatasetForUser = async (userId, datasetId) => {
  const dataset = await prisma.datasets.findFirst({
    where: { id: datasetId, user_id: userId }
  });
  if (!dataset) {
    const newDataset = await prisma.datasets.create({
      data: {
        id: datasetId,
        user_id: userId,
        name: `Upload ${(/* @__PURE__ */ new Date()).toLocaleDateString("id-ID")}`,
        status: "ready",
        source_file_type: "csv",
        source_file_name: "upload.csv",
        storage_path: `/uploads/${userId}/${datasetId}`
      }
    });
    return newDataset;
  }
  return dataset;
};
async function bulkUpsertSales(userId, datasetId, rows) {
  try {
    if (!userId) throw new Error("userId is required");
    if (!datasetId) throw new Error("datasetId is required");
    if (!Array.isArray(rows)) throw new Error("rows must be an array");
    if (!rows.length) return;
    const sampleSize = Math.min(10, rows.length);
    for (let i = 0; i < sampleSize; i++) {
      const row = rows[i];
      if (!row.productName) throw new Error("productName is required for each row");
      if (!(row.date instanceof Date) || Number.isNaN(row.date.getTime())) {
        throw new Error("date must be a valid Date");
      }
    }
    console.log(`[BulkUpsert] Starting: ${rows.length} rows`);
    const startTime = Date.now();
    const [, productNames] = await Promise.all([
      ensureDatasetForUser(userId, datasetId),
      Promise.resolve(Array.from(new Set(rows.map((r) => r.productName))))
    ]);
    console.log(`[BulkUpsert] Dataset + ${productNames.length} unique products: ${Date.now() - startTime}ms`);
    const existingProducts = await prisma.products.findMany({
      where: { user_id: userId, name: { in: productNames } },
      select: { id: true, name: true, price: true }
      // Only select needed fields
    });
    const productMap = /* @__PURE__ */ new Map();
    for (const p of existingProducts) {
      const key = p.name.toLowerCase();
      if (!productMap.has(key)) {
        productMap.set(key, { id: p.id, price: p.price ? Number(p.price) : null });
      }
    }
    const inputPriceMap = /* @__PURE__ */ new Map();
    for (const row of rows) {
      const key = row.productName.toLowerCase();
      let unitPrice = row.price;
      if ((!unitPrice || unitPrice === 0) && row.totalPrice && row.totalPrice > 0 && row.quantity > 0) {
        unitPrice = Math.round(row.totalPrice / row.quantity);
      }
      if (unitPrice && unitPrice > 0 && !inputPriceMap.has(key)) {
        inputPriceMap.set(key, unitPrice);
      }
    }
    const missingNames = productNames.filter((n) => !productMap.has(n.toLowerCase()));
    if (missingNames.length) {
      await prisma.products.createMany({
        data: missingNames.map((name) => {
          const priceFromInput = inputPriceMap.get(name.toLowerCase());
          return {
            user_id: userId,
            dataset_id: datasetId,
            name,
            price: priceFromInput || null
          };
        }),
        skipDuplicates: true
      });
      const newProducts = await prisma.products.findMany({
        where: { user_id: userId, name: { in: missingNames } },
        select: { id: true, name: true, price: true }
      });
      for (const p of newProducts) {
        productMap.set(p.name.toLowerCase(), { id: p.id, price: p.price ? Number(p.price) : null });
      }
    }
    const productsToUpdatePrice = [];
    for (const [key, product] of productMap) {
      if (!product.price && inputPriceMap.has(key)) {
        const newPrice = inputPriceMap.get(key);
        productsToUpdatePrice.push({ id: product.id, price: newPrice });
        product.price = newPrice;
      }
    }
    if (productsToUpdatePrice.length > 0) {
      await Promise.all(
        productsToUpdatePrice.map(
          (p) => prisma.products.update({
            where: { id: p.id },
            data: { price: p.price }
          })
        )
      );
      console.log(`[BulkUpsert] Updated ${productsToUpdatePrice.length} product prices`);
    }
    console.log(`[BulkUpsert] Products ready: ${Date.now() - startTime}ms`);
    const salesData = [];
    for (const row of rows) {
      const product = productMap.get(row.productName.toLowerCase());
      if (!product) continue;
      const qty = Number(row.quantity) || 0;
      salesData.push({
        user_id: userId,
        dataset_id: datasetId,
        product_id: product.id,
        sale_date: row.date,
        quantity: qty,
        revenue: (product.price || 0) * qty,
        has_promo: row.hasPromo ?? false,
        source: row.source ?? defaultSalesSource
      });
    }
    if (!salesData.length) {
      console.log(`[BulkUpsert] No valid sales data`);
      return;
    }
    const productDateMap = /* @__PURE__ */ new Map();
    for (const s of salesData) {
      const dateStr = s.sale_date.toISOString().split("T")[0];
      if (!productDateMap.has(s.product_id)) {
        productDateMap.set(s.product_id, /* @__PURE__ */ new Set());
      }
      productDateMap.get(s.product_id).add(dateStr);
    }
    const BATCH_SIZE = 5e3;
    const productIds = Array.from(productDateMap.keys());
    const deletePromises = [];
    for (let i = 0; i < productIds.length; i += 50) {
      const batchProductIds = productIds.slice(i, i + 50);
      deletePromises.push(
        prisma.sales.deleteMany({
          where: {
            product_id: { in: batchProductIds },
            user_id: userId
          }
        })
      );
    }
    await Promise.all(deletePromises);
    console.log(`[BulkUpsert] Deleted old records: ${Date.now() - startTime}ms`);
    for (let i = 0; i < salesData.length; i += BATCH_SIZE) {
      const batch = salesData.slice(i, i + BATCH_SIZE);
      await prisma.sales.createMany({
        data: batch,
        skipDuplicates: true
      });
      if (salesData.length > BATCH_SIZE) {
        console.log(`[BulkUpsert] Inserted batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(salesData.length / BATCH_SIZE)}: ${Date.now() - startTime}ms`);
      }
    }
    console.log(`[BulkUpsert] DONE: ${salesData.length} sales in ${Date.now() - startTime}ms`);
  } catch (error) {
    console.error("bulkUpsertSales failed", error);
    throw error;
  }
}
async function upsertAnalyticsResult(userId, datasetId, productId, date, data) {
  try {
    if (!userId) throw new Error("userId is required");
    if (!productId) throw new Error("productId is required");
    const normalizedDate = new Date(date);
    normalizedDate.setHours(0, 0, 0, 0);
    return await prisma.daily_analytics.upsert({
      where: {
        product_id_metric_date: {
          product_id: productId,
          metric_date: normalizedDate
        }
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
        ai_insight: data.aiInsight ?? null
      },
      update: {
        actual_quantity: data.actualQty,
        burst_score: data.burstScore ?? void 0,
        burst_level: data.burstLevel ?? void 0,
        momentum_combined: data.momentumCombined ?? void 0,
        momentum_label: data.momentumLabel ?? void 0,
        priority_score: data.priorityScore ?? void 0,
        ai_insight: data.aiInsight ?? void 0,
        updated_at: /* @__PURE__ */ new Date()
      }
    });
  } catch (error) {
    console.error("upsertAnalyticsResult failed", error);
    throw error;
  }
}
async function getSalesData(userId, productId, days) {
  try {
    if (!userId) {
      throw new Error("userId is required");
    }
    if (!productId) {
      throw new Error("productId is required");
    }
    if (!days || days <= 0) {
      throw new Error("days must be positive");
    }
    const endDate = /* @__PURE__ */ new Date();
    const startDate = /* @__PURE__ */ new Date();
    startDate.setHours(0, 0, 0, 0);
    startDate.setDate(endDate.getDate() - (days - 1));
    const sales = await prisma.sales.findMany({
      where: {
        user_id: userId,
        product_id: productId,
        sale_date: {
          gte: startDate,
          lte: endDate
        }
      },
      select: {
        sale_date: true,
        quantity: true,
        products: { select: { name: true } }
      },
      orderBy: { sale_date: "asc" }
    });
    const grouped = /* @__PURE__ */ new Map();
    sales.forEach((row) => {
      const key = row.sale_date.toISOString().split("T")[0];
      const existing = grouped.get(key);
      const qty = Number(row.quantity || 0);
      if (existing) {
        grouped.set(key, {
          ...existing,
          quantity: existing.quantity + qty,
          productName: existing.productName || row.products?.name
        });
      } else {
        grouped.set(key, {
          date: new Date(key),
          quantity: qty,
          productName: row.products?.name
        });
      }
    });
    return Array.from(grouped.values()).sort(
      (a, b) => a.date.getTime() - b.date.getTime()
    );
  } catch (error) {
    console.error("getSalesData failed", error);
    throw error;
  }
}

// src/services/intelligenceService.ts
import axios from "axios";

// lib/analytics/calendar.ts
function getDayOfWeekFactor(date) {
  const day = date.getDay();
  if (day === 0) return 1.11;
  if (day === 6) return 1.08;
  if (day === 5) return 1.01;
  if (day === 1) return 0.97;
  if (day === 2) return 0.93;
  if (day === 3) return 0.94;
  if (day === 4) return 0.96;
  return 1;
}
function getPaydayFactor(date) {
  const dayOfMonth = date.getDate();
  if (dayOfMonth >= 25 || dayOfMonth <= 5) {
    return 1.3;
  }
  if (dayOfMonth >= 20 && dayOfMonth <= 24) {
    return 0.9;
  }
  return 1;
}
function getSpecialDayFactor(date) {
  return 1;
}
function getCalendarFactors(input) {
  const { date } = input;
  if (!(date instanceof Date) || isNaN(date.getTime())) {
    throw new Error("Invalid Date input provided to Analytics Engine");
  }
  const dowFactor = getDayOfWeekFactor(date);
  const paydayFactor = getPaydayFactor(date);
  const specialFactor = getSpecialDayFactor(date);
  const jsDay = date.getDay();
  const dayOfWeek = jsDay === 0 ? "sunday" : jsDay === 1 ? "monday" : jsDay === 2 ? "tuesday" : jsDay === 3 ? "wednesday" : jsDay === 4 ? "thursday" : jsDay === 5 ? "friday" : "saturday";
  return {
    dayOfWeek,
    isPayday: paydayFactor > 1,
    factors: {
      dayOfWeek: dowFactor,
      payday: paydayFactor,
      special: specialFactor
    },
    // Formula 2: Total combined factor
    totalFactor: dowFactor * paydayFactor * specialFactor
  };
}

// src/services/intelligenceService.ts
var ML_API_URL = (process.env.ML_API_URL || "http://localhost:8000").replace(/\/$/, "");
var MIN_TRAINING_DAYS = 5;
var DEFAULT_FORECAST_DAYS = 7;
var IntelligenceService = class {
  normalizeSales(salesData) {
    return (salesData || []).map((row) => ({
      date: new Date(row.date),
      quantity: Number(row.quantity ?? 0),
      productName: row.productName
    })).filter((row) => !Number.isNaN(row.date.getTime())).sort((a, b) => a.date.getTime() - b.date.getTime());
  }
  calculateMomentum(salesData) {
    const data = this.normalizeSales(salesData);
    if (!data.length) return { combined: 0, status: "STABLE" };
    const qty = data.map((d) => d.quantity);
    const recent = qty.slice(-7);
    const previous = qty.slice(-14, -7);
    const avgRecent = recent.reduce((a, b) => a + b, 0) / (recent.length || 1);
    const avgPrevious = previous.reduce((a, b) => a + b, 0) / (previous.length || 1);
    const ratio = avgPrevious ? avgRecent / avgPrevious : 1;
    let status = "STABLE";
    if (ratio > 1.15) status = "TRENDING_UP";
    else if (ratio < 0.85) status = "DECLINING";
    else if (ratio > 1.05) status = "GROWING";
    else if (ratio < 0.95) status = "FALLING";
    return { combined: Number(ratio.toFixed(3)), status };
  }
  detectBurst(salesData) {
    const data = this.normalizeSales(salesData);
    if (data.length < 5) return { score: 0, severity: "NORMAL", classification: "NORMAL" };
    const quantities = data.map((d) => d.quantity);
    const baseline = quantities.slice(0, -1);
    const latest = quantities[quantities.length - 1];
    const mean = baseline.reduce((sum, value) => sum + value, 0) / (baseline.length || 1);
    const variance = baseline.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (baseline.length || 1);
    const stdDev = Math.sqrt(variance) || 1;
    const zScore = (latest - mean) / stdDev;
    let severity = "NORMAL";
    if (zScore > 3) severity = "CRITICAL";
    else if (zScore > 2) severity = "HIGH";
    else if (zScore > 1.5) severity = "MEDIUM";
    let classification = "NORMAL";
    if (severity !== "NORMAL") {
      const d = new Date(data[data.length - 1].date);
      const day = d.getDay();
      if (day === 0 || day === 6) classification = "SEASONAL";
      else classification = "SPIKE";
    }
    return { score: Number(zScore.toFixed(2)), severity, classification };
  }
  getRuleBasedPredictions(salesData, days) {
    const data = this.normalizeSales(salesData);
    const predictions = [];
    const anchor = data.length ? new Date(data[data.length - 1].date) : /* @__PURE__ */ new Date();
    const quantities = data.map((d) => d.quantity);
    const baseline = quantities.reduce((sum, q) => sum + q, 0) / (quantities.length || 1);
    let trend = 0;
    if (quantities.length >= 3) {
      const recentDays = Math.min(7, quantities.length);
      const recent = quantities.slice(-recentDays);
      const firstHalf = recent.slice(0, Math.floor(recent.length / 2));
      const secondHalf = recent.slice(Math.floor(recent.length / 2));
      const avgFirst = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
      const avgSecond = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
      trend = (avgSecond - avgFirst) / recentDays;
    }
    const variance = quantities.length > 1 ? Math.sqrt(quantities.reduce((sum, q) => sum + Math.pow(q - baseline, 2), 0) / quantities.length) : baseline * 0.2;
    for (let i = 1; i <= days; i += 1) {
      const targetDate = new Date(anchor);
      targetDate.setDate(anchor.getDate() + i);
      const factors = getCalendarFactors({ date: targetDate });
      const trendAdjustment = trend * i;
      const baseExpected = Math.max(1, baseline + trendAdjustment);
      const expected = baseExpected * factors.totalFactor;
      const dayVariation = 1 + Math.sin(targetDate.getDate() * 0.5) * 0.1;
      const finalExpected = expected * dayVariation;
      const boundRange = Math.max(variance * 0.5, finalExpected * 0.15, 1);
      predictions.push({
        date: targetDate.toISOString().split("T")[0],
        predicted_quantity: Math.max(1, Math.round(finalExpected)),
        confidence: data.length >= 14 ? "MEDIUM" : "LOW",
        lower_bound: Math.max(0, Math.round(finalExpected - boundRange)),
        upper_bound: Math.round(finalExpected + boundRange)
      });
    }
    return predictions;
  }
  // ✅ UNIVERSAL ML PREDICTION
  async callMLUniversalPredict(salesHistory, days = 7) {
    try {
      const salesData = salesHistory.map((s) => ({
        date: new Date(s.date).toISOString().split("T")[0],
        quantity: Number(s.quantity)
      }));
      const response = await axios.post(
        `${ML_API_URL}/api/ml/predict-universal`,
        { sales_data: salesData, forecast_days: days },
        { timeout: 45e3, headers: { "Content-Type": "application/json" } }
        // 45s timeout untuk data besar
      );
      if (response.data && response.data.success) return response.data;
      return null;
    } catch (error) {
      console.error("[IntelligenceService] Universal ML error:", error.message);
      return null;
    }
  }
  async isMLAvailable() {
    try {
      const response = await axios.get(`${ML_API_URL}/`, { timeout: 3e3 });
      return response.status === 200;
    } catch {
      return false;
    }
  }
  // ✅ MAIN ANALYSIS - USES UNIVERSAL ML
  async analyzeProduct(productId, productName, salesData, forecastDays = DEFAULT_FORECAST_DAYS) {
    const cleaned = this.normalizeSales(salesData);
    const days = Math.min(30, Math.max(7, forecastDays));
    const momentum = this.calculateMomentum(cleaned);
    const burst = this.detectBurst(cleaned);
    const realtimeMetrics = {
      momentum,
      burst: { score: burst.score, severity: burst.severity, level: burst.severity },
      classification: burst.classification,
      lastUpdated: (/* @__PURE__ */ new Date()).toISOString()
    };
    if (!cleaned.length || cleaned.length < MIN_TRAINING_DAYS) {
      const rulePred = this.getRuleBasedPredictions(cleaned, days);
      return {
        productId,
        productName,
        realtime: realtimeMetrics,
        forecast: {
          method: "rule-based (cold start)",
          predictions: rulePred,
          trend: "STABLE",
          totalForecast7d: rulePred.reduce((sum, p) => sum + p.predicted_quantity, 0),
          summary: `Data kurang (${cleaned.length} hari). Butuh ${MIN_TRAINING_DAYS}+ hari.`
        },
        recommendations: [],
        confidence: { overall: "LOW", dataQuality: 0.1, modelAgreement: 0 }
      };
    }
    const mlAvailable = await this.isMLAvailable();
    if (!mlAvailable) {
      console.warn("[IntelligenceService] ML offline, using fallback");
      const rulePred = this.getRuleBasedPredictions(cleaned, days);
      return {
        productId,
        productName,
        realtime: realtimeMetrics,
        forecast: {
          method: "rule-based (ML offline)",
          predictions: rulePred,
          trend: "STABLE",
          totalForecast7d: rulePred.reduce((sum, p) => sum + p.predicted_quantity, 0),
          summary: "ML Service offline."
        },
        recommendations: [],
        confidence: { overall: "LOW", dataQuality: 0.5, modelAgreement: 0 }
      };
    }
    const aiResult = await this.callMLUniversalPredict(cleaned, days);
    if (!aiResult || !aiResult.success) {
      console.warn("[IntelligenceService] ML failed, using fallback");
      const rulePred = this.getRuleBasedPredictions(cleaned, days);
      return {
        productId,
        productName,
        realtime: realtimeMetrics,
        forecast: {
          method: "rule-based (ML failed)",
          predictions: rulePred,
          trend: "STABLE",
          totalForecast7d: rulePred.reduce((sum, p) => sum + p.predicted_quantity, 0),
          summary: "ML unavailable."
        },
        recommendations: [],
        confidence: { overall: "LOW", dataQuality: 0.5, modelAgreement: 0 }
      };
    }
    const predictions = aiResult.predictions || [];
    const totalPrediction = predictions.reduce((sum, p) => sum + (p.predicted_quantity || 0), 0);
    let trend = "STABLE";
    if (predictions.length > 0) {
      const first = predictions[0].predicted_quantity;
      const last = predictions[predictions.length - 1].predicted_quantity;
      if (last > first * 1.05) trend = "INCREASING";
      else if (last < first * 0.95) trend = "DECREASING";
    }
    const recommendations = [];
    const avgPerDay = totalPrediction / days;
    if (momentum.status === "TRENDING_UP" || momentum.status === "GROWING") {
      recommendations.push({
        type: "STOCK_INCREASE",
        priority: "HIGH",
        message: `${productName} tren naik. Tambah stok 20-30%.`,
        actionable: true,
        action: `Tingkatkan stok ${productName}`,
        details: [`Momentum: ${momentum.status}`, `Avg: ${avgPerDay.toFixed(1)} unit/hari`]
      });
    } else if (momentum.status === "DECLINING" || momentum.status === "FALLING") {
      recommendations.push({
        type: "STOCK_REDUCE",
        priority: "MEDIUM",
        message: `${productName} tren turun. Kurangi stok 10-20%.`,
        actionable: true,
        action: `Kurangi stok ${productName}`,
        details: [`Momentum: ${momentum.status}`, `Avg: ${avgPerDay.toFixed(1)} unit/hari`]
      });
    }
    if (burst.severity === "HIGH" || burst.severity === "CRITICAL") {
      recommendations.push({
        type: "BURST_ALERT",
        priority: "URGENT",
        message: `Lonjakan signifikan: ${productName}!`,
        actionable: true,
        action: "Siapkan stok tambahan",
        details: [`Burst: ${burst.score}`, `Type: ${burst.classification}`]
      });
    }
    return {
      productId,
      productName,
      realtime: realtimeMetrics,
      forecast: {
        method: "hybrid-ml (universal)",
        predictions: predictions.map((p) => ({
          date: p.date,
          predicted_quantity: Math.round(p.predicted_quantity),
          confidence: p.confidence || "MEDIUM",
          lower_bound: Math.round(p.lower_bound || p.predicted_quantity * 0.8),
          upper_bound: Math.round(p.upper_bound || p.predicted_quantity * 1.2)
        })),
        trend,
        totalForecast7d: Math.round(totalPrediction),
        summary: `Prediksi ML ${days} hari (${cleaned.length} hari data).`
      },
      recommendations,
      confidence: {
        overall: "HIGH",
        dataQuality: cleaned.length >= 60 ? 1 : cleaned.length / 60,
        modelAgreement: 0.88
      }
    };
  }
  async getWeeklyReport(userId, topN = 10) {
    try {
      const mlAvailable = await this.isMLAvailable();
      if (mlAvailable) {
        try {
          const response = await axios.get(`${ML_API_URL}/api/ml/report/weekly`, {
            params: { top_n: topN, include_insights: true },
            timeout: 3e4
          });
          if (response.data?.success && response.data?.report) {
            const report = response.data.report;
            return {
              summary: report.summary || { burst_alerts: 0 },
              topPerformers: report.top_performers || [],
              needsAttention: report.needs_attention || [],
              insights: report.insights || [],
              generatedAt: response.data.generated_at || (/* @__PURE__ */ new Date()).toISOString()
            };
          }
        } catch (mlError) {
          console.warn("[IntelligenceService] ML weekly report failed:", mlError.message);
        }
      }
      return await this.generateLocalWeeklyReport(userId, topN);
    } catch (error) {
      console.error("[IntelligenceService] Weekly report error:", error);
      return {
        summary: { burst_alerts: 0 },
        topPerformers: [],
        needsAttention: [],
        insights: [],
        generatedAt: (/* @__PURE__ */ new Date()).toISOString()
      };
    }
  }
  async generateLocalWeeklyReport(userId, topN) {
    try {
      const products = await prisma.products.findMany({
        where: { user_id: userId, is_active: true },
        select: { id: true, name: true }
      });
      const topPerformers = [];
      const needsAttention = [];
      let burstCount = 0;
      for (const product of products) {
        try {
          const salesData = await getSalesData(userId, product.id, 14);
          if (salesData.length >= 5) {
            const momentum = this.calculateMomentum(salesData);
            const burst = this.detectBurst(salesData);
            const total = salesData.reduce((sum, s) => sum + Number(s.quantity), 0);
            const productReport = {
              product_id: product.id,
              product_name: product.name,
              total_sales: total,
              momentum,
              burst: {
                level: burst.severity,
                score: burst.score
              }
            };
            if (momentum.status === "TRENDING_UP" || momentum.status === "GROWING") {
              topPerformers.push(productReport);
            }
            if (momentum.status === "DECLINING" || momentum.status === "FALLING") {
              needsAttention.push(productReport);
            }
            if (burst.severity === "HIGH" || burst.severity === "CRITICAL") {
              burstCount++;
            }
          }
        } catch (err) {
          console.error(`[WeeklyReport] Error for ${product.id}:`, err);
        }
      }
      topPerformers.sort((a, b) => b.total_sales - a.total_sales);
      needsAttention.sort((a, b) => a.momentum.combined - b.momentum.combined);
      return {
        summary: {
          burst_alerts: burstCount,
          total_products: products.length,
          trending_up: topPerformers.length,
          needs_attention: needsAttention.length
        },
        topPerformers: topPerformers.slice(0, topN),
        needsAttention: needsAttention.slice(0, topN),
        insights: this.generateInsights(topPerformers, needsAttention, burstCount),
        generatedAt: (/* @__PURE__ */ new Date()).toISOString()
      };
    } catch (error) {
      console.error("[IntelligenceService] Local report error:", error);
      return {
        summary: { burst_alerts: 0 },
        topPerformers: [],
        needsAttention: [],
        insights: [],
        generatedAt: (/* @__PURE__ */ new Date()).toISOString()
      };
    }
  }
  generateInsights(topPerformers, needsAttention, burstCount) {
    const insights = [];
    if (topPerformers.length > 0) {
      insights.push(`${topPerformers.length} produk menunjukkan tren naik`);
      if (topPerformers[0]) {
        insights.push(`${topPerformers[0].product_name} adalah produk dengan performa terbaik`);
      }
    }
    if (needsAttention.length > 0) {
      insights.push(`${needsAttention.length} produk membutuhkan perhatian (tren turun)`);
    }
    if (burstCount > 0) {
      insights.push(`${burstCount} produk mengalami lonjakan penjualan`);
    }
    if (insights.length === 0) {
      insights.push("Performa produk stabil minggu ini");
    }
    return insights;
  }
  async getTrendingProducts(userId) {
    try {
      const products = await prisma.products.findMany({
        where: { user_id: userId, is_active: true },
        select: { id: true, name: true }
      });
      const trendingProducts = [];
      for (const product of products) {
        try {
          const salesData = await getSalesData(userId, product.id, 30);
          if (salesData.length >= 5) {
            const burst = this.detectBurst(salesData);
            if (burst.severity === "HIGH" || burst.severity === "CRITICAL") {
              trendingProducts.push({
                productId: product.id,
                productName: product.name,
                burstScore: burst.score,
                severity: burst.severity,
                lastUpdated: (/* @__PURE__ */ new Date()).toISOString()
              });
            }
          }
        } catch (error) {
          console.error(`Error analyzing product ${product.id}:`, error);
        }
      }
      trendingProducts.sort((a, b) => b.burstScore - a.burstScore);
      return {
        summary: { burst_alerts: trendingProducts.length },
        topPerformers: trendingProducts.slice(0, 10),
        needsAttention: trendingProducts,
        insights: trendingProducts.length > 0 ? [`${trendingProducts.length} produk menunjukkan lonjakan`] : ["Tidak ada lonjakan terdeteksi"],
        generatedAt: (/* @__PURE__ */ new Date()).toISOString()
      };
    } catch (error) {
      console.error("[IntelligenceService] Trending error:", error);
      return {
        summary: { burst_alerts: 0 },
        topPerformers: [],
        needsAttention: [],
        insights: [],
        generatedAt: (/* @__PURE__ */ new Date()).toISOString()
      };
    }
  }
};
var intelligenceService = new IntelligenceService();

// src/services/burstService.ts
import { PrismaClient as PrismaClient2 } from "@prisma/client";
import axios2 from "axios";
var prisma2 = new PrismaClient2();
var ML_API_URL2 = (process.env.ML_API_URL || "http://localhost:8000").replace(/\/$/, "");
var generateBurstAnalytics = async (userId, date) => {
  try {
    const mlAvailable = await checkMLService();
    if (!mlAvailable) {
      console.warn("[BurstService] ML service offline, skipping burst analytics");
      return { processed: 0, message: "ML service offline" };
    }
    const products = await prisma2.products.findMany({
      where: { user_id: userId, is_active: true },
      select: { id: true, name: true, dataset_id: true }
    });
    if (products.length === 0) {
      return { processed: 0, message: "No products found" };
    }
    const mlReport = await callMLWeeklyReport(10);
    if (!mlReport || !mlReport.success) {
      console.warn("[BurstService] ML report failed");
      return { processed: 0, message: "ML report failed" };
    }
    const mlDataMap = /* @__PURE__ */ new Map();
    for (const perf of mlReport.report.top_performers || []) {
      mlDataMap.set(perf.product_id, {
        momentum_status: perf.momentum_status,
        burst_level: perf.burst_level,
        priority_score: perf.priority_score,
        avg_demand_7d: perf.avg_demand_7d
      });
    }
    for (const item of mlReport.report.needs_attention || []) {
      if (!mlDataMap.has(item.product_id)) {
        mlDataMap.set(item.product_id, {
          momentum_status: item.momentum_status,
          burst_level: item.burst_level,
          priority_score: 0,
          reason: item.reason,
          action: item.action
        });
      }
    }
    for (const [productId, productData] of Object.entries(mlReport.report.products || {})) {
      if (!mlDataMap.has(productId)) {
        const data = productData;
        mlDataMap.set(productId, {
          momentum_status: data.momentum?.status || "STABLE",
          burst_level: data.burst?.level || "NORMAL",
          priority_score: data.priority_score || 0,
          momentum_combined: data.momentum?.combined || 0,
          burst_score: data.burst?.burst_score || 0
        });
      }
    }
    const updates = [];
    for (const product of products) {
      const mlData = mlDataMap.get(product.id);
      if (!mlData) {
        continue;
      }
      const salesData = await prisma2.sales.findUnique({
        where: {
          product_id_sale_date: {
            product_id: product.id,
            sale_date: date
          }
        }
      });
      const aiInsight = {
        source: "ml_api",
        updated_at: (/* @__PURE__ */ new Date()).toISOString(),
        burst_level: mlData.burst_level,
        momentum_status: mlData.momentum_status,
        reason: mlData.reason || null,
        action: mlData.action || null
      };
      updates.push(
        prisma2.daily_analytics.upsert({
          where: {
            product_id_metric_date: {
              product_id: product.id,
              metric_date: date
            }
          },
          create: {
            user_id: userId,
            product_id: product.id,
            dataset_id: product.dataset_id || void 0,
            metric_date: date,
            actual_quantity: salesData?.quantity || 0,
            momentum_combined: mlData.momentum_combined || 0,
            momentum_label: mlData.momentum_status || "STABLE",
            burst_score: mlData.burst_score || 0,
            burst_level: mlData.burst_level || "NORMAL",
            burst_type: mlData.burst_level === "NORMAL" ? "NORMAL" : "MONITORING",
            priority_score: mlData.priority_score || 0,
            ai_insight: aiInsight
          },
          update: {
            momentum_combined: mlData.momentum_combined || 0,
            momentum_label: mlData.momentum_status || "STABLE",
            burst_score: mlData.burst_score || 0,
            burst_level: mlData.burst_level || "NORMAL",
            burst_type: mlData.burst_level === "NORMAL" ? "NORMAL" : "MONITORING",
            priority_score: mlData.priority_score || 0,
            updated_at: /* @__PURE__ */ new Date(),
            ai_insight: aiInsight
          }
        })
      );
    }
    if (updates.length > 0) {
      await prisma2.$transaction(updates);
    }
    return {
      processed: updates.length,
      message: `Updated ${updates.length} product analytics from ML`
    };
  } catch (error) {
    console.error("[BurstService] Error generating burst analytics:", error);
    return {
      processed: 0,
      message: `Error: ${error instanceof Error ? error.message : "Unknown error"}`
    };
  }
};
async function checkMLService() {
  try {
    const response = await axios2.get(`${ML_API_URL2}/`, { timeout: 3e3 });
    return response.status === 200;
  } catch {
    return false;
  }
}
async function callMLWeeklyReport(topN = 50) {
  try {
    const response = await axios2.get(`${ML_API_URL2}/api/ml/report/weekly`, {
      params: { top_n: topN, strategy: "balanced" },
      timeout: 15e3
    });
    if (response.data && response.data.success) {
      return response.data;
    }
    return null;
  } catch (error) {
    console.error("[BurstService] ML API error:", error.message);
    return null;
  }
}

// src/utils/fileParser.ts
import * as XLSX from "xlsx";
var COLUMN_PATTERNS = {
  product: [
    "nama",
    "produk",
    "product",
    "menu",
    "item",
    "barang",
    "name",
    "nama_produk",
    "nama produk",
    "product_name",
    "product name",
    "nama_menu",
    "nama menu",
    "menu_name",
    "nama_barang",
    "nama barang"
  ],
  quantity: [
    "qty",
    "quantity",
    "jumlah",
    "terjual",
    "sold",
    "jml",
    "kuantitas",
    "jumlah_terjual",
    "jumlah terjual",
    "total",
    "banyak",
    "unit",
    "pcs",
    "porsi",
    "amount",
    "count",
    "stok_keluar",
    "stok keluar"
  ],
  date: [
    "tanggal",
    "date",
    "tgl",
    "waktu",
    "time",
    "hari",
    "day",
    "tanggal_transaksi",
    "tanggal transaksi",
    "transaction_date",
    "sale_date",
    "sale date",
    "order_date",
    "order date",
    "created",
    "created_at"
  ],
  price: [
    "harga",
    "price",
    "hrg",
    "nilai",
    "value",
    "cost",
    "biaya",
    "harga_satuan",
    "harga satuan",
    "unit_price",
    "unit price",
    "harga_jual",
    "harga jual",
    "selling_price",
    "sell_price"
  ],
  totalPrice: [
    "total",
    "total_harga",
    "total harga",
    "total_price",
    "total price",
    "subtotal",
    "sub_total",
    "sub total",
    "jumlah_harga",
    "jumlah harga",
    "amount",
    "grand_total",
    "grand total",
    "nilai_total",
    "nilai total"
  ]
};
function findColumnIndex(headers, patterns) {
  const lowerHeaders = headers.map((h) => h.toLowerCase().trim().replace(/[^a-z0-9_\s]/g, ""));
  for (const pattern of patterns) {
    const idx = lowerHeaders.findIndex(
      (h) => h === pattern || h.includes(pattern) || pattern.includes(h)
    );
    if (idx !== -1) return idx;
  }
  return -1;
}
function detectColumns(headers) {
  return {
    product: findColumnIndex(headers, COLUMN_PATTERNS.product),
    quantity: findColumnIndex(headers, COLUMN_PATTERNS.quantity),
    date: findColumnIndex(headers, COLUMN_PATTERNS.date),
    price: findColumnIndex(headers, COLUMN_PATTERNS.price),
    totalPrice: findColumnIndex(headers, COLUMN_PATTERNS.totalPrice)
  };
}
function parseFlexibleDate(dateInput) {
  if (!dateInput) return void 0;
  if (typeof dateInput === "number") {
    try {
      const date = XLSX.SSF.parse_date_code(dateInput);
      if (date) {
        const y = date.y;
        const m = String(date.m).padStart(2, "0");
        const d = String(date.d).padStart(2, "0");
        return `${y}-${m}-${d}`;
      }
    } catch {
    }
  }
  const dateStr = String(dateInput).trim();
  if (!dateStr) return void 0;
  let match = dateStr.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/);
  if (match) {
    const [, y, m, d] = match;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  match = dateStr.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})/);
  if (match) {
    const [, d, m, y] = match;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  match = dateStr.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{2})$/);
  if (match) {
    const [, d, m, yy] = match;
    const y = parseInt(yy) > 50 ? `19${yy}` : `20${yy}`;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  const monthNames = {
    "januari": "01",
    "jan": "01",
    "february": "02",
    "februari": "02",
    "feb": "02",
    "maret": "03",
    "mar": "03",
    "march": "03",
    "april": "04",
    "apr": "04",
    "mei": "05",
    "may": "05",
    "juni": "06",
    "jun": "06",
    "june": "06",
    "juli": "07",
    "jul": "07",
    "july": "07",
    "agustus": "08",
    "aug": "08",
    "agu": "08",
    "september": "09",
    "sep": "09",
    "sept": "09",
    "oktober": "10",
    "oct": "10",
    "okt": "10",
    "november": "11",
    "nov": "11",
    "desember": "12",
    "dec": "12",
    "des": "12"
  };
  const textMatch = dateStr.toLowerCase().match(/(\d{1,2})\s+([a-z]+)\s+(\d{4})/);
  if (textMatch) {
    const [, d, monthStr, y] = textMatch;
    const m = monthNames[monthStr];
    if (m) {
      return `${y}-${m}-${d.padStart(2, "0")}`;
    }
  }
  try {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime()) && d.getFullYear() > 2e3) {
      return d.toISOString().split("T")[0];
    }
  } catch {
  }
  return void 0;
}
function parseNumber(value) {
  if (typeof value === "number") return value;
  if (!value) return 0;
  const str = String(value).trim().replace(/[Rr][Pp]\.?\s*/g, "").replace(/\./g, "").replace(/,/g, ".").replace(/[^\d.-]/g, "");
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
}
function parseCSV(content) {
  const lines = content.split(/\r?\n/).filter((line) => line.trim());
  const result = [];
  if (lines.length === 0) return result;
  const firstLine = lines[0];
  const delimiter = firstLine.includes(";") ? ";" : firstLine.includes("	") ? "	" : ",";
  const headers = firstLine.split(delimiter).map((h) => h.trim().replace(/"/g, ""));
  const colMap = detectColumns(headers);
  if (colMap.product === -1 || colMap.quantity === -1) {
    const hasHeader = headers.some(
      (h) => COLUMN_PATTERNS.product.some((p) => h.toLowerCase().includes(p)) || COLUMN_PATTERNS.quantity.some((p) => h.toLowerCase().includes(p))
    );
    if (!hasHeader) {
      colMap.product = 0;
      colMap.quantity = 1;
      colMap.date = headers.length > 2 ? 2 : -1;
    }
  }
  const startIndex = colMap.product !== 0 || colMap.quantity !== 1 ? 1 : 0;
  for (let i = startIndex; i < lines.length; i++) {
    const cols = lines[i].split(delimiter).map((c) => c.trim().replace(/"/g, ""));
    if (cols.length < 2) continue;
    const productName = cols[colMap.product] || "";
    const quantity = parseNumber(cols[colMap.quantity]);
    const date = colMap.date >= 0 ? parseFlexibleDate(cols[colMap.date]) : void 0;
    let price = colMap.price >= 0 ? parseNumber(cols[colMap.price]) : void 0;
    const totalPrice = colMap.totalPrice >= 0 ? parseNumber(cols[colMap.totalPrice]) : void 0;
    if ((!price || price === 0) && totalPrice && totalPrice > 0 && quantity > 0) {
      price = Math.round(totalPrice / quantity);
    }
    if (productName && quantity >= 0) {
      result.push({ productName, quantity, date, price, totalPrice });
    }
  }
  return result;
}
function parseExcel(buffer) {
  const result = [];
  try {
    const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) return result;
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    if (data.length < 2) return result;
    const firstRow = data[0];
    if (!Array.isArray(firstRow)) return result;
    const headers = firstRow.map((h) => String(h || ""));
    const colMap = detectColumns(headers);
    if (colMap.product === -1 && colMap.quantity === -1) {
      const sampleRow = data[1];
      if (Array.isArray(sampleRow)) {
        for (let i = 0; i < sampleRow.length; i++) {
          const val = sampleRow[i];
          if (colMap.product === -1 && typeof val === "string" && val.length > 0) {
            colMap.product = i;
          } else if (colMap.quantity === -1 && typeof val === "number") {
            colMap.quantity = i;
          }
        }
      }
    }
    if (colMap.product === -1) colMap.product = 0;
    if (colMap.quantity === -1) colMap.quantity = 1;
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!Array.isArray(row) || row.length < 2) continue;
      const productName = String(row[colMap.product] || "").trim();
      const quantity = parseNumber(row[colMap.quantity]);
      const date = colMap.date >= 0 ? parseFlexibleDate(row[colMap.date]) : void 0;
      let price = colMap.price >= 0 ? parseNumber(row[colMap.price]) : void 0;
      const totalPrice = colMap.totalPrice >= 0 ? parseNumber(row[colMap.totalPrice]) : void 0;
      if ((!price || price === 0) && totalPrice && totalPrice > 0 && quantity > 0) {
        price = Math.round(totalPrice / quantity);
      }
      if (productName && quantity >= 0) {
        result.push({ productName, quantity, date, price, totalPrice });
      }
    }
  } catch (error) {
    console.error("Excel parse error:", error);
  }
  return result;
}
function parseDOCX(buffer) {
  const result = [];
  try {
    const zip = XLSX.read(buffer, { type: "buffer" });
    if (zip.SheetNames && zip.SheetNames.length > 0) {
      return parseExcel(buffer);
    }
    console.log("DOCX file has no embedded spreadsheet data");
  } catch (error) {
    console.error("DOCX parse error:", error);
  }
  return result;
}
function parseFile(buffer, filename) {
  const lowerName = filename.toLowerCase();
  if (lowerName.endsWith(".csv") || lowerName.endsWith(".txt")) {
    return parseCSV(buffer.toString("utf-8"));
  }
  if (lowerName.endsWith(".xlsx") || lowerName.endsWith(".xls")) {
    return parseExcel(buffer);
  }
  if (lowerName.endsWith(".docx")) {
    return parseDOCX(buffer);
  }
  throw new Error(`Unsupported file format: ${filename}`);
}

// src/controllers/salesController.ts
var createSalesEntry = async (req, res) => {
  try {
    const userId = req.user?.sub;
    let { product_id, sale_date, quantity, dataset_id, product_name } = req.body;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: "User tidak terotentikasi"
      });
    }
    const qtyNumber = Number(quantity);
    if (qtyNumber < 0) {
      return res.status(400).json({
        success: false,
        error: "Quantity tidak boleh negatif"
      });
    }
    const saleDateObj = new Date(sale_date);
    if (!dataset_id) {
      let targetDataset = await prisma.datasets.findFirst({
        where: {
          user_id: userId,
          source_file_type: "csv"
        }
      });
      if (targetDataset) {
        dataset_id = targetDataset.id;
      } else {
        const newDataset = await prisma.datasets.create({
          data: {
            user_id: userId,
            name: "Manual_Input_Sales",
            source_file_name: "manual_entry",
            source_file_type: "csv",
            storage_path: "",
            status: "ready"
          }
        });
        dataset_id = newDataset.id;
      }
    }
    await bulkUpsertSales(userId, dataset_id, [{
      productName: product_name,
      date: saleDateObj,
      quantity: qtyNumber,
      source: "csv"
    }]);
    if (!product_id && product_name) {
      const existingProduct = await prisma.products.findFirst({
        where: {
          name: product_name,
          user_id: userId
        }
      });
      if (existingProduct) {
        product_id = existingProduct.id;
      }
    }
    let aiAnalysis = null;
    if (product_id) {
      try {
        const history = await prisma.sales.findMany({
          where: {
            product_id,
            user_id: userId
          },
          orderBy: { sale_date: "desc" },
          take: 60,
          // Last 60 days for better analysis
          select: {
            sale_date: true,
            quantity: true
          }
        });
        if (history.length >= 5) {
          const salesData = history.map((h) => ({
            date: h.sale_date,
            quantity: Number(h.quantity),
            productName: product_name
          }));
          const product = await prisma.products.findUnique({
            where: { id: product_id }
          });
          aiAnalysis = await intelligenceService.analyzeProduct(
            product_id,
            product?.name || product_name,
            salesData
          );
          if (aiAnalysis) {
            await upsertAnalyticsResult(
              userId,
              dataset_id,
              product_id,
              saleDateObj,
              {
                actualQty: qtyNumber,
                burstScore: aiAnalysis.realtime.burst.score,
                burstLevel: aiAnalysis.realtime.burst.severity,
                momentumCombined: aiAnalysis.realtime.momentum.combined,
                momentumLabel: aiAnalysis.realtime.momentum.status,
                aiInsight: {
                  source: "intelligenceService",
                  method: aiAnalysis.forecast.method,
                  confidence: aiAnalysis.confidence.overall,
                  recommendations: aiAnalysis.recommendations,
                  trend: aiAnalysis.forecast.trend
                }
              }
            );
          }
          await generateBurstAnalytics(userId, saleDateObj);
        }
      } catch (analysisError) {
        console.error("[SalesController] AI Analysis error:", analysisError);
      }
    }
    res.status(201).json({
      success: true,
      message: "Sales data saved successfully",
      data: {
        product_id,
        product_name,
        sale_date: saleDateObj.toISOString().split("T")[0],
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
  } catch (error) {
    console.error("[SalesController] Error:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Server Error"
    });
  }
};
var getSalesData2 = async (req, res) => {
  try {
    const userId = req.user?.sub;
    const { product_id, start_date, end_date, limit } = req.query;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: "User tidak terotentikasi"
      });
    }
    const where = { user_id: userId };
    if (product_id) {
      where.product_id = String(product_id);
    }
    const parseAndValidateDate = (dateStr, fieldName) => {
      if (!dateStr) return null;
      const date = new Date(String(dateStr));
      if (isNaN(date.getTime())) {
        throw new Error(`Format ${fieldName} tidak valid. Gunakan format YYYY-MM-DD`);
      }
      return date;
    };
    try {
      if (start_date || end_date) {
        where.sale_date = {};
        if (start_date) {
          const parsedStart = parseAndValidateDate(start_date, "start_date");
          if (parsedStart) where.sale_date.gte = parsedStart;
        }
        if (end_date) {
          const parsedEnd = parseAndValidateDate(end_date, "end_date");
          if (parsedEnd) where.sale_date.lte = parsedEnd;
        }
        if (where.sale_date.gte && where.sale_date.lte && where.sale_date.gte > where.sale_date.lte) {
          return res.status(400).json({
            success: false,
            error: "start_date harus lebih awal dari end_date"
          });
        }
      }
    } catch (dateError) {
      return res.status(400).json({
        success: false,
        error: dateError instanceof Error ? dateError.message : "Format tanggal tidak valid"
      });
    }
    const salesData = await prisma.sales.findMany({
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
      orderBy: { sale_date: "desc" },
      take: limit ? parseInt(String(limit)) : 100
    });
    res.status(200).json({
      success: true,
      count: salesData.length,
      data: salesData
    });
  } catch (error) {
    console.error("[SalesController] Get sales error:", error);
    res.status(500).json({
      success: false,
      error: "Gagal mengambil data sales"
    });
  }
};
var getSalesById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.sub;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: "User tidak terotentikasi"
      });
    }
    const sale = await prisma.sales.findFirst({
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
        error: "Sales data tidak ditemukan"
      });
    }
    res.json({
      success: true,
      data: sale
    });
  } catch (error) {
    console.error("[SalesController] Get sale by ID error:", error);
    res.status(500).json({
      success: false,
      error: "Gagal mengambil data sales"
    });
  }
};
var deleteSales = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.sub;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: "User tidak terotentikasi"
      });
    }
    const sale = await prisma.sales.findFirst({
      where: { id, user_id: userId }
    });
    if (!sale) {
      return res.status(404).json({
        success: false,
        error: "Sales data tidak ditemukan"
      });
    }
    await prisma.sales.delete({
      where: { id }
    });
    res.json({
      success: true,
      message: "Sales data berhasil dihapus"
    });
  } catch (error) {
    console.error("[SalesController] Delete sales error:", error);
    res.status(500).json({
      success: false,
      error: "Gagal menghapus data sales"
    });
  }
};
var createBulkSales = async (req, res) => {
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
    let targetDataset = await prisma.datasets.findFirst({
      where: {
        user_id: userId,
        source_file_type: "csv"
      }
    });
    let dataset_id;
    if (targetDataset) {
      dataset_id = targetDataset.id;
    } else {
      const newDataset = await prisma.datasets.create({
        data: {
          user_id: userId,
          name: "Manual_Input_Sales",
          source_file_name: "manual_entry",
          source_file_type: "csv",
          storage_path: "",
          status: "ready"
        }
      });
      dataset_id = newDataset.id;
    }
    const validEntries = entries.filter((e) => e.quantity > 0);
    if (validEntries.length === 0) {
      return res.status(400).json({
        success: false,
        error: "Tidak ada produk dengan quantity > 0"
      });
    }
    const salesData = validEntries.map((entry) => ({
      productName: entry.product_name,
      date: saleDateObj,
      quantity: Number(entry.quantity),
      source: "csv"
    }));
    await bulkUpsertSales(userId, dataset_id, salesData);
    const analysisPromises = validEntries.map(async (entry) => {
      try {
        const product = await prisma.products.findFirst({
          where: { id: entry.product_id, user_id: userId }
        });
        if (!product) return null;
        const history = await prisma.sales.findMany({
          where: {
            product_id: entry.product_id,
            user_id: userId
          },
          orderBy: { sale_date: "desc" },
          take: 60
        });
        if (history.length >= 5) {
          const salesHistory = history.map((h) => ({
            date: h.sale_date,
            quantity: Number(h.quantity),
            productName: product.name
          }));
          const analysis = await intelligenceService.analyzeProduct(
            product.id,
            product.name,
            salesHistory
          );
          if (analysis) {
            await upsertAnalyticsResult(
              userId,
              dataset_id,
              product.id,
              saleDateObj,
              {
                actualQty: Number(entry.quantity),
                burstScore: analysis.realtime.burst.score,
                burstLevel: analysis.realtime.burst.severity,
                momentumCombined: analysis.realtime.momentum.combined,
                momentumLabel: analysis.realtime.momentum.status,
                aiInsight: {
                  source: "intelligenceService",
                  method: analysis.forecast.method,
                  confidence: analysis.confidence.overall,
                  trend: analysis.forecast.trend
                }
              }
            );
          }
        }
      } catch (err) {
        console.error(`[BulkSales] Analysis error for ${entry.product_id}:`, err);
      }
    });
    setImmediate(async () => {
      try {
        await Promise.allSettled(analysisPromises);
        console.log(`[BulkSales] Background analysis completed for ${validEntries.length} products`);
      } catch (err) {
        console.error("[BulkSales] Background analysis failed:", err);
      }
      try {
        await generateBurstAnalytics(userId, saleDateObj);
        console.log(`[BulkSales] Burst analytics completed for date ${saleDateObj.toISOString()}`);
      } catch (err) {
        console.error("[BulkSales] Burst analytics failed:", err);
      }
    });
    res.status(201).json({
      success: true,
      message: `${validEntries.length} produk berhasil disimpan`,
      data: {
        sale_date: saleDateObj.toISOString().split("T")[0],
        products_saved: validEntries.length,
        entries: validEntries.map((e) => ({
          product_id: e.product_id,
          product_name: e.product_name,
          quantity: e.quantity
        }))
      }
    });
  } catch (error) {
    console.error("[SalesController] Bulk create error:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Server Error"
    });
  }
};
var getSalesHistory = async (req, res) => {
  try {
    const userId = req.user?.sub;
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    if (!userId) {
      return res.status(401).json({ success: false, error: "User tidak terotentikasi" });
    }
    const sales = await prisma.sales.findMany({
      where: {
        user_id: String(userId)
      },
      include: {
        products: {
          select: { name: true, price: true }
        }
      },
      orderBy: { sale_date: "desc" },
      take: limit
    });
    const history = sales.map((s) => {
      const quantity = Number(s.quantity);
      const unitPrice = s.products?.price ? Number(s.products.price) : null;
      const revenue = s.revenue ? Number(s.revenue) : unitPrice && quantity ? unitPrice * quantity : null;
      return {
        date: s.sale_date.toISOString().split("T")[0],
        product_name: s.products?.name || "Unknown",
        quantity,
        unit_price: unitPrice,
        revenue
      };
    });
    res.json({ success: true, data: history });
  } catch (error) {
    console.error("[SalesController] History error:", error);
    res.status(500).json({ success: false, error: "Gagal mengambil riwayat" });
  }
};
var uploadSalesFile = async (req, res) => {
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
    let parsedData;
    try {
      parsedData = parseFile(file.buffer, fileName);
    } catch (parseError) {
      return res.status(400).json({
        success: false,
        error: parseError instanceof Error ? parseError.message : "Format file tidak didukung"
      });
    }
    if (parsedData.length === 0) {
      return res.status(400).json({ success: false, error: "Tidak ada data valid dalam file" });
    }
    const defaultDate = req.body.sale_date || (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
    const rows = parsedData.map((item) => {
      const dateStr = item.date || defaultDate;
      const dateObj = /* @__PURE__ */ new Date(dateStr + "T00:00:00");
      return {
        productName: item.productName,
        quantity: item.quantity,
        date: dateObj,
        price: item.price,
        // Unit price (harga satuan)
        totalPrice: item.totalPrice
        // Total price for calculation if needed
      };
    }).filter((row) => !isNaN(row.date.getTime()));
    if (rows.length === 0) {
      return res.status(400).json({ success: false, error: "Tidak ada data valid dengan tanggal yang benar" });
    }
    const { randomUUID } = __require("crypto");
    const uploadDatasetId = randomUUID();
    const userIdStr = String(userId);
    const rowCount = rows.length;
    if (rowCount < 5e3) {
      try {
        console.log(`[Upload] Sync processing ${rowCount} rows for user ${userIdStr}`);
        await bulkUpsertSales(userIdStr, uploadDatasetId, rows);
        const uniqueProducts = [...new Set(rows.map((r) => r.productName))];
        console.log(`[Upload] Generating analytics for ${uniqueProducts.length} products`);
        const products = await prisma.products.findMany({
          where: {
            user_id: userIdStr,
            name: { in: uniqueProducts }
          },
          select: { id: true, name: true }
        });
        const analyticsPromises = products.slice(0, 20).map(async (product) => {
          try {
            const sales = await prisma.sales.findMany({
              where: { product_id: product.id, user_id: userIdStr },
              orderBy: { sale_date: "desc" },
              take: 60
            });
            if (sales.length >= 3) {
              const salesData = sales.map((s) => ({
                date: s.sale_date,
                quantity: Number(s.quantity),
                productName: product.name
              }));
              const analysis = await intelligenceService.analyzeProduct(
                product.id,
                product.name,
                salesData
              );
              if (analysis && sales[0]) {
                await upsertAnalyticsResult(
                  userIdStr,
                  uploadDatasetId,
                  product.id,
                  sales[0].sale_date,
                  {
                    actualQty: Number(sales[0].quantity),
                    burstScore: analysis.realtime.burst.score,
                    burstLevel: analysis.realtime.burst.severity,
                    momentumCombined: analysis.realtime.momentum.combined,
                    momentumLabel: analysis.realtime.momentum.status,
                    aiInsight: { source: "upload", method: analysis.forecast.method }
                  }
                );
              }
            }
          } catch (err) {
            console.error(`[Upload] Analytics error for ${product.name}:`, err);
          }
        });
        await Promise.all(analyticsPromises);
        console.log(`[Upload] Sync done: ${rowCount} rows, ${products.length} products`);
        return res.json({
          success: true,
          message: `Berhasil! ${rowCount} data diproses, ${products.length} produk diupdate.`,
          processed: rowCount,
          products: products.length
        });
      } catch (err) {
        console.error(`[Upload] Sync error:`, err);
        return res.status(500).json({
          success: false,
          error: err instanceof Error ? err.message : "Gagal memproses file"
        });
      }
    }
    res.json({
      success: true,
      message: `Memproses ${rowCount} data di background (file besar). Refresh halaman dalam beberapa saat.`,
      processed: rowCount
    });
    setImmediate(async () => {
      try {
        console.log(`[Upload] Background processing ${rowCount} rows for user ${userIdStr}`);
        await bulkUpsertSales(userIdStr, uploadDatasetId, rows);
        const uniqueProducts = [...new Set(rows.map((r) => r.productName))].slice(0, 20);
        const products = await prisma.products.findMany({
          where: { user_id: userIdStr, name: { in: uniqueProducts } },
          select: { id: true, name: true }
        });
        for (const product of products) {
          try {
            const sales = await prisma.sales.findMany({
              where: { product_id: product.id, user_id: userIdStr },
              orderBy: { sale_date: "desc" },
              take: 60
            });
            if (sales.length >= 3) {
              const salesData = sales.map((s) => ({
                date: s.sale_date,
                quantity: Number(s.quantity),
                productName: product.name
              }));
              const analysis = await intelligenceService.analyzeProduct(product.id, product.name, salesData);
              if (analysis && sales[0]) {
                await upsertAnalyticsResult(userIdStr, uploadDatasetId, product.id, sales[0].sale_date, {
                  actualQty: Number(sales[0].quantity),
                  burstScore: analysis.realtime.burst.score,
                  burstLevel: analysis.realtime.burst.severity,
                  momentumCombined: analysis.realtime.momentum.combined,
                  momentumLabel: analysis.realtime.momentum.status,
                  aiInsight: { source: "upload-bg", method: analysis.forecast.method }
                });
              }
            }
          } catch (err) {
            console.error(`[Upload BG] Analytics error:`, err);
          }
        }
        console.log(`[Upload] Background done: ${rowCount} rows`);
      } catch (err) {
        console.error(`[Upload] Background error:`, err);
      }
    });
  } catch (error) {
    console.error("[SalesController] Upload error:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Gagal memproses file"
    });
  }
};

// src/middleware/authMiddleware.ts
var authenticateToken = requireAuth;

// src/routes/salesRoutes.ts
import multer from "multer";
var router2 = Router();
var upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }
  // 10MB limit
});
router2.use(authenticateToken);
router2.post("/", createSalesEntry);
router2.post("/bulk", createBulkSales);
router2.post("/upload", upload.single("file"), uploadSalesFile);
router2.get("/", getSalesData2);
router2.get("/history", getSalesHistory);
router2.get("/:id", getSalesById);
router2.delete("/:id", deleteSales);
var salesRoutes_default = router2;

// src/routes/authRoutes.ts
import express2 from "express";
import rateLimit from "express-rate-limit";

// lib/auth/supabaseAdmin.ts
import { createClient } from "@supabase/supabase-js";
var supabaseUrl = process.env.SUPABASE_URL;
var supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl) {
  throw new Error("SUPABASE_URL wajib ada di .env");
}
if (!supabaseServiceKey) {
  throw new Error("SUPABASE_SERVICE_ROLE_KEY wajib ada di .env untuk operasi admin");
}
var supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

// src/controllers/authController.ts
var emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
var COMMON_PASSWORDS = [
  "password",
  "123456",
  "12345678",
  "qwerty",
  "abc123",
  "password123",
  "admin",
  "letmein",
  "welcome",
  "monkey",
  "1234567890",
  "password1"
];
function validateEmail(email) {
  return !!email && emailRegex.test(email);
}
function validatePassword(password) {
  if (!password) {
    return { isValid: false, error: "Password diperlukan" };
  }
  if (password.length < 12) {
    return { isValid: false, error: "Password minimal 12 karakter" };
  }
  if (password.length > 128) {
    return { isValid: false, error: "Password maksimal 128 karakter" };
  }
  if (!/[A-Z]/.test(password)) {
    return { isValid: false, error: "Password harus mengandung minimal 1 huruf besar" };
  }
  if (!/[a-z]/.test(password)) {
    return { isValid: false, error: "Password harus mengandung minimal 1 huruf kecil" };
  }
  if (!/[0-9]/.test(password)) {
    return { isValid: false, error: "Password harus mengandung minimal 1 angka" };
  }
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    return { isValid: false, error: "Password harus mengandung minimal 1 karakter khusus (!@#$%^&*...)" };
  }
  if (COMMON_PASSWORDS.includes(password.toLowerCase())) {
    return { isValid: false, error: "Password terlalu umum, gunakan password yang lebih kuat" };
  }
  return { isValid: true };
}
function validatePasswordSimple(password) {
  return !!password && password.length >= 6;
}
async function findUserByEmail(email) {
  const { data, error } = await supabaseAdmin.auth.admin.listUsers();
  if (error) {
    throw new Error(error.message);
  }
  return data?.users.find(
    (u) => u.email && u.email.toLowerCase() === email.toLowerCase()
  );
}
async function checkEmail(req, res) {
  try {
    const { email } = req.body;
    if (!validateEmail(email)) {
      return res.status(400).json({ success: false, error: "Email tidak valid" });
    }
    const user = await findUserByEmail(email);
    return res.json({
      success: true,
      data: { exists: Boolean(user) }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Terjadi kesalahan";
    return res.status(500).json({ success: false, error: message });
  }
}
async function register(req, res) {
  try {
    const { email, password, name } = req.body;
    if (!validateEmail(email)) {
      return res.status(400).json({ success: false, error: "Email tidak valid" });
    }
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
      return res.status(400).json({ success: false, error: passwordValidation.error });
    }
    const existing = await findUserByEmail(email);
    if (existing) {
      return res.status(400).json({ success: false, error: "Email sudah terdaftar" });
    }
    const { data: signUpData, error: signUpError } = await supabaseAdmin.auth.signUp({
      email,
      password,
      options: {
        data: name ? { full_name: name } : {},
        emailRedirectTo: `${process.env.FRONTEND_URL || "http://localhost:3000"}/login?verified=true`
      }
    });
    if (signUpError || !signUpData?.user) {
      const message = signUpError?.message || "Gagal membuat akun";
      return res.status(500).json({ success: false, error: message });
    }
    if (signUpData.session) {
      const { access_token, refresh_token } = signUpData.session;
      return res.status(201).json({
        success: true,
        data: {
          access_token,
          refresh_token,
          user: {
            id: signUpData.user.id,
            email: signUpData.user.email
          }
        }
      });
    } else {
      return res.status(201).json({
        success: true,
        message: "Registrasi berhasil! Silakan cek email Anda untuk verifikasi.",
        data: {
          user: {
            id: signUpData.user.id,
            email: signUpData.user.email
          },
          requires_verification: true
        }
      });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Terjadi kesalahan";
    return res.status(500).json({ success: false, error: message });
  }
}
async function login(req, res) {
  try {
    const { email, password } = req.body;
    if (!validateEmail(email)) {
      return res.status(400).json({ success: false, error: "Email tidak valid" });
    }
    if (!validatePasswordSimple(password)) {
      return res.status(400).json({ success: false, error: "Password minimal 6 karakter" });
    }
    const existing = await findUserByEmail(email);
    if (!existing) {
      return res.status(400).json({ success: false, error: "Email belum terdaftar" });
    }
    const { data: sessionData, error: signInError } = await supabaseAdmin.auth.signInWithPassword({ email, password });
    if (signInError || !sessionData.session) {
      const message = signInError?.message || "Email atau password salah";
      return res.status(401).json({ success: false, error: message });
    }
    const { access_token, refresh_token, user } = sessionData.session;
    return res.json({
      success: true,
      data: {
        access_token,
        refresh_token,
        user: {
          id: user.id,
          email: user.email
        }
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Terjadi kesalahan";
    return res.status(500).json({ success: false, error: message });
  }
}

// src/routes/authRoutes.ts
var router3 = express2.Router();
var authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1e3,
  // 15 minutes
  max: 10,
  // 10 attempts per 15 minutes
  message: {
    success: false,
    error: "Terlalu banyak percobaan. Silakan coba lagi dalam 15 menit."
  },
  standardHeaders: true,
  legacyHeaders: false
});
var registerRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1e3,
  // 1 hour
  max: 5,
  // 5 registrations per hour per IP
  message: {
    success: false,
    error: "Batas registrasi tercapai. Silakan coba lagi dalam 1 jam."
  },
  standardHeaders: true,
  legacyHeaders: false
});
var checkEmailRateLimiter = rateLimit({
  windowMs: 5 * 60 * 1e3,
  // 5 minutes
  max: 20,
  // 20 checks per 5 minutes
  message: {
    success: false,
    error: "Terlalu banyak permintaan. Silakan coba lagi."
  },
  standardHeaders: true,
  legacyHeaders: false
});
router3.post("/check-email", checkEmailRateLimiter, checkEmail);
router3.post("/register", registerRateLimiter, register);
router3.post("/login", authRateLimiter, login);
var authRoutes_default = router3;

// src/routes/reportRoutes.ts
import express3 from "express";

// src/controllers/reportController.ts
var getWeeklyReport = async (req, res) => {
  try {
    const userId = req.user?.sub;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const endDate = /* @__PURE__ */ new Date();
    const startDate = /* @__PURE__ */ new Date();
    startDate.setDate(endDate.getDate() - 7);
    const prevWeekEnd = new Date(startDate);
    prevWeekEnd.setDate(prevWeekEnd.getDate() - 1);
    const prevWeekStart = new Date(prevWeekEnd);
    prevWeekStart.setDate(prevWeekStart.getDate() - 7);
    const summary = await prisma.sales.aggregate({
      _sum: {
        quantity: true,
        revenue: true
      },
      where: {
        user_id: userId,
        sale_date: {
          gte: startDate,
          lte: endDate
        }
      }
    });
    const prevSummary = await prisma.sales.aggregate({
      _sum: {
        quantity: true,
        revenue: true
      },
      where: {
        user_id: userId,
        sale_date: {
          gte: prevWeekStart,
          lte: prevWeekEnd
        }
      }
    });
    const currQty = Number(summary._sum.quantity) || 0;
    const prevQty = Number(prevSummary._sum.quantity) || 0;
    const currRev = Number(summary._sum.revenue) || 0;
    const prevRev = Number(prevSummary._sum.revenue) || 0;
    const qtyChange = prevQty > 0 ? (currQty - prevQty) / prevQty * 100 : 0;
    const revChange = prevRev > 0 ? (currRev - prevRev) / prevRev * 100 : 0;
    const dailySales = await prisma.sales.groupBy({
      by: ["sale_date"],
      _sum: { quantity: true, revenue: true },
      where: {
        user_id: userId,
        sale_date: { gte: startDate, lte: endDate }
      },
      orderBy: { sale_date: "asc" }
    });
    const dailyData = dailySales.map((d) => ({
      date: d.sale_date.toISOString().split("T")[0],
      quantity: Number(d._sum.quantity) || 0,
      revenue: Number(d._sum.revenue) || 0
    }));
    const topStats = await prisma.sales.groupBy({
      by: ["product_id"],
      _sum: { quantity: true, revenue: true },
      where: {
        user_id: userId,
        sale_date: { gte: startDate, lte: endDate }
      },
      orderBy: {
        _sum: { quantity: "desc" }
      },
      take: 10
    });
    const topPerformers = await Promise.all(topStats.map(async (item) => {
      const product = await prisma.products.findUnique({
        where: { id: item.product_id }
      });
      const analytics = await prisma.daily_analytics.findFirst({
        where: { product_id: item.product_id },
        orderBy: { metric_date: "desc" }
      });
      return {
        id: item.product_id,
        name: product?.name || "Unknown",
        quantity: Number(item._sum.quantity) || 0,
        revenue: Number(item._sum.revenue) || 0,
        momentum: analytics?.momentum_label || "STABLE",
        momentumValue: Number(analytics?.momentum_combined || 0),
        burstLevel: analytics?.burst_level || "NORMAL"
      };
    }));
    const attentionDate = /* @__PURE__ */ new Date();
    attentionDate.setDate(attentionDate.getDate() - 3);
    const issues = await prisma.daily_analytics.findMany({
      where: {
        user_id: userId,
        metric_date: { gte: attentionDate },
        OR: [
          { burst_level: "CRITICAL" },
          { burst_level: "HIGH" },
          { momentum_label: "FALLING" },
          { momentum_label: "DECLINING" }
        ]
      },
      include: { products: true },
      orderBy: { metric_date: "desc" },
      take: 5
    });
    const attentionNeeded = issues.map((item) => ({
      id: item.product_id,
      name: item.products.name,
      date: item.metric_date,
      status: item.burst_level === "CRITICAL" ? "VIRAL SPIKE" : item.burst_level === "HIGH" ? "BURST" : "DECLINING",
      detail: item.burst_level === "CRITICAL" ? `Lonjakan ${Number(item.burst_score).toFixed(1)}x dari biasanya!` : item.burst_level === "HIGH" ? `Penjualan naik ${Number(item.burst_score).toFixed(1)}x` : `Momentum: ${(Number(item.momentum_combined) * 100).toFixed(1)}%`,
      priority: item.burst_level === "CRITICAL" ? "critical" : item.burst_level === "HIGH" ? "high" : "medium"
    }));
    const insights = [];
    if (qtyChange > 10) {
      insights.push(`\u{1F4C8} Penjualan minggu ini naik ${qtyChange.toFixed(1)}% dibanding minggu lalu. Pertahankan momentum!`);
    } else if (qtyChange < -10) {
      insights.push(`\u{1F4C9} Penjualan turun ${Math.abs(qtyChange).toFixed(1)}% dari minggu lalu. Perlu strategi baru.`);
    } else {
      insights.push(`\u27A1\uFE0F Penjualan stabil dibanding minggu lalu.`);
    }
    if (topPerformers.length > 0) {
      const bestProduct = topPerformers[0];
      insights.push(`\u{1F3C6} ${bestProduct.name} jadi produk terlaris dengan ${bestProduct.quantity} terjual.`);
    }
    const viralProducts = attentionNeeded.filter((a) => a.status === "VIRAL SPIKE");
    if (viralProducts.length > 0) {
      insights.push(`\u{1F525} ${viralProducts.length} produk mengalami lonjakan viral! Pastikan stok tersedia.`);
    }
    const decliningProducts = attentionNeeded.filter((a) => a.status === "DECLINING");
    if (decliningProducts.length > 0) {
      insights.push(`\u26A0\uFE0F ${decliningProducts.length} produk mengalami penurunan. Pertimbangkan promo atau bundling.`);
    }
    const allProducts = await prisma.products.findMany({
      where: { user_id: userId, is_active: true },
      select: { id: true }
    });
    const productIds = allProducts.map((p) => p.id);
    const latestAnalytics = await prisma.$queryRaw`
      SELECT DISTINCT ON (product_id)
        product_id,
        momentum_label
      FROM daily_analytics
      WHERE product_id = ANY(${productIds}::uuid[])
      ORDER BY product_id, metric_date DESC
    `;
    const analyticsMap = new Map(latestAnalytics.map((a) => [a.product_id, a.momentum_label]));
    const statusCounts = {
      trending_up: 0,
      growing: 0,
      stable: 0,
      declining: 0,
      falling: 0
    };
    productIds.forEach((productId) => {
      const label = analyticsMap.get(productId);
      switch (label) {
        case "TRENDING_UP":
          statusCounts.trending_up++;
          break;
        case "GROWING":
          statusCounts.growing++;
          break;
        case "DECLINING":
          statusCounts.declining++;
          break;
        case "FALLING":
          statusCounts.falling++;
          break;
        default:
          statusCounts.stable++;
          break;
      }
    });
    res.json({
      success: true,
      data: {
        dateRange: {
          start: startDate.toISOString().split("T")[0],
          end: endDate.toISOString().split("T")[0]
        },
        summary: {
          totalQuantity: currQty,
          totalRevenue: currRev,
          quantityChange: Math.round(qtyChange * 10) / 10,
          revenueChange: Math.round(revChange * 10) / 10,
          prevWeekQuantity: prevQty,
          prevWeekRevenue: prevRev
        },
        dailyData,
        topPerformers,
        attentionNeeded,
        insights,
        statusCounts
      }
    });
  } catch (error) {
    console.error("Weekly Report Error:", error);
    res.status(500).json({ error: "Gagal membuat laporan mingguan" });
  }
};

// src/routes/reportRoutes.ts
var router4 = express3.Router();
router4.use(requireAuth);
router4.get("/weekly", getWeeklyReport);
var reportRoutes_default = router4;

// src/routes/intelligenceRoutes.ts
import { Router as Router2 } from "express";
var router5 = Router2();
router5.use(authenticateToken);
router5.get("/analyze/:productId", async (req, res) => {
  try {
    const { productId } = req.params;
    const userId = req.user?.sub;
    const forecastDays = Math.min(30, Math.max(7, Number(req.query.days) || 7));
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized"
      });
    }
    const product = await prisma.products.findFirst({
      where: {
        id: productId,
        user_id: userId
        // Ensure user owns this product
      }
    });
    if (!product) {
      return res.status(404).json({
        success: false,
        error: "Product not found"
      });
    }
    const salesHistory = await prisma.sales.findMany({
      where: {
        product_id: productId,
        user_id: userId
      },
      select: {
        sale_date: true,
        quantity: true
      },
      orderBy: {
        sale_date: "desc"
        // grab the most recent data points first
      },
      take: 60
    });
    const salesData = salesHistory.map((s) => ({
      date: s.sale_date,
      quantity: Number(s.quantity),
      productName: product.name
    })).reverse();
    const intelligence = await intelligenceService.analyzeProduct(
      product.id,
      product.name,
      salesData,
      forecastDays
    );
    res.json({
      success: true,
      data: intelligence
    });
  } catch (error) {
    console.error("[IntelligenceRoutes] Analyze error:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to analyze product"
    });
  }
});
router5.get("/weekly-report", async (req, res) => {
  try {
    const userId = req.user?.sub;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const topNParam = Number(req.query.topN ?? req.query.top_n ?? 10);
    const topN = Number.isFinite(topNParam) && topNParam > 0 ? topNParam : 10;
    const report = await intelligenceService.getWeeklyReport(userId, topN);
    res.json(report);
  } catch (error) {
    console.error("[IntelligenceRoutes] weekly-report error:", error);
    res.status(500).json({ error: "Failed to fetch weekly report" });
  }
});
router5.get("/trending", async (req, res) => {
  try {
    const userId = req.user?.sub;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const trending = await intelligenceService.getTrendingProducts(userId);
    res.json(trending);
  } catch (error) {
    console.error("[IntelligenceRoutes] trending error:", error);
    res.status(500).json({ error: "Failed to fetch trending products" });
  }
});
var intelligenceRoutes_default = router5;

// src/routes/analyticsRoutes.ts
import { Router as Router3 } from "express";

// src/controllers/analyticsController.ts
function detectBurst(salesData) {
  if (!salesData || salesData.length < 5) {
    return { score: 0, severity: "NORMAL", classification: "NORMAL" };
  }
  const quantities = salesData.map((d) => Number(d.quantity));
  const baseline = quantities.slice(0, -1);
  const latest = quantities[quantities.length - 1];
  const mean = baseline.reduce((sum, val) => sum + val, 0) / (baseline.length || 1);
  const variance = baseline.reduce((sum, val) => sum + (val - mean) ** 2, 0) / (baseline.length || 1);
  const stdDev = Math.sqrt(variance) || 1;
  const zScore = (latest - mean) / stdDev;
  let severity = "NORMAL";
  if (zScore > 3) severity = "CRITICAL";
  else if (zScore > 2) severity = "HIGH";
  else if (zScore > 1.5) severity = "MEDIUM";
  let classification = "NORMAL";
  if (severity !== "NORMAL") {
    const lastDate = new Date(salesData[salesData.length - 1].date);
    const day = lastDate.getDay();
    classification = day === 0 || day === 6 ? "SEASONAL" : "SPIKE";
  }
  return { score: Number(zScore.toFixed(2)), severity, classification };
}
var AnalyticsController = class {
  /**
   * GET /api/analytics/summary
   * Get dashboard summary with today's stats, burst alerts, and top products
   */
  static async getDashboardSummary(req, res) {
    try {
      const userId = req.user?.sub;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: "User tidak terotentikasi"
        });
      }
      const today = /* @__PURE__ */ new Date();
      today.setHours(0, 0, 0, 0);
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const todaySales = await prisma.sales.findMany({
        where: {
          user_id: userId,
          sale_date: {
            gte: today
          }
        },
        include: {
          products: true
        }
      });
      const yesterdaySales = await prisma.sales.findMany({
        where: {
          user_id: userId,
          sale_date: {
            gte: yesterday,
            lt: today
          }
        }
      });
      const todayTotal = todaySales.reduce((sum, sale) => sum + Number(sale.quantity), 0);
      const todayRevenue = todaySales.reduce((sum, sale) => sum + Number(sale.revenue || 0), 0);
      const yesterdayTotal = yesterdaySales.reduce((sum, sale) => sum + Number(sale.quantity), 0);
      const yesterdayRevenue = yesterdaySales.reduce((sum, sale) => sum + Number(sale.revenue || 0), 0);
      const quantityChange = yesterdayTotal > 0 ? (todayTotal - yesterdayTotal) / yesterdayTotal * 100 : 0;
      const revenueChange = yesterdayRevenue > 0 ? (todayRevenue - yesterdayRevenue) / yesterdayRevenue * 100 : 0;
      const userProducts = await prisma.products.findMany({
        where: { user_id: userId, is_active: true },
        select: { id: true, name: true }
      });
      const burstAlerts = [];
      for (const product of userProducts) {
        try {
          const salesHistory = await getSalesData(userId, product.id, 14);
          if (salesHistory.length >= 5) {
            const burst = detectBurst(salesHistory);
            if (burst.severity === "HIGH" || burst.severity === "CRITICAL") {
              burstAlerts.push({
                product_id: product.id,
                product_name: product.name,
                burst_score: burst.score,
                burst_level: burst.severity
              });
            }
          }
        } catch (err) {
          console.error(`[AnalyticsController] Error checking burst for ${product.id}:`, err);
        }
      }
      burstAlerts.sort((a, b) => b.burst_score - a.burst_score);
      const productSales = todaySales.reduce((acc, sale) => {
        const id = sale.product_id;
        if (!acc[id]) {
          acc[id] = {
            product_id: id,
            product_name: sale.products?.name || "Unknown",
            quantity: 0
          };
        }
        acc[id].quantity += Number(sale.quantity);
        return acc;
      }, {});
      const topProducts = Object.values(productSales).sort((a, b) => b.quantity - a.quantity).slice(0, 3);
      res.json({
        success: true,
        summary: {
          today: {
            total_quantity: todayTotal,
            total_revenue: todayRevenue,
            sales_count: todaySales.length
          },
          changes: {
            quantity_change: Math.round(quantityChange * 10) / 10,
            revenue_change: Math.round(revenueChange * 10) / 10
          },
          burst_alerts: burstAlerts.slice(0, 5),
          // Return top 5 burst alerts
          top_products: topProducts
        }
      });
    } catch (error) {
      console.error("[AnalyticsController] Summary error:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Gagal mendapatkan summary"
      });
    }
  }
  /**
   * GET /api/analytics/products/:productId/forecast
   * Get ML forecast for a specific product
   */
  static async getProductForecast(req, res) {
    try {
      const { productId } = req.params;
      const days = parseInt(req.query.days) || 7;
      const userId = req.user?.sub;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: "User tidak terotentikasi"
        });
      }
      const product = await prisma.products.findFirst({
        where: {
          id: productId,
          user_id: userId
          // Ensure user owns this product
        }
      });
      if (!product) {
        return res.status(404).json({
          success: false,
          error: "Product tidak ditemukan"
        });
      }
      const salesHistory = await getSalesData(userId, productId, 60);
      const analysis = await intelligenceService.analyzeProduct(
        product.id,
        product.name,
        salesHistory
      );
      res.json({
        success: true,
        product: {
          id: product.id,
          name: product.name,
          unit: product.unit,
          price: product.price
        },
        ...analysis
      });
    } catch (error) {
      console.error("[AnalyticsController] Forecast error:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Gagal mendapatkan forecast"
      });
    }
  }
  /**
   * GET /api/analytics/reports/weekly
   * Get weekly analytics report with ML rankings
   */
  static async getWeeklyReport(req, res) {
    try {
      const topN = parseInt(req.query.top_n) || 10;
      const userId = req.user?.sub;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: "User tidak terotentikasi"
        });
      }
      const report = await intelligenceService.getWeeklyReport(userId, topN);
      res.json({
        success: true,
        ...report
      });
    } catch (error) {
      console.error("[AnalyticsController] Weekly report error:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Gagal mendapatkan weekly report"
      });
    }
  }
  /**
   * GET /api/analytics/products/ranking
   * Get product ranking based on ML priority scores
   */
  static async getProductRanking(req, res) {
    try {
      const limit = parseInt(req.query.limit) || 50;
      const userId = req.user?.sub;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: "User tidak terotentikasi"
        });
      }
      const report = await intelligenceService.getWeeklyReport(userId, limit);
      res.json({
        success: true,
        rankings: report.topPerformers || [],
        summary: report.summary,
        generatedAt: report.generatedAt
      });
    } catch (error) {
      console.error("[AnalyticsController] Ranking error:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Gagal mendapatkan ranking"
      });
    }
  }
  /**
   * GET /api/analytics/products/:productId/insights
   * Get AI insights for a specific product
   */
  static async getProductInsights(req, res) {
    try {
      const { productId } = req.params;
      const userId = req.user?.sub;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: "User tidak terotentikasi"
        });
      }
      const product = await prisma.products.findFirst({
        where: {
          id: productId,
          user_id: userId
        }
      });
      if (!product) {
        return res.status(404).json({
          success: false,
          error: "Product tidak ditemukan"
        });
      }
      const analytics = await prisma.daily_analytics.findFirst({
        where: { product_id: productId },
        orderBy: { metric_date: "desc" }
      });
      if (!analytics) {
        return res.status(404).json({
          success: false,
          error: "Analytics belum tersedia"
        });
      }
      res.json({
        success: true,
        product: {
          id: product.id,
          name: product.name
        },
        insights: {
          momentum: {
            combined: Number(analytics.momentum_combined || 0),
            status: analytics.momentum_label || "UNKNOWN"
          },
          burst: {
            score: Number(analytics.burst_score || 0),
            level: analytics.burst_level || "NORMAL",
            type: analytics.burst_type || "NORMAL"
          },
          priority: {
            score: Number(analytics.priority_score || 0),
            rank: analytics.priority_rank || null
          },
          ai_insight: analytics.ai_insight || null
        },
        lastUpdated: analytics.updated_at
      });
    } catch (error) {
      console.error("[AnalyticsController] Insights error:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Gagal mendapatkan insights"
      });
    }
  }
  /**
   * GET /api/analytics/trending
   * Get trending products (burst alerts)
   */
  static async getTrendingProducts(req, res) {
    try {
      const userId = req.user?.sub;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: "User tidak terotentikasi"
        });
      }
      const trending = await intelligenceService.getTrendingProducts(userId);
      res.json({
        success: true,
        trending: trending.topPerformers || [],
        count: trending.topPerformers?.length || 0,
        generatedAt: trending.generatedAt
      });
    } catch (error) {
      console.error("[AnalyticsController] Trending error:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Gagal mendapatkan trending products"
      });
    }
  }
};

// src/routes/analyticsRoutes.ts
var router6 = Router3();
router6.use(authenticateToken);
router6.get("/summary", AnalyticsController.getDashboardSummary);
router6.get("/products/:productId/forecast", AnalyticsController.getProductForecast);
router6.get("/products/:productId/insights", AnalyticsController.getProductInsights);
router6.get("/products/ranking", AnalyticsController.getProductRanking);
router6.get("/reports/weekly", AnalyticsController.getWeeklyReport);
router6.get("/trending", AnalyticsController.getTrendingProducts);
var analyticsRoutes_default = router6;

// src/routes/sentimentRoutes.ts
import express4 from "express";
import axios3 from "axios";
import multer2 from "multer";
import FormData from "form-data";
import Papa from "papaparse";
var router7 = express4.Router();
var ML_API_URL3 = (process.env.ML_API_URL || "http://localhost:8000").replace(/\/$/, "");
var idToEnMap = {
  // Positif
  "bagus": "good",
  "baik": "good",
  "terbaik": "excellent",
  "mantap": "great",
  "suka": "love",
  "cinta": "love",
  "puas": "satisfied",
  "senang": "happy",
  "ramah": "friendly",
  "nyaman": "comfortable",
  "recommended": "recommended",
  "rekomendasi": "recommended",
  "rekomen": "recommended",
  "enak": "delicious",
  "lezat": "delicious",
  "nikmat": "delicious",
  "segar": "fresh",
  "murah": "cheap",
  "terjangkau": "affordable",
  "bersih": "clean",
  "cepat": "fast",
  "keren": "cool",
  "hebat": "great",
  "favorit": "favorite",
  "sempurna": "perfect",
  "mantul": "great",
  "gokil": "amazing",
  "kece": "cool",
  "jos": "great",
  "top": "top",
  "asik": "fun",
  "worthit": "worth",
  "worth": "worth",
  // Negatif
  "buruk": "bad",
  "jelek": "bad",
  "parah": "awful",
  "terburuk": "worst",
  "mengecewakan": "disappointing",
  "kecewa": "disappointed",
  "benci": "hate",
  "payah": "terrible",
  "sampah": "trash",
  "lambat": "slow",
  "lemot": "slow",
  "mahal": "expensive",
  "kotor": "dirty",
  "jorok": "dirty",
  "bau": "smelly",
  "palsu": "fake",
  "bohong": "lie",
  "tipu": "scam",
  "rusak": "broken",
  "zonk": "bad",
  "gagal": "failed",
  "kapok": "regret",
  "nyesel": "regret",
  "rugi": "loss",
  "menyesal": "regret",
  "hancur": "ruined",
  "busuk": "rotten",
  // Netral
  "biasa": "ordinary",
  "standar": "standard",
  "lumayan": "okay",
  // Negasi
  "tidak": "not",
  "nggak": "not",
  "enggak": "not",
  "gak": "not",
  "ga": "not",
  "ngga": "not",
  "tak": "not",
  // Intensifier
  "sangat": "very",
  "banget": "really",
  "sekali": "very",
  "bgt": "really"
};
var translateIdToEn = (text) => {
  let lower = (text || "").toLowerCase();
  const phrases = [
    ["bagus banget", "very good"],
    ["enak banget", "very delicious"],
    ["mantap banget", "very great"],
    ["suka banget", "really love"],
    ["buruk banget", "very bad"],
    ["jelek banget", "very bad"],
    ["kecewa banget", "very disappointed"],
    ["mahal banget", "very expensive"],
    ["kotor banget", "very dirty"],
    ["lambat banget", "very slow"],
    ["recommended banget", "highly recommended"],
    ["puas banget", "very satisfied"],
    ["biasa saja", "average"],
    ["biasa aja", "average"],
    ["tidak enak", "not tasty"],
    ["ga enak", "not tasty"],
    ["gak enak", "not tasty"],
    ["tidak bagus", "not good"],
    ["ga bagus", "not good"],
    ["gak bagus", "not good"],
    ["wajib coba", "must try"],
    ["harus coba", "must try"]
  ];
  for (const [src, dst] of phrases) {
    if (lower.includes(src)) {
      lower = lower.replace(new RegExp(src, "g"), dst);
    }
  }
  const tokens = lower.split(/\s+/);
  const translated = tokens.map((tok) => idToEnMap[tok] || tok);
  return translated.join(" ");
};
var simpleSentiment = (text) => {
  const originalLower = (text || "").toLowerCase();
  const t = translateIdToEn(text);
  const positives = [
    "good",
    "great",
    "amazing",
    "love",
    "nice",
    "excellent",
    "best",
    "wonderful",
    "awesome",
    "affordable",
    "happy",
    "delicious",
    "friendly",
    "comfortable",
    "recommended",
    "fresh",
    "clean",
    "fast",
    "cool",
    "perfect",
    "satisfied",
    "worth",
    "favorite",
    "beautiful",
    "fantastic"
  ];
  const negatives = [
    "bad",
    "terrible",
    "worst",
    "awful",
    "poor",
    "hate",
    "sad",
    "angry",
    "dirty",
    "expensive",
    "disappointing",
    "disappointed",
    "slow",
    "smelly",
    "fake",
    "scam",
    "broken",
    "ruined",
    "trash",
    "regret",
    "failed",
    "rotten"
  ];
  const positivesId = [
    "bagus",
    "baik",
    "enak",
    "mantap",
    "suka",
    "cinta",
    "puas",
    "senang",
    "ramah",
    "nyaman",
    "recommended",
    "rekomendasi",
    "rekomen",
    "lezat",
    "nikmat",
    "segar",
    "murah",
    "bersih",
    "cepat",
    "keren",
    "hebat",
    "favorit",
    "sempurna",
    "gokil",
    "kece",
    "jos",
    "top",
    "worthit",
    "mantul"
  ];
  const negativesId = [
    "buruk",
    "jelek",
    "parah",
    "terburuk",
    "mengecewakan",
    "kecewa",
    "benci",
    "payah",
    "sampah",
    "lambat",
    "lemot",
    "mahal",
    "kotor",
    "jorok",
    "bau",
    "palsu",
    "bohong",
    "tipu",
    "rusak",
    "zonk",
    "gagal",
    "kapok",
    "nyesel",
    "rugi",
    "menyesal",
    "hancur",
    "busuk"
  ];
  const neutralId = ["biasa", "standar", "lumayan", "cukup"];
  let score = 0;
  positives.forEach((w) => {
    if (t.includes(w)) score += 1;
  });
  negatives.forEach((w) => {
    if (t.includes(w)) score -= 1;
  });
  positivesId.forEach((w) => {
    if (originalLower.includes(w)) score += 1;
  });
  negativesId.forEach((w) => {
    if (originalLower.includes(w)) score -= 1;
  });
  const negationPatterns = [
    /tidak\s+\w*bagus/i,
    /tidak\s+\w*enak/i,
    /tidak\s+\w*puas/i,
    /ga\s+\w*bagus/i,
    /ga\s+\w*enak/i,
    /ga\s+\w*puas/i,
    /gak\s+\w*bagus/i,
    /gak\s+\w*enak/i,
    /gak\s+\w*puas/i,
    /nggak\s+\w*bagus/i,
    /nggak\s+\w*enak/i,
    /kurang\s+\w*bagus/i,
    /kurang\s+\w*enak/i,
    /kurang\s+\w*puas/i
  ];
  negationPatterns.forEach((pattern) => {
    if (pattern.test(originalLower)) score -= 2;
  });
  const isNeutral = neutralId.some((w) => originalLower.includes(w)) && Math.abs(score) < 2;
  let sentiment = "Neutral";
  const absScore = Math.abs(score);
  if (score > 0) sentiment = "Positive";
  else if (score < 0) sentiment = "Negative";
  else if (isNeutral) sentiment = "Neutral";
  const emoji = sentiment === "Positive" ? "\u{1F60A}" : sentiment === "Negative" ? "\u{1F61E}" : "\u{1F610}";
  const confidence = sentiment === "Neutral" ? 50 : Math.min(95, 55 + absScore * 10);
  return { sentiment, confidence, emoji };
};
var upload2 = multer2({
  storage: multer2.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  // 5MB
  fileFilter: (_req, file, cb) => {
    const nameOk = file.originalname.toLowerCase().endsWith(".csv");
    const typeOk = [
      "text/csv",
      "application/vnd.ms-excel",
      "application/octet-stream",
      "application/csv",
      "text/plain"
    ].includes(file.mimetype);
    if (nameOk || typeOk) return cb(null, true);
    cb(new Error("Only CSV files are allowed"));
  }
});
router7.post("/analyze-text", async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || typeof text !== "string") {
      return res.status(400).json({ error: "text is required" });
    }
    const response = await axios3.post(
      `${ML_API_URL3}/api/sentiment/analyze-text`,
      { text },
      { timeout: 2e4 }
    );
    return res.json(response.data);
  } catch (error) {
    const fallback = simpleSentiment(req.body?.text || "");
    const upstreamMsg = error?.response?.data?.error || error?.response?.data?.detail || error?.message || "Model utama tidak tersedia, menggunakan fallback heuristik.";
    return res.status(200).json({ success: true, result: fallback, warning: upstreamMsg });
  }
});
var uploadSingleCsv = (req, res, next) => {
  upload2.single("file")(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: err.message || "File upload error" });
    }
    next();
  });
};
router7.post("/analyze-file", uploadSingleCsv, async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: "CSV file is required" });
    }
    const formData = new FormData();
    formData.append("file", file.buffer, {
      filename: file.originalname || "upload.csv",
      contentType: file.mimetype || "text/csv"
    });
    const response = await axios3.post(`${ML_API_URL3}/api/sentiment/analyze-file`, formData, {
      headers: formData.getHeaders(),
      timeout: 3e4,
      maxContentLength: Infinity,
      maxBodyLength: Infinity
    });
    return res.json(response.data);
  } catch (error) {
    try {
      const file = req.file;
      if (!file) return res.status(400).json({ error: "CSV file is required" });
      const parsed = Papa.parse(file.buffer.toString("utf-8"), {
        header: true,
        skipEmptyLines: true
      });
      const rows = Array.isArray(parsed.data) ? parsed.data : [];
      let positive = 0, negative = 0, neutral = 0;
      const results = rows.map((row) => {
        const text = row?.Review || row?.review || row?.text || row?.clean_review || "";
        const r = simpleSentiment(text);
        if (r.sentiment.toLowerCase() === "positive") positive++;
        else if (r.sentiment.toLowerCase() === "negative") negative++;
        else neutral++;
        return { review: text, sentiment: r.sentiment, confidence: r.confidence, emoji: r.emoji };
      });
      const total = Math.max(1, results.length);
      const summary = {
        positive,
        negative,
        neutral,
        positive_pct: Math.round(positive / total * 1e4) / 100,
        negative_pct: Math.round(negative / total * 1e4) / 100,
        neutral_pct: Math.round(neutral / total * 1e4) / 100,
        total
      };
      const upstreamMsg = error?.response?.data?.error || error?.response?.data?.detail || (typeof error?.message === "string" ? error.message : "") || "Model utama tidak tersedia, menggunakan fallback heuristik.";
      return res.status(200).json({ success: true, summary, results, warning: upstreamMsg });
    } catch (fallbackErr) {
      const status = error?.response?.status || 500;
      const upstreamMsg = error?.response?.data?.error || error?.response?.data?.detail || (typeof error?.message === "string" ? error.message : "") || "Failed to analyze file";
      return res.status(status).json({ error: upstreamMsg });
    }
  }
});
var sentimentRoutes_default = router7;

// src/middleware/logger.ts
var isDev = process.env.NODE_ENV !== "production";
function requestLogger(req, res, next) {
  const start = Date.now();
  const log = {
    method: req.method,
    path: req.path,
    userId: req.user?.sub || "anonymous",
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  };
  if (isDev) {
    console.log(`[REQ] ${log.method} ${log.path} - User: ${log.userId}`);
  }
  res.on("finish", () => {
    const duration = Date.now() - start;
    const status = res.statusCode;
    if (isDev) {
      const statusColor = status >= 400 ? "\x1B[31m" : "\x1B[32m";
      console.log(`[RES] ${log.method} ${log.path} - ${statusColor}${status}\x1B[0m - ${duration}ms`);
    }
    if (duration > 5e3) {
      console.warn(`[SLOW] ${log.method} ${log.path} took ${duration}ms`);
    }
    if (status >= 500) {
      console.error(`[ERROR] ${log.method} ${log.path} - Status ${status}`);
    }
  });
  next();
}
function errorLogger(err, req, res, next) {
  console.error(`[ERROR] ${req.method} ${req.path}:`, err.message);
  if (isDev) {
    console.error(err.stack);
  }
  const message = isDev ? err.message : "Internal Server Error";
  res.status(500).json({
    success: false,
    error: message
  });
}

// src/index.ts
var app = express5();
var PORT = process.env.PORT || 5e3;
app.set("trust proxy", 1);
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"]
    }
  },
  crossOriginEmbedderPolicy: false
}));
var generalLimiter = rateLimit2({
  windowMs: 15 * 60 * 1e3,
  // 15 minutes
  max: 100,
  // 100 requests per windowMs
  message: { error: "Too many requests, please try again later." },
  standardHeaders: true,
  legacyHeaders: false
});
var authLimiter = rateLimit2({
  windowMs: 15 * 60 * 1e3,
  // 15 minutes
  max: 10,
  // 10 requests per windowMs for auth
  message: { error: "Too many authentication attempts, please try again later." },
  standardHeaders: true,
  legacyHeaders: false
});
var uploadLimiter = rateLimit2({
  windowMs: 60 * 60 * 1e3,
  // 1 hour
  max: 20,
  // 20 uploads per hour
  message: { error: "Upload limit reached, please try again later." },
  standardHeaders: true,
  legacyHeaders: false
});
app.use(generalLimiter);
var rawFrontend = process.env.FRONTEND_URL?.replace(/\/$/, "");
var frontendOrigins = rawFrontend ? Array.from(
  /* @__PURE__ */ new Set([
    rawFrontend,
    rawFrontend.replace(/^http:\/\//, "https://"),
    rawFrontend.replace(/^https:\/\//, "http://")
  ])
) : [];
var allowedOrigins = [...frontendOrigins, "http://localhost:3000"];
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) {
      return callback(null, true);
    }
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    if (process.env.NODE_ENV !== "production") {
      return callback(null, true);
    }
    return callback(new Error("Not allowed by CORS"), false);
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));
app.use(express5.json({ limit: "10mb" }));
app.use(express5.urlencoded({ extended: true, limit: "10mb" }));
app.use(requestLogger);
app.use(optionalAuth);
app.use("/api/auth", authRoutes_default);
app.use("/api/products", productRoutes_default);
app.use("/api/sales", salesRoutes_default);
app.use("/api/intelligence", intelligenceRoutes_default);
app.use("/api/analytics", analyticsRoutes_default);
app.use("/api/reports", reportRoutes_default);
app.use("/api/sentiment", sentimentRoutes_default);
app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    message: "Backend is running!",
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    routes: ["/api/products", "/api/products/ranking", "/api/products/:id"]
  });
});
app.use(errorLogger);
if (process.env.NODE_ENV !== "production") {
  app.listen(PORT, () => {
    console.log(`Backend running on port ${PORT}`);
  });
}
var index_default = app;
export {
  authLimiter,
  index_default as default,
  uploadLimiter
};
