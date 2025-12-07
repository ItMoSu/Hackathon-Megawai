import { Request, Response } from 'express';
import { prisma } from '../../lib/database/schema'; 

const allowedTrendRanges = new Set([7, 14, 30, 60, 90]);

function toStartOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function toEndOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function formatDate(date: Date) {
  return date.toISOString().split('T')[0];
}

export const getProducts = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.sub;

    if (!userId) {
      return res.status(401).json({ error: "User tidak terotentikasi" });
    }

    const allProducts = await prisma.products.findMany({
      where: { user_id: String(userId), is_active: true },
      orderBy: [
        { price: 'desc' }, // Prefer products with price
        { created_at: 'asc' }
      ]
    });

    // Deduplicate by name (case-insensitive), keep one with price
    const seenNames = new Set<string>();
    const products = allProducts.filter(p => {
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

// Validation patterns
const PRODUCT_NAME_REGEX = /^[a-zA-Z0-9\s\-\_\.\,\(\)]+$/;
const VALID_UNITS = ['pcs', 'porsi', 'cup', 'botol', 'bungkus', 'kg', 'box', 'unit', 'lembar', 'pack'];

const sanitizeString = (str: string): string => {
  return str.trim().slice(0, 100); // Max 100 chars
};

const validateProductName = (name: string): string | null => {
  if (!name || typeof name !== 'string') {
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

export const createProduct = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.sub;
    const { name, unit, price } = req.body;

    if (!userId) {
      return res.status(401).json({ error: "User tidak terotentikasi" });
    }

    // Validate product name with regex
    const nameError = validateProductName(name);
    if (nameError) {
      return res.status(400).json({ error: nameError });
    }

    // Sanitize and validate unit
    const sanitizedUnit = unit ? sanitizeString(unit).toLowerCase() : 'pcs';
    if (!VALID_UNITS.includes(sanitizedUnit)) {
      return res.status(400).json({ error: "Unit tidak valid" });
    }

    // Validate price
    let parsedPrice = null;
    if (price !== undefined && price !== null && price !== '') {
      parsedPrice = parseFloat(price);
      if (isNaN(parsedPrice) || parsedPrice < 0 || parsedPrice > 999999999) {
        return res.status(400).json({ error: "Harga tidak valid" });
      }
    }

    const sanitizedName = sanitizeString(name);

    // Case-insensitive check for duplicate names
    const allProducts = await prisma.products.findMany({
      where: { user_id: userId },
      select: { name: true }
    });
    
    const isDuplicate = allProducts.some(
      p => p.name.toLowerCase() === sanitizedName.toLowerCase()
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

export const updateProduct = async (req: Request, res: Response) => {
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
        ...(name && { name }),
        ...(unit && { unit }),
        ...(price !== undefined && { price: price ? parseFloat(price) : null })
      }
    });

    res.json({ success: true, data: updated });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Gagal update produk" });
  }
};

export const getProductsWithRanking = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.sub;

    if (!userId) {
      return res.status(401).json({ error: "User tidak terotentikasi" });
    }

    // Get all products with their latest analytics
    const allProducts = await prisma.products.findMany({
      where: { user_id: String(userId), is_active: true },
      orderBy: [
        { price: 'desc' }, // Prefer products with price
        { created_at: 'asc' }
      ]
    });

    // Deduplicate by name (case-insensitive), keep one with price
    const seenNames = new Set<string>();
    const products = allProducts.filter(p => {
      const lowerName = p.name.toLowerCase();
      if (seenNames.has(lowerName)) return false;
      seenNames.add(lowerName);
      return true;
    });

    // Get product IDs for batch queries
    const productIds = products.map(p => p.id);

    // Batch fetch analytics for all products in ONE query
    const allAnalytics = await prisma.daily_analytics.findMany({
      where: { product_id: { in: productIds } },
      orderBy: { metric_date: 'desc' }
    });

    // Group analytics by product_id, keep only latest
    const analyticsMap = new Map<string, typeof allAnalytics[0]>();
    for (const a of allAnalytics) {
      if (!analyticsMap.has(a.product_id)) {
        analyticsMap.set(a.product_id, a);
      }
    }

    // Batch fetch ALL sales for sparkline (last 30 entries per product)
    const allSales = await prisma.sales.findMany({
      where: {
        product_id: { in: productIds }
      },
      orderBy: { sale_date: 'desc' },
      take: productIds.length * 30 // Rough estimate: 30 per product
    });

    // Group sales by product_id (keep last 7 for sparkline, sum all for total)
    const salesMap = new Map<string, number[]>();
    const totalSalesMap = new Map<string, number>();
    
    for (const s of allSales) {
      const qty = Number(s.quantity);
      
      // Add to total
      totalSalesMap.set(s.product_id, (totalSalesMap.get(s.product_id) || 0) + qty);
      
      // Add to sparkline (limit to 7 most recent)
      if (!salesMap.has(s.product_id)) {
        salesMap.set(s.product_id, []);
      }
      const arr = salesMap.get(s.product_id)!;
      if (arr.length < 7) {
        arr.push(qty);
      }
    }
    
    // Reverse sparkline data (oldest to newest for chart)
    for (const [key, arr] of salesMap) {
      salesMap.set(key, arr.reverse());
    }

    // Build result without additional DB calls
    const productsWithAnalytics = products.map(product => {
      const latestAnalytics = analyticsMap.get(product.id);
      const sparklineData = salesMap.get(product.id) || [];
      const totalSales = totalSalesMap.get(product.id) || 0;

      return {
        ...product,
        price: product.price ? Number(product.price) : null,
        analytics: latestAnalytics ? {
          momentum_combined: Number(latestAnalytics.momentum_combined || 0),
          momentum_label: latestAnalytics.momentum_label || 'STABLE',
          burst_score: Number(latestAnalytics.burst_score || 0),
          burst_level: latestAnalytics.burst_level || 'NORMAL',
          priority_score: Number(latestAnalytics.priority_score || 0),
          priority_rank: latestAnalytics.priority_rank
        } : null,
        sparkline: sparklineData,
        totalSales7d: totalSales // Now shows total of all time, not just 7 days
      };
    });

    // Sort by priority score (desc), then by total sales
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

export const getProductDetail = async (req: Request, res: Response) => {
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

    // Get analytics history (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const analyticsHistory = await prisma.daily_analytics.findMany({
      where: {
        product_id: id,
        metric_date: { gte: thirtyDaysAgo }
      },
      orderBy: { metric_date: 'asc' }
    });

    // Get sales history (last 30 days)
    const salesHistory = await prisma.sales.findMany({
      where: {
        product_id: id,
        sale_date: { gte: thirtyDaysAgo }
      },
      orderBy: { sale_date: 'asc' }
    });

    // Latest analytics
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
          momentum_label: latestAnalytics.momentum_label || 'STABLE',
          burst_score: Number(latestAnalytics.burst_score || 0),
          burst_level: latestAnalytics.burst_level || 'NORMAL',
          priority_score: Number(latestAnalytics.priority_score || 0)
        } : null,
        salesHistory: salesHistory.map(s => ({
          date: s.sale_date,
          quantity: Number(s.quantity),
          revenue: s.revenue ? Number(s.revenue) : null
        })),
        analyticsHistory: analyticsHistory.map(a => ({
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

export const getProductTrend = async (req: Request, res: Response) => {
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

    let productName: string | undefined;

    if (productId) {
      const product = await prisma.products.findFirst({
        where: { id: productId, user_id: String(userId) },
        select: { id: true, name: true },
      });

      if (!product) {
        return res.status(404).json({ error: "Produk tidak ditemukan" });
      }

      productName = product.name;
    }

    const sales = await prisma.sales.findMany({
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

    const dateMap = new Map<string, number>();
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
  } catch (error) {
    console.error('getProductTrend error:', error);
    res.status(500).json({ error: "Gagal mengambil data trend" });
  }
};

export const deleteProduct = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.sub;
    const { id } = req.params;

    console.log('Delete request:', { userId, productId: id });

    if (!userId) {
      return res.status(401).json({ error: "User tidak terotentikasi" });
    }

    // Check if product exists and belongs to user
    const existing = await prisma.products.findFirst({
      where: { id, user_id: String(userId) }
    });

    console.log('Found product:', existing);

    if (!existing) {
      return res.status(404).json({ error: "Produk tidak ditemukan atau bukan milik Anda" });
    }

    // Database has CASCADE on sales and daily_analytics, so just delete directly
    // Related records will be automatically deleted
    await prisma.products.delete({
      where: { id }
    });

    console.log('Product deleted successfully (with cascade)');

    res.json({ 
      success: true, 
      message: "Produk berhasil dihapus"
    });
  } catch (error: any) {
    console.error('deleteProduct error:', error);
    // More specific error messages
    if (error.code === 'P2025') {
      return res.status(404).json({ error: "Produk sudah tidak ada" });
    }
    if (error.code === 'P2003') {
      return res.status(400).json({ error: "Produk masih terhubung ke data lain" });
    }
    res.status(500).json({ error: error.message || "Gagal menghapus produk" });
  }
};
