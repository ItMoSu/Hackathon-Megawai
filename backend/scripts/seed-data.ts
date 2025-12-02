// --- HEADER: IMPORTS & CONFIGURATION ---
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const readline = require('readline'); // Added for safety prompt

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// SECURITY CHECK: Ensure keys exist
if (!supabaseUrl || !supabaseServiceKey) {
  console.error("❌ CONFIG ERROR: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(1);
}

// Initialize Supabase Client (Service Role - Bypasses RLS)
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// --- CONSTANTS & TYPES ---

// TARGET USER ID (MUST EXIST IN auth.users)
const PLACEHOLDER_USER_ID = '5a571f1e-3130-4438-8da0-ef691273a38c'; 

const DATASET_ID_FOR_SEEDS = uuidv4();
const FILE_TYPES = ['xlsx', 'csv', 'pdf', 'docx'];
const SALE_SOURCES = ['xlsx', 'csv', 'pdf', 'docx'];
const DUMMY_FILE_NAME = 'initial_seed_data';
const DUMMY_FILE_TYPE = FILE_TYPES[0];
const DUMMY_STATUS = 'ready';
const DAYS_TO_GENERATE = 60;

// Interfaces (Matching your schema)
interface ProductData {
  name: string;
  price: number;
  unit: string;
}

interface DatasetSeed {
  id: string;
  user_id: string;
  name: string;
  source_file_name: string;
  source_file_type: string;
  storage_path: string;
  status: string;
  created_at: string;
  updated_at: string;
}

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
  source: string;
}

// --- SEED DATA DEFINITIONS ---

const SEEDED_DATASETS: DatasetSeed[] = [{
  id: DATASET_ID_FOR_SEEDS,
  user_id: PLACEHOLDER_USER_ID,
  name: 'Sample Data HACKATHON',
  source_file_name: DUMMY_FILE_NAME,
  source_file_type: DUMMY_FILE_TYPE,
  storage_path: `/data/${PLACEHOLDER_USER_ID}/${DATASET_ID_FOR_SEEDS}`,
  status: DUMMY_STATUS,
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
  user_id: PLACEHOLDER_USER_ID,
  dataset_id: DATASET_ID_FOR_SEEDS,
  is_active: true,
  created_at: new Date().toISOString(),
}));

// --- LOGIC: DATA GENERATION ---

function generateSalesData(days: number): Sale[] {
  const sales: Sale[] = [];
  const today = new Date();
  
  // Pre-calculate random source index to avoid re-calc in inner loop if possible,
  // but keeping inside loop ensures randomness per transaction.
  
  for (let i = 0; i < days; i++) {
    const currentDate = new Date(today);
    currentDate.setDate(today.getDate() - i);
    const dateString = currentDate.toISOString().split('T')[0];
    
    // Multiplier Logic (Preserved as requested)
    const dayOfWeek = currentDate.getDay();
    const dayOfMonth = currentDate.getDate();
    let baseMultiplier = 1;

    // Weekend (Sat/Sun) boost
    if (dayOfWeek === 0 || dayOfWeek === 6) { baseMultiplier *= 1.5; }
    // Payday (24-26th) boost
    if (dayOfMonth >= 24 && dayOfMonth <= 26) { baseMultiplier *= 2.5; }
    // Artificial spikes
    if (i === 10 || i === 30 || i === 50) { baseMultiplier *= 4.0; }

    const randomBaseSales = Math.floor(Math.random() * 51) + 50;
    const totalSalesForDay = Math.floor(randomBaseSales * baseMultiplier);
    
    let remainingSales = totalSalesForDay;

    for (const product of SEEDED_PRODUCTS) {
      // Allocation logic based on price tiers
      let allocationFactor = product.price < 20000 ? 0.35 : 0.15;
      
      let salesForProduct = Math.floor(Math.random() * (remainingSales * allocationFactor) + 1);
      // Ensure we don't oversell the daily quota
      salesForProduct = Math.min(salesForProduct, remainingSales);
      
      if (salesForProduct > 0) {
        const randomSourceIndex = Math.floor(Math.random() * SALE_SOURCES.length);

        sales.push({
          sale_date: dateString,
          product_id: product.id,
          quantity: salesForProduct,
          revenue: salesForProduct * product.price,
          user_id: PLACEHOLDER_USER_ID,
          source: SALE_SOURCES[randomSourceIndex],
        });
        remainingSales -= salesForProduct;
      }
    }
  }
  return sales;
}

// --- UTILS: USER INTERACTION & VALIDATION ---

// Helper to ask for confirmation
function askConfirmation(query: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(query, (answer: string) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}

// Helper to validate User ID existence
async function validateUserExists(userId: string): Promise<boolean> {
  // Using auth.admin to check user existence without logging in
  const { data, error } = await supabase.auth.admin.getUserById(userId);
  if (error || !data.user) {
    return false;
  }
  return true;
}

// --- MAIN FUNCTION ---

async function seedDatabase() {
  console.log("\n===============================================");
  console.log(`🚀 SUPABASE SEEDING SCRIPT`);
  console.log(`   Target Project: ${supabaseUrl}`);
  console.log(`   Target User ID: ${PLACEHOLDER_USER_ID}`);
  console.log("===============================================\n");

  // SECURITY 1: Confirmation Prompt
  const isConfirmed = await askConfirmation("⚠️  WARNING: This will WIPE all existing Sales, Products, and Datasets for this project.\nAre you sure you want to proceed? (y/n): ");
  
  if (!isConfirmed) {
    console.log("❌ Seeding cancelled by user.");
    process.exit(0);
  }

  // SECURITY 2: Validate User ID
  console.log("🔍 Validating User ID...");
  const userExists = await validateUserExists(PLACEHOLDER_USER_ID);
  if (!userExists) {
    console.error(`❌ CRITICAL ERROR: User ID ${PLACEHOLDER_USER_ID} does not exist in auth.users.`);
    console.error("   Please update 'PLACEHOLDER_USER_ID' in the script with a valid UUID from your Authentication table.");
    process.exit(1);
  }
  console.log("✅ User ID found.");

  try {
    // --- Step 1: Clean up Old Data (Reverse Order of Dependencies) ---
    console.log("1/5. Cleaning up old data...");
    
    // Delete Sales first (Child of Products)
    const { error: errSales } = await supabase.from('sales').delete().neq('id', '00000000-0000-0000-0000-000000000000'); // Safe UUID check
    if (errSales) throw new Error(`Failed to delete sales: ${errSales.message}`);

    // Delete Products (Child of Datasets)
    const { error: errProd } = await supabase.from('products').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (errProd) throw new Error(`Failed to delete products: ${errProd.message}`);

    // Delete Datasets (Parent)
    const { error: errData } = await supabase.from('datasets').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (errData) throw new Error(`Failed to delete datasets: ${errData.message}`);
    
    console.log("   ✅ Database cleaned.");

    // --- Step 2: Insert Datasets ---
    console.log("2/5. Seeding Datasets...");
    const { error: datasetError } = await supabase.from('datasets').insert(SEEDED_DATASETS);
    if (datasetError) throw new Error(`Dataset insert failed: ${datasetError.message}`);
    console.log("   ✅ 1 Dataset inserted.");

    // --- Step 3: Insert Products ---
    console.log("3/5. Seeding Products...");
    const { error: productError } = await supabase.from('products').insert(SEEDED_PRODUCTS);
    if (productError) throw new Error(`Product insert failed: ${productError.message}`);
    console.log(`   ✅ ${SEEDED_PRODUCTS.length} Products inserted.`);

    // --- Step 4 & 5: Generate and Insert Sales ---
    console.log("4/5. Generating Sales Data...");
    const salesData = generateSalesData(DAYS_TO_GENERATE);
    console.log(`   ✅ Generated ${salesData.length} sales records.`);

    console.log("5/5. Inserting Sales (Batch Process)...");
    const BATCH_SIZE = 1000;
    
    for (let i = 0; i < salesData.length; i += BATCH_SIZE) {
      const batch = salesData.slice(i, i + BATCH_SIZE);
      const { error: batchError } = await supabase.from('sales').insert(batch);
      
      if (batchError) {
        throw new Error(`Batch insert failed at index ${i}: ${batchError.message}`);
      }
      process.stdout.write(`   Processing batch ${Math.ceil((i + 1)/BATCH_SIZE)}/${Math.ceil(salesData.length/BATCH_SIZE)}...\r`);
    }

    console.log("\n\n===============================================");
    console.log("🎉 SEEDING COMPLETED SUCCESSFULLY!");
    console.log("===============================================");

  } catch (error: any) {
    console.error("\n❌ SEEDING FAILED:");
    console.error(error.message);
    process.exit(1);
  }
}

// Execute
seedDatabase();