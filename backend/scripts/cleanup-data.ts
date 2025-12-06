import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function cleanupDuplicateProducts() {
  console.log('🧹 Starting cleanup...\n');

  // Get all users
  const users = await prisma.users.findMany({
    select: { id: true, email: true }
  });

  for (const user of users) {
    console.log(`\n👤 Processing user: ${user.email || user.id}`);

    // Get all products for this user
    const allProducts = await prisma.products.findMany({
      where: { user_id: user.id },
      orderBy: [
        { price: 'desc' }, // Prefer products with price
        { created_at: 'asc' } // Then oldest
      ],
      include: {
        sales: true,
        daily_analytics: true
      }
    });

    // Group by lowercase name
    const productsByName = new Map<string, typeof allProducts>();
    for (const product of allProducts) {
      const lowerName = product.name.toLowerCase();
      if (!productsByName.has(lowerName)) {
        productsByName.set(lowerName, []);
      }
      productsByName.get(lowerName)!.push(product);
    }

    // Process duplicates
    for (const [name, products] of productsByName) {
      if (products.length > 1) {
        console.log(`\n  📦 Found ${products.length} duplicates for "${name}"`);
        
        // Keep the first one (has price or oldest)
        const [keep, ...duplicates] = products;
        console.log(`  ✅ Keeping: ${keep.name} (ID: ${keep.id}, Price: ${keep.price || 'null'})`);

        for (const dup of duplicates) {
          console.log(`  🗑️  Removing: ${dup.name} (ID: ${dup.id}, Price: ${dup.price || 'null'})`);
          
          // Move sales to the kept product
          if (dup.sales.length > 0) {
            console.log(`     Moving ${dup.sales.length} sales records...`);
            
            for (const sale of dup.sales) {
              // Check if sale already exists for keep product on same date
              const existingSale = await prisma.sales.findFirst({
                where: {
                  product_id: keep.id,
                  sale_date: sale.sale_date
                }
              });

              if (existingSale) {
                // Merge: add quantities
                await prisma.sales.update({
                  where: { id: existingSale.id },
                  data: {
                    quantity: Number(existingSale.quantity) + Number(sale.quantity),
                    revenue: (Number(existingSale.revenue) || 0) + (Number(sale.revenue) || 0)
                  }
                });
                // Delete the duplicate sale
                await prisma.sales.delete({ where: { id: sale.id } });
              } else {
                // Move sale to kept product
                await prisma.sales.update({
                  where: { id: sale.id },
                  data: { product_id: keep.id }
                });
              }
            }
          }

          // Delete analytics for duplicate
          if (dup.daily_analytics.length > 0) {
            console.log(`     Deleting ${dup.daily_analytics.length} analytics records...`);
            await prisma.daily_analytics.deleteMany({
              where: { product_id: dup.id }
            });
          }

          // Delete the duplicate product
          await prisma.products.delete({ where: { id: dup.id } });
          console.log(`     ✅ Deleted duplicate product`);
        }
      }
    }
  }

  console.log('\n✅ Duplicate cleanup complete!\n');
}

async function updateSalesRevenue() {
  console.log('💰 Updating sales revenue...\n');

  // Get all sales without revenue
  const salesWithoutRevenue = await prisma.sales.findMany({
    where: {
      OR: [
        { revenue: null },
        { revenue: 0 }
      ]
    },
    include: {
      products: true
    }
  });

  console.log(`Found ${salesWithoutRevenue.length} sales without revenue`);

  let updated = 0;
  for (const sale of salesWithoutRevenue) {
    if (sale.products?.price) {
      const revenue = Number(sale.products.price) * Number(sale.quantity);
      await prisma.sales.update({
        where: { id: sale.id },
        data: { revenue }
      });
      updated++;
    }
  }

  console.log(`✅ Updated ${updated} sales with revenue\n`);
}

async function showSummary() {
  console.log('📊 Current Data Summary:\n');

  const productCount = await prisma.products.count();
  const salesCount = await prisma.sales.count();
  const analyticsCount = await prisma.daily_analytics.count();

  const productsWithPrice = await prisma.products.count({
    where: { price: { not: null } }
  });

  const salesWithRevenue = await prisma.sales.count({
    where: { 
      revenue: { not: null },
      NOT: { revenue: 0 }
    }
  });

  console.log(`  Products: ${productCount} (${productsWithPrice} with price)`);
  console.log(`  Sales: ${salesCount} (${salesWithRevenue} with revenue)`);
  console.log(`  Analytics: ${analyticsCount}`);
}

async function main() {
  try {
    console.log('=' .repeat(50));
    console.log('🔧 DATABASE CLEANUP SCRIPT');
    console.log('=' .repeat(50));

    await showSummary();
    
    await cleanupDuplicateProducts();
    
    await updateSalesRevenue();
    
    await showSummary();

    console.log('=' .repeat(50));
    console.log('✅ All cleanup tasks completed!');
    console.log('=' .repeat(50));

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
