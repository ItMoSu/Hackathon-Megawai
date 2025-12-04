import { Request, Response } from 'express';
import { prisma } from '../../lib/database/schema'; 
import { bulkUpsertSales, upsertAnalyticsResult } from '../../lib/database/queries';
import { analyzeSales } from '../services/aiService';

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

    // 1. Fallback Dataset ID (Jika Manual Input)
    if (!dataset_id) {
        const userDataset = await prisma.datasets.findFirst({
            where: { user_id: userId } 
        });
        if (userDataset) {
            dataset_id = userDataset.id;
        } else {
            return res.status(400).json({ error: "Dataset tidak ditemukan untuk user ini." });
        }
    }
    
    const saleDateObj = new Date(sale_date);
    const qtyNumber = Number(quantity);

    if (qtyNumber < 0) {
      return res.status(400).json({ 
        success: false, 
        error: "Quantity tidak boleh negatif" 
      });
    }

    await bulkUpsertSales(userId, dataset_id, [{
      productName: product_name, 
      date: saleDateObj,
      quantity: qtyNumber,
      source: 'manual' 
    }]);

    // 3. Cari Product ID (Hanya sekali saja!)
    if (!product_id && product_name) {
        const existingProduct = await prisma.products.findFirst({
            where: {
                name: product_name,
                dataset_id: dataset_id 
            }
        });
        if (existingProduct) {
            product_id = existingProduct.id;
        }
    }

    // 4. Analisis AI (Wajib dibungkus if product_id)
    let aiResult = null;

    if (product_id) {
        const history = await prisma.sales.findMany({
            where: { 
                product_id: product_id 
            },
            orderBy: { sale_date: 'desc' },
            take: 30
        });

        if (history.length > 0) {
            aiResult = await analyzeSales({
                current_qty: qtyNumber,
                history: history.map((h: typeof history[number]) => ({
                    date: h.sale_date,
                    quantity: Number(h.quantity)
                })),
                baseline_avg: 50 
            });

            if (aiResult) {
                await upsertAnalyticsResult(
                    userId,
                    dataset_id, 
                    product_id,
                    saleDateObj,
                    {
                        actualQty: qtyNumber,
                        burstScore: aiResult.burst_score,
                        burstLevel: aiResult.status.split('(')[0].trim(), 
                        aiInsight: JSON.stringify(aiResult.recommendation)
                    }
                );
            }
        }
    }

    res.status(201).json({
      success: true,
      message: "Data saved to Dataset & AI Analyzed",
      analysis: aiResult
    });

  } catch (error) {
    console.error("Sales Controller Error:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Server Error" });
  }
};

export const getSalesData = async (req: Request, res: Response) => {
  try {
    const salesData = await prisma.sales.findMany({
      orderBy: { sale_date: 'desc' },
      take: 100
    });

    res.status(200).json({
      success: true,
      data: salesData
    });
  } catch (error) {
    console.error("Error Get Sales:", error);
    res.status(500).json({ error: "Gagal mengambil data sales" });
  }
};