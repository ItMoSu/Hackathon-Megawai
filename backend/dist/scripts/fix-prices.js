"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
// Default prices untuk produk umum
const DEFAULT_PRICES = {
    'nasi uduk': 10000,
    'minuman cap kaki tiga': 8000,
    'ayam goreng kremes': 19000,
    'roti isi cokelat keju': 12000,
    'sambal bawang kemasan': 30000,
    'nasi goreng spesial': 25000,
    'es kopi susu aren': 18000,
    'keripik singkong balado': 15000,
    'ayam': 15000,
    'ayam bakar': 20000,
};
async function fixProductPrices() {
    console.log('💰 Fixing product prices...\n');
    const productsWithoutPrice = await prisma.products.findMany({
        where: { price: null }
    });
    console.log(`Found ${productsWithoutPrice.length} products without price\n`);
    for (const product of productsWithoutPrice) {
        const lowerName = product.name.toLowerCase();
        const defaultPrice = DEFAULT_PRICES[lowerName];
        if (defaultPrice) {
            await prisma.products.update({
                where: { id: product.id },
                data: { price: defaultPrice }
            });
            console.log(`✅ Updated "${product.name}" price to ${defaultPrice}`);
        }
        else {
            console.log(`⚠️  No default price for "${product.name}"`);
        }
    }
}
async function updateAllSalesRevenue() {
    console.log('\n💰 Updating all sales revenue...\n');
    // Get all products with price
    const productsWithPrice = await prisma.products.findMany({
        where: { price: { not: null } }
    });
    let totalUpdated = 0;
    for (const product of productsWithPrice) {
        const price = Number(product.price);
        // Update all sales for this product
        const result = await prisma.sales.updateMany({
            where: {
                product_id: product.id,
                OR: [
                    { revenue: null },
                    { revenue: 0 }
                ]
            },
            data: {
            // We need to do this one by one to calculate revenue
            }
        });
        // Get sales without revenue for this product
        const sales = await prisma.sales.findMany({
            where: {
                product_id: product.id,
                OR: [
                    { revenue: null },
                    { revenue: 0 }
                ]
            }
        });
        for (const sale of sales) {
            const revenue = price * Number(sale.quantity);
            await prisma.sales.update({
                where: { id: sale.id },
                data: { revenue }
            });
            totalUpdated++;
        }
        if (sales.length > 0) {
            console.log(`✅ Updated ${sales.length} sales for "${product.name}" (price: ${price})`);
        }
    }
    console.log(`\n✅ Total sales updated: ${totalUpdated}`);
}
async function showSummary() {
    console.log('\n📊 Current Data Summary:\n');
    const productCount = await prisma.products.count();
    const salesCount = await prisma.sales.count();
    const productsWithPrice = await prisma.products.count({
        where: { price: { not: null } }
    });
    const salesWithRevenue = await prisma.sales.count({
        where: {
            revenue: { not: null },
            NOT: { revenue: 0 }
        }
    });
    // Calculate total revenue
    const revenueSum = await prisma.sales.aggregate({
        _sum: { revenue: true }
    });
    console.log(`  Products: ${productCount} (${productsWithPrice} with price)`);
    console.log(`  Sales: ${salesCount} (${salesWithRevenue} with revenue)`);
    console.log(`  Total Revenue: Rp ${Number(revenueSum._sum.revenue || 0).toLocaleString('id-ID')}`);
}
async function main() {
    try {
        console.log('='.repeat(50));
        console.log('🔧 FIX PRICES SCRIPT');
        console.log('='.repeat(50));
        await showSummary();
        await fixProductPrices();
        await updateAllSalesRevenue();
        await showSummary();
        console.log('\n' + '='.repeat(50));
        console.log('✅ All tasks completed!');
        console.log('='.repeat(50));
    }
    catch (error) {
        console.error('❌ Error:', error);
    }
    finally {
        await prisma.$disconnect();
    }
}
main();
