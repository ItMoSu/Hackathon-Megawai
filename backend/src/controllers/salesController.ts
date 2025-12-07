import { Request, Response } from 'express';
import { prisma } from '../../lib/database/schema'; 
import { bulkUpsertSales, upsertAnalyticsResult } from '../../lib/database/queries';
import { intelligenceService } from '../services/intelligenceService';
import { generateBurstAnalytics } from '../services/burstService';
import { parseFile, parseFlexibleDate } from '../utils/fileParser';

/**
 * POST /api/sales
 * Create new sales entry with AI analysis
 */
export const createSalesEntry = async (req: Request, res: Response) => {
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
      let targetDataset = await prisma.datasets.findFirst({
        where: { 
          user_id: userId,
          source_file_type: 'csv'
        }
      });
      
      if (targetDataset) {
        dataset_id = targetDataset.id;
      } else {
        const newDataset = await prisma.datasets.create({
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
    await bulkUpsertSales(userId, dataset_id, [{
      productName: product_name, 
      date: saleDateObj,
      quantity: qtyNumber,
      source: 'csv' 
    }]);

    // 3. Find product ID if not provided
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

    // 4. ✅ NEW: AI Analysis with ML Service
    let aiAnalysis = null;

    if (product_id) {
      try {
        // Get sales history
        const history = await prisma.sales.findMany({
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
          const product = await prisma.products.findUnique({
            where: { id: product_id }
          });

          // Analyze with ML service
          aiAnalysis = await intelligenceService.analyzeProduct(
            product_id,
            product?.name || product_name,
            salesData
          );

          // Update daily analytics with AI results
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
                  source: 'intelligenceService',
                  method: aiAnalysis.forecast.method,
                  confidence: aiAnalysis.confidence.overall,
                  recommendations: aiAnalysis.recommendations,
                  trend: aiAnalysis.forecast.trend
                }
              }
            );
          }

          // ✅ Trigger burst analytics update for this date
          await generateBurstAnalytics(userId, saleDateObj);
        }
      } catch (analysisError) {
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

  } catch (error) {
    console.error("[SalesController] Error:", error);
    res.status(500).json({ 
      success: false,
      error: error instanceof Error ? error.message : "Server Error" 
    });
  }
};

/**
 * GET /api/sales
 * Get sales data (with optional filters)
 */
export const getSalesData = async (req: Request, res: Response) => {
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
    const where: any = { user_id: userId };
    
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
      orderBy: { sale_date: 'desc' },
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

/**
 * GET /api/sales/:id
 * Get single sales entry
 */
export const getSalesById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.sub;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User tidak terotentikasi'
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
        error: 'Sales data tidak ditemukan'
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

/**
 * DELETE /api/sales/:id
 * Delete sales entry
 */
export const deleteSales = async (req: Request, res: Response) => {
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
    const sale = await prisma.sales.findFirst({
      where: { id, user_id: userId }
    });

    if (!sale) {
      return res.status(404).json({
        success: false,
        error: 'Sales data tidak ditemukan'
      });
    }

    // Delete
    await prisma.sales.delete({
      where: { id }
    });

    res.json({
      success: true,
      message: 'Sales data berhasil dihapus'
    });

  } catch (error) {
    console.error("[SalesController] Delete sales error:", error);
    res.status(500).json({
      success: false,
      error: "Gagal menghapus data sales"
    });
  }
};

/**
 * POST /api/sales/bulk
 * Bulk create sales entries for multiple products at once
 */
export const createBulkSales = async (req: Request, res: Response) => {
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
    let targetDataset = await prisma.datasets.findFirst({
      where: { 
        user_id: userId,
        source_file_type: 'csv'
      }
    });
    
    let dataset_id: string;
    if (targetDataset) {
      dataset_id = targetDataset.id;
    } else {
      const newDataset = await prisma.datasets.create({
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
    const validEntries = entries.filter((e: any) => e.quantity > 0);

    if (validEntries.length === 0) {
      return res.status(400).json({
        success: false,
        error: "Tidak ada produk dengan quantity > 0"
      });
    }

    // Prepare bulk upsert data
    const salesData = validEntries.map((entry: any) => ({
      productName: entry.product_name,
      date: saleDateObj,
      quantity: Number(entry.quantity),
      source: 'csv'
    }));

    // Bulk upsert
    await bulkUpsertSales(userId, dataset_id, salesData);

    // Run AI analysis for each product (async, don't block response)
    const analysisPromises = validEntries.map(async (entry: any) => {
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
          orderBy: { sale_date: 'desc' },
          take: 60
        });

        if (history.length >= 5) {
          const salesHistory = history.map(h => ({
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
                  source: 'intelligenceService',
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

    // Don't await all analysis - let them run in background
    Promise.all(analysisPromises).catch(console.error);

    // Trigger burst analytics
    generateBurstAnalytics(userId, saleDateObj).catch(console.error);

    res.status(201).json({
      success: true,
      message: `${validEntries.length} produk berhasil disimpan`,
      data: {
        sale_date: saleDateObj.toISOString().split('T')[0],
        products_saved: validEntries.length,
        entries: validEntries.map((e: any) => ({
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

/**
 * GET /api/sales/history
 * Get recent sales history for display
 */
export const getSalesHistory = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.sub;
    const limit = Math.min(Number(req.query.limit) || 20, 100);

    if (!userId) {
      return res.status(401).json({ success: false, error: "User tidak terotentikasi" });
    }

    const sales = await prisma.sales.findMany({
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
  } catch (error) {
    console.error("[SalesController] History error:", error);
    res.status(500).json({ success: false, error: "Gagal mengambil riwayat" });
  }
};

/**
 * POST /api/sales/upload
 * Upload Excel/CSV/Word file for bulk sales import
 */
export const uploadSalesFile = async (req: Request, res: Response) => {
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

    // Parse file with dynamic column detection (supports CSV, Excel, DOCX)
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

    const { randomUUID } = require('crypto');
    const uploadDatasetId = randomUUID();
    const userIdStr = String(userId);
    const rowCount = rows.length;

    // For smaller files (< 5000 rows), process synchronously for better UX
    if (rowCount < 5000) {
      try {
        console.log(`[Upload] Sync processing ${rowCount} rows for user ${userIdStr}`);
        await bulkUpsertSales(userIdStr, uploadDatasetId, rows);
        
        // Generate basic analytics for uploaded products
        const uniqueProducts = [...new Set(rows.map(r => r.productName))];
        console.log(`[Upload] Generating analytics for ${uniqueProducts.length} products`);
        
        // Get product IDs
        const products = await prisma.products.findMany({
          where: { 
            user_id: userIdStr,
            name: { in: uniqueProducts }
          },
          select: { id: true, name: true }
        });

        // Generate basic analytics in parallel (limit concurrency)
        const analyticsPromises = products.slice(0, 20).map(async (product) => {
          try {
            // Get sales history
            const sales = await prisma.sales.findMany({
              where: { product_id: product.id, user_id: userIdStr },
              orderBy: { sale_date: 'desc' },
              take: 60
            });

            if (sales.length >= 3) {
              const salesData = sales.map(s => ({
                date: s.sale_date,
                quantity: Number(s.quantity),
                productName: product.name
              }));

              // Quick analysis
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
                    aiInsight: { source: 'upload', method: analysis.forecast.method }
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

    // For larger files, process in background
    res.json({ 
      success: true, 
      message: `Memproses ${rowCount} data di background (file besar). Refresh halaman dalam beberapa saat.`,
      processed: rowCount
    });

    // Process in background (after response sent)
    setImmediate(async () => {
      try {
        console.log(`[Upload] Background processing ${rowCount} rows for user ${userIdStr}`);
        await bulkUpsertSales(userIdStr, uploadDatasetId, rows);
        
        // Generate analytics for first 20 products
        const uniqueProducts = [...new Set(rows.map(r => r.productName))].slice(0, 20);
        const products = await prisma.products.findMany({
          where: { user_id: userIdStr, name: { in: uniqueProducts } },
          select: { id: true, name: true }
        });

        for (const product of products) {
          try {
            const sales = await prisma.sales.findMany({
              where: { product_id: product.id, user_id: userIdStr },
              orderBy: { sale_date: 'desc' },
              take: 60
            });

            if (sales.length >= 3) {
              const salesData = sales.map(s => ({
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
                  aiInsight: { source: 'upload-bg', method: analysis.forecast.method }
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
