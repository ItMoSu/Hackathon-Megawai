import { Request, Response } from 'express';
import { prisma } from '../../lib/database/schema'; 
import { bulkUpsertSales, upsertAnalyticsResult } from '../../lib/database/queries';
import { analyzeSales } from '../services/aiService';

export const createSalesEntry = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.sub;
    const { product_id, sale_date, quantity, dataset_id, product_name } = req.body;

    if (!userId) {
      return res.status(401).json({ 
        success: false,
        error: "User tidak terotentikasi" 
      });
    }

    if (!dataset_id) {
      return res.status(400).json({ 
        success: false,
        error: "Strict Mode: dataset_id is required. Please select a dataset first." 
      });
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
      source: 'MANUAL_INPUT' 
    }]);

    const history = await prisma.sales.findMany({
      where: { 
        product_id: product_id 
      },
      orderBy: { sale_date: 'desc' },
      take: 30
    });

    const aiResult = await analyzeSales({
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
          burstLevel: aiResult.status,
          aiInsight: JSON.stringify(aiResult.recommendation)
        }
      );
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
