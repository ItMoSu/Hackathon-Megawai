// --- HEADER UNTUK MENGATASI MASALAH RESOLUSI PATH & IMPORT ---
// Menggunakan require untuk kompatibilitas yang lebih baik dengan tsc/Node.js
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

// --- I. KONFIGURASI SUPABASE & ENV ---

// Muat variabel lingkungan
dotenv.config({ path: path.resolve(__dirname, '..', '.env') }); 

// Menggunakan variabel yang sudah ada di .env Anda
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY; 

if (!supabaseUrl || !supabaseServiceKey) {
    console.error("==================================================");
    console.error("❌ ERROR KONFIGURASI ❌");
    console.error("Gagal membaca SUPABASE_URL atau SUPABASE_SERVICE_ROLE_KEY dari .env.");
    console.error("Pastikan nama variabel di .env sudah benar dan tidak ada spasi.");
    console.error("==================================================");
    process.exit(1); 
}

// Inisialisasi Klien Supabase menggunakan Service Role Key (Admin Access)
// Key ini akan bypass Row Level Security (RLS)
const supabase = createClient(supabaseUrl, supabaseServiceKey);


// --- II. KONSTANTA & TIPE DATA (Sesuai Skema UUID Anda) ---

const PLACEHOLDER_USER_ID = '7e12bd6c-98d7-48fe-b788-48a877ea0a47'; 
const PLACEHOLDER_DATASET_ID = null; 

interface ProductData {
  name: string;
  price: number; 
  unit: string;
}

interface ProductSeed extends ProductData {
  id: string; 
  user_id: string; 
  dataset_id: string; 
  is_active: boolean;
  created_at: string;
}

interface Sale {
  sale_date: string; 
  product_id: string; 
  quantity: number; 
  revenue: number; 
  user_id: string;
}

// 5 Produk UMKM Makanan Anda
const RAW_PRODUCTS: ProductData[] = [
    { name: 'Keripik Singkong Balado', price: 15000, unit: 'Bungkus' },
    { name: 'Nasi Goreng Spesial', price: 25000, unit: 'Porsi' },
    { name: 'Es Kopi Susu Aren', price: 18000, unit: 'Cup' },
    { name: 'Roti Isi Cokelat Keju', price: 12000, unit: 'Pcs' },
    { name: 'Sambal Bawang Kemasan', price: 30000, unit: 'Botol' },
];

const SEEDED_PRODUCTS: ProductSeed[] = RAW_PRODUCTS.map(p => ({
    ...p,
    id: uuidv4(), 
    user_id: PLACEHOLDER_USER_ID,
    dataset_id: PLACEHOLDER_DATASET_ID,
    is_active: true,
    created_at: new Date().toISOString(),
}));

const DAYS_TO_GENERATE = 60;


// --- III. LOGIKA GENERASI DATA (60 Days, Burst, Weekend/Payday) ---

function generateSalesData(days: number): Sale[] {
  const sales: Sale[] = [];
  const today = new Date(); 
  
  for (let i = 0; i < days; i++) {
    const currentDate = new Date(today);
    currentDate.setDate(today.getDate() - i);
    const dateString = currentDate.toISOString().split('T')[0];
    
    const dayOfWeek = currentDate.getDay(); 
    const dayOfMonth = currentDate.getDate();
    
    let baseMultiplier = 1;

    // Pola Weekend (1.5x)
    if (dayOfWeek === 0 || dayOfWeek === 6) { baseMultiplier *= 1.5; }
    // Pola Gajian (2.5x)
    if (dayOfMonth >= 24 && dayOfMonth <= 26) { baseMultiplier *= 2.5; }
    // Skenario Lonjakan (4.0x)
    if (i === 10 || i === 30 || i === 50) { baseMultiplier *= 4.0; }

    const randomBaseSales = Math.floor(Math.random() * 51) + 50; 
    const totalSalesForDay = Math.floor(randomBaseSales * baseMultiplier);
    
    let remainingSales = totalSalesForDay;
    for (const product of SEEDED_PRODUCTS) {
        let allocationFactor = product.price < 20000 ? 0.35 : 0.15; 
        
        let salesForProduct = Math.floor(Math.random() * (remainingSales * allocationFactor) + 1);
        salesForProduct = Math.min(salesForProduct, remainingSales);
        
        if (salesForProduct > 0) {
            sales.push({
                sale_date: dateString,
                product_id: product.id,
                quantity: salesForProduct,
                revenue: salesForProduct * product.price,
            });
            remainingSales -= salesForProduct;
        }
    }
  }
  return sales;
}


// --- IV. FUNGSI UTAMA SEEDING KE SUPABASE ---

async function seedDatabase() {
    console.log("===============================================");
    console.log(`🚀 Seeding dimulai. URL Proyek: ${supabaseUrl}`);
    
    // --- Langkah 1: Hapus Data Lama ---
    console.log("1/4. Menghapus data lama (sales & products)...");
    // Gunakan Service Key untuk menghapus data, mengatasi RLS
    await supabase.from('sales').delete().neq('id', '0'); 
    await supabase.from('products').delete().neq('id', '0'); 
    console.log("   ✅ Data lama berhasil dihapus.");

    // --- Langkah 2: Masukkan Data Produk ---
    console.log("2/4. Memasukkan data 5 Produk...");
    const { error: productInsertError } = await supabase
        .from('products')
        .insert(SEEDED_PRODUCTS); 

    if (productInsertError) {
        console.error("❌ Gagal memasukkan data produk:", productInsertError.message);
        return;
    }
    console.log(`   ✅ Berhasil memasukkan ${SEEDED_PRODUCTS.length} produk.`);
    
    // --- Langkah 3 & 4: Generate dan Masukkan Data Penjualan ---
    const salesData = generateSalesData(DAYS_TO_GENERATE);
    console.log(`3/4. Berhasil generate ${salesData.length} entri penjualan.`);
    console.log("4/4. Memasukkan data penjualan ke Supabase (Batching)...");
    
    const BATCH_SIZE = 1000;
    for (let i = 0; i < salesData.length; i += BATCH_SIZE) {
        const batch = salesData.slice(i, i + BATCH_SIZE);
        
        const { error: salesInsertError } = await supabase
            .from('sales')
            .insert(batch); 

        if (salesInsertError) {
            console.error(`❌ Gagal memasukkan batch penjualan #${i}:`, salesInsertError.message);
            return;
        }
    }
    
    console.log(`   ✅ Berhasil memasukkan total ${salesData.length} transaksi penjualan.`);
    console.log("===============================================");
    console.log("🎉 SEEDING SELESAI! Data siap digunakan di Supabase.");
    console.log("===============================================");
}

// Eksekusi fungsi seeding
seedDatabase();