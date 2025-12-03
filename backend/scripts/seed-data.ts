// --- HEADER UNTUK MENGATASI MASALAH RESOLUSI PATH & IMPORT ---
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

// --- I. KONFIGURASI SUPABASE & ENV ---

dotenv.config({ path: path.resolve(__dirname, '..', '.env') }); 

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY; 



// UUID pengguna AKTIF dari tabel auth.users Supabase Anda. WAJIB!
const PLACEHOLDER_USER_ID = 'dc16353b-b26e-48c7-a8c9-31f1e6ecb678'; // <--- INI BUAT USER ID INI PENTING YAA
// --- AKHIR PERHATIAN ---

if (!supabaseUrl || !supabaseServiceKey) {
    console.error("❌ ERROR KONFIGURASI: SUPABASE_URL atau SUPABASE_SERVICE_ROLE_KEY tidak ditemukan di .env.");
    process.exit(1); 
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);


// --- II. KONSTANTA & TIPE DATA (Berdasarkan Skema Anda) ---

const DATASET_ID_FOR_SEEDS = uuidv4(); 

const FILE_TYPES = ['xlsx', 'csv', 'pdf', 'docx'];


const SALE_SOURCES = ['xlsx', 'csv', 'pdf', 'docx']; 
const DUMMY_FILE_NAME = 'initial_seed_data';
const DUMMY_FILE_TYPE = FILE_TYPES[0]; // Gunakan 'xlsx'
const DUMMY_STATUS = 'ready'; // Mematuhi datasets_status_check

interface ProductData {
  name: string;
  price: number; 
  unit: string;
}

// Skema datasets (image_0b2811.png)
interface DatasetSeed {
  id: string;
  user_id: string; 
  name: string;
  source_file_name: string;
  source_file_type: string;
  storage_path: string;
  status: string; // Harus salah satu dari ['uploaded', 'processing', 'ready', 'failed']
  created_at: string;
  updated_at: string;
}

// Skema products (image_178802.png)
interface ProductSeed extends ProductData {
  id: string; 
  user_id: string; 
  dataset_id: string | null; 
  is_active: boolean;
  created_at: string;
}

interface Sale {
  sale_date: string; 
  product_id: string; 
  quantity: number; 
  revenue: number; 
  user_id: string; 
  source: string; // Harus mematuhi sales_source_check
}

const SEEDED_DATASETS: DatasetSeed[] = [{
    id: DATASET_ID_FOR_SEEDS,
    user_id: PLACEHOLDER_USER_ID, // Mematuhi datasets_user_id_fkey
    name: 'Sample Data HACKATHON',
    source_file_name: DUMMY_FILE_NAME,
    source_file_type: DUMMY_FILE_TYPE, 
    storage_path: `/data/${PLACEHOLDER_USER_ID}/${DATASET_ID_FOR_SEEDS}`,
    status: DUMMY_STATUS, // Mematuhi datasets_status_check
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
}];

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
    user_id: PLACEHOLDER_USER_ID, // Mematuhi products_user_id_fkey
    dataset_id: DATASET_ID_FOR_SEEDS, // Mematuhi products_dataset_id_fkey
    is_active: true,
    created_at: new Date().toISOString(),
}));

const DAYS_TO_GENERATE = 60;


// --- III. LOGIKA GENERASI DATA ---

function generateSalesData(days: number): Sale[] {
  const sales: Sale[] = [];
  const today = new Date(); 
  
  for (let i = 0; i < days; i++) {
    const currentDate = new Date(today);
    currentDate.setDate(today.getDate() - i);
    const dateString = currentDate.toISOString().split('T')[0];
    
    // Logika Multiplier tetap
    const dayOfWeek = currentDate.getDay(); 
    const dayOfMonth = currentDate.getDate();
    let baseMultiplier = 1;

    if (dayOfWeek === 0 || dayOfWeek === 6) { baseMultiplier *= 1.5; }
    if (dayOfMonth >= 24 && dayOfMonth <= 26) { baseMultiplier *= 2.5; }
    if (i === 10 || i === 30 || i === 50) { baseMultiplier *= 4.0; }

    const randomBaseSales = Math.floor(Math.random() * 51) + 50; 
    const totalSalesForDay = Math.floor(randomBaseSales * baseMultiplier);
    
    let remainingSales = totalSalesForDay;
    for (const product of SEEDED_PRODUCTS) {
        let allocationFactor = product.price < 20000 ? 0.35 : 0.15; 
        
        let salesForProduct = Math.floor(Math.random() * (remainingSales * allocationFactor) + 1);
        salesForProduct = Math.min(salesForProduct, remainingSales);
        
        if (salesForProduct > 0) {
            // Pilih sumber secara acak dari SALE_SOURCES (manual, xlsx, etc.)
            const randomSourceIndex = Math.floor(Math.random() * SALE_SOURCES.length);

            sales.push({
                sale_date: dateString,
                product_id: product.id,
                quantity: salesForProduct,
                revenue: salesForProduct * product.price,
                user_id: PLACEHOLDER_USER_ID, 
                source: SALE_SOURCES[randomSourceIndex], // Mematuhi sales_source_check
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
    console.log("1/5. Menghapus data lama (sales, products, datasets)...");
    await supabase.from('sales').delete().neq('id', '0'); 
    await supabase.from('products').delete().neq('id', '0'); 
    await supabase.from('datasets').delete().neq('id', '0'); 
    console.log("   ✅ Data lama berhasil dihapus.");

    // --- Langkah 2: Masukkan Data Dataset (Wajib sebelum Products) ---
    console.log("2/5. Memasukkan data 1 Dataset...");
    const { error: datasetInsertError } = await supabase
        .from('datasets')
        .insert(SEEDED_DATASETS); 
    
    if (datasetInsertError) {
        console.error("❌ Gagal memasukkan data dataset:", datasetInsertError.message);
        return;
    }
    console.log("   ✅ Berhasil memasukkan 1 dataset dummy.");


    // --- Langkah 3: Masukkan Data Produk ---
    console.log("3/5. Memasukkan data 5 Produk...");
    const { error: productInsertError } = await supabase
        .from('products')
        .insert(SEEDED_PRODUCTS); 

    if (productInsertError) {
        console.error("❌ Gagal memasukkan data produk:", productInsertError.message);
        return;
    }
    console.log(`   ✅ Berhasil memasukkan ${SEEDED_PRODUCTS.length} produk.`);
    
    // --- Langkah 4 & 5: Generate dan Masukkan Data Penjualan ---
    const salesData = generateSalesData(DAYS_TO_GENERATE);
    console.log(`4/5. Berhasil generate ${salesData.length} entri penjualan.`);
    console.log("5/5. Memasukkan data penjualan ke Supabase (Batching)...");
    
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