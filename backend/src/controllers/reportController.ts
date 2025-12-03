import { Request, Response } from 'express';
import { prisma } from '../../lib/database/schema';

export const getWeeklyReport = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.sub;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - 7);

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

    const topStats = await prisma.sales.groupBy({
      by: ['product_id'],
      _sum: { quantity: true },
      where: {
        user_id: userId,
        sale_date: { gte: startDate, lte: endDate }
      },
      orderBy: {
        _sum: { quantity: 'desc' }
      },
      take: 5
    });

    const topPerformers = await Promise.all(topStats.map(async (item) => {
      const product = await prisma.products.findUnique({
        where: { id: item.product_id }
      });
      return {
        id: item.product_id,
        name: product?.name || "Unknown",
        quantity: Number(item._sum.quantity) || 0
      };
    }));

    const attentionDate = new Date();
    attentionDate.setDate(attentionDate.getDate() - 2);

    const issues = await prisma.daily_analytics.findMany({
      where: {
        user_id: userId,
        metric_date: { gte: attentionDate },
        OR: [
          { burst_level: 'CRITICAL' },   
          { momentum_label: 'FALLING' }, 
          { momentum_label: 'DECLINING' }
        ]
      },
      include: { products: true },
      orderBy: { metric_date: 'desc' },
      take: 5
    });

    const attentionNeeded = issues.map(item => ({
      name: item.products.name,
      date: item.metric_date,
      status: item.burst_level === 'CRITICAL' ? 'VIRAL SPIKE' : 'DECLINING',
      detail: item.burst_level === 'CRITICAL' 
        ? `Lonjakan ${Number(item.burst_score).toFixed(1)}x` 
        : 'Tren penjualan menurun tajam'
    }));

    // Response
    res.json({
      success: true,
      data: {
        dateRange: {
            start: startDate.toISOString().split('T')[0],
            end: endDate.toISOString().split('T')[0]
        },
        summary: {
            totalQuantity: Number(summary._sum.quantity) || 0,
            totalRevenue: Number(summary._sum.revenue) || 0
        },
        topPerformers,
        attentionNeeded
      }
    });

  } catch (error) {
    console.error("Weekly Report Error:", error);
    res.status(500).json({ error: "Gagal membuat laporan mingguan" });
  }
};