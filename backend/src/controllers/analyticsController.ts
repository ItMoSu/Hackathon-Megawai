import { Request, Response } from 'express';
import { prisma } from '../../lib/database/schema';

export const getDashboardSummary = async (req: Request, res: Response) => {
try {
    const userId = req.user?.sub;

    if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
    }

    const userDataset = await prisma.datasets.findFirst({
        where: { user_id: userId }
    });

    if (!userDataset) {
        return res.status(200).json({ 
            total_qty: 0,
            total_revenue: 0,
            top_products: [] 
        });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0); 
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1); 

    const summary = await prisma.sales.aggregate({
    _sum: {
        quantity: true,
        revenue: true, 
    },
    where: {
        dataset_id: userDataset.id,
        sale_date: {
        gte: today,
        lt: tomorrow,
        },
    },
    });

    // 4. Query Top Products Hari Ini (Group By Product)
    const productStats = await prisma.sales.groupBy({
    by: ['product_id'],
    _sum: {
        quantity: true,
    },
    where: {
        dataset_id: userDataset.id,
        sale_date: {
        gte: today,
        lt: tomorrow,
        },
    },
    orderBy: {
        _sum: {
        quantity: 'desc',
        },
    },
    take: 5, 
    });

    // 5. Ambil Nama Produk
    const topProducts = await Promise.all(productStats.map(async (item) => {
        if (!item.product_id) return null;
        const product = await prisma.products.findUnique({
            where: { id: item.product_id }
        });
        
        return {
            name: product?.name || "Unknown Product",
            quantity: Number(item._sum.quantity) || 0
        };
        }));

        const validTopProducts = topProducts.filter(p => p !== null);
        res.json({
        success: true,
        data: {
            total_qty: Number(summary._sum.quantity) || 0,
            total_revenue: Number(summary._sum.revenue) || 0,
            top_products: validTopProducts
        }
        });

    } catch (error) {
        console.error("Dashboard Error:", error);
        res.status(500).json({ error: "Gagal memuat dashboard" });
    }
};