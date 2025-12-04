import { PrismaClient } from '@prisma/client';
import axios from 'axios';

const prisma = new PrismaClient();
const ML_API_URL = (process.env.ML_API_URL || 'http://localhost:8000').replace(/\/$/, '');

// ✅ UPDATED: Use ML API instead of hardcoded calculations
export const generateBurstAnalytics = async (userId: string, date: Date) => {
  try {
    // 1. Check if ML service is available
    const mlAvailable = await checkMLService();
    
    if (!mlAvailable) {
      console.warn('[BurstService] ML service offline, skipping burst analytics');
      return { processed: 0, message: 'ML service offline' };
    }

    // 2. Get all products for user
    const products = await prisma.products.findMany({
      where: { user_id: userId, is_active: true },
      select: { id: true, name: true, dataset_id: true }
    });

    if (products.length === 0) {
      return { processed: 0, message: 'No products found' };
    }

    // 3. Call ML weekly report to get burst analytics for all products
    const mlReport = await callMLWeeklyReport(10);
    
    if (!mlReport || !mlReport.success) {
      console.warn('[BurstService] ML report failed');
      return { processed: 0, message: 'ML report failed' };
    }

    // 4. Create map of ML data by product name
    const mlDataMap = new Map<string, any>();
    
    // Map top performers
    for (const perf of mlReport.report.top_performers || []) {
      mlDataMap.set(perf.product_id, {
        momentum_status: perf.momentum_status,
        burst_level: perf.burst_level,
        priority_score: perf.priority_score,
        avg_demand_7d: perf.avg_demand_7d
      });
    }
    
    // Map needs attention
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

    // Map all products data
    for (const [productId, productData] of Object.entries(mlReport.report.products || {})) {
      if (!mlDataMap.has(productId)) {
        const data: any = productData;
        mlDataMap.set(productId, {
          momentum_status: data.momentum?.status || 'STABLE',
          burst_level: data.burst?.level || 'NORMAL',
          priority_score: data.priority_score || 0,
          momentum_combined: data.momentum?.combined || 0,
          burst_score: data.burst?.burst_score || 0
        });
      }
    }

    // 5. Update or create daily_analytics records
    const updates = [];

    for (const product of products) {
      const mlData = mlDataMap.get(product.id);
      
      if (!mlData) {
        continue; // Skip if no ML data for this product
      }

      // Get sales data for this date
      const salesData = await prisma.sales.findUnique({
        where: {
          product_id_sale_date: {
            product_id: product.id,
            sale_date: date
          }
        }
      });

      // Prepare AI insight
      const aiInsight = {
        source: 'ml_api',
        updated_at: new Date().toISOString(),
        burst_level: mlData.burst_level,
        momentum_status: mlData.momentum_status,
        reason: mlData.reason || null,
        action: mlData.action || null
      };

      // Upsert daily_analytics
      updates.push(
        prisma.daily_analytics.upsert({
          where: {
            product_id_metric_date: {
              product_id: product.id,
              metric_date: date
            }
          },
          create: {
            user_id: userId,
            product_id: product.id,
            dataset_id: product.dataset_id || undefined,
            metric_date: date,
            actual_quantity: salesData?.quantity || 0,
            momentum_combined: mlData.momentum_combined || 0,
            momentum_label: mlData.momentum_status || 'STABLE',
            burst_score: mlData.burst_score || 0,
            burst_level: mlData.burst_level || 'NORMAL',
            burst_type: mlData.burst_level === 'NORMAL' ? 'NORMAL' : 'MONITORING',
            priority_score: mlData.priority_score || 0,
            ai_insight: aiInsight as any
          },
          update: {
            momentum_combined: mlData.momentum_combined || 0,
            momentum_label: mlData.momentum_status || 'STABLE',
            burst_score: mlData.burst_score || 0,
            burst_level: mlData.burst_level || 'NORMAL',
            burst_type: mlData.burst_level === 'NORMAL' ? 'NORMAL' : 'MONITORING',
            priority_score: mlData.priority_score || 0,
            updated_at: new Date(),
            ai_insight: aiInsight as any
          }
        })
      );
    }

    // Execute transaction
    if (updates.length > 0) {
      await prisma.$transaction(updates);
    }

    return { 
      processed: updates.length,
      message: `Updated ${updates.length} product analytics from ML`
    };

  } catch (error) {
    console.error('[BurstService] Error generating burst analytics:', error);
    return { 
      processed: 0, 
      message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
};

// Helper: Check if ML service is available
async function checkMLService(): Promise<boolean> {
  try {
    const response = await axios.get(`${ML_API_URL}/`, { timeout: 3000 });
    return response.status === 200;
  } catch {
    return false;
  }
}

// Helper: Call ML weekly report
async function callMLWeeklyReport(topN: number = 50) {
  try {
    const response = await axios.get(`${ML_API_URL}/api/ml/report/weekly`, {
      params: { top_n: topN, strategy: 'balanced' },
      timeout: 15000
    });
    
    if (response.data && response.data.success) {
      return response.data;
    }
    
    return null;
  } catch (error: any) {
    console.error('[BurstService] ML API error:', error.message);
    return null;
  }
}

// ✅ NEW: Sync all products analytics with ML (can be called via cron)
export const syncAllProductsWithML = async (userId: string) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  return await generateBurstAnalytics(userId, today);
};
