var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
// --- HEADER UNTUK MENGATASI MASALAH RESOLUSI PATH & IMPORT ---
var createClient = require('@supabase/supabase-js').createClient;
var dotenv = require('dotenv');
var uuidv4 = require('uuid').v4;
var path = require('path');
// --- I. KONFIGURASI SUPABASE & ENV ---
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });
var supabaseUrl = process.env.SUPABASE_URL;
var supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
// UUID pengguna AKTIF dari tabel auth.users Supabase Anda. WAJIB!
var PLACEHOLDER_USER_ID = '5a571f1e-3130-4438-8da0-ef691273a38c'; // <--- INI BUAT USER ID INI PENTING YAA
// --- AKHIR PERHATIAN ---
if (!supabaseUrl || !supabaseServiceKey) {
    console.error("❌ ERROR KONFIGURASI: SUPABASE_URL atau SUPABASE_SERVICE_ROLE_KEY tidak ditemukan di .env.");
    process.exit(1);
}
var supabase = createClient(supabaseUrl, supabaseServiceKey);
// --- II. KONSTANTA & TIPE DATA (Berdasarkan Skema Anda) ---
var DATASET_ID_FOR_SEEDS = uuidv4();
var FILE_TYPES = ['xlsx', 'csv', 'pdf', 'docx'];
var SALE_SOURCES = ['xlsx', 'csv', 'pdf', 'docx'];
var DUMMY_FILE_NAME = 'initial_seed_data';
var DUMMY_FILE_TYPE = FILE_TYPES[0]; // Gunakan 'xlsx'
var DUMMY_STATUS = 'ready'; // Mematuhi datasets_status_check
var SEEDED_DATASETS = [{
        id: DATASET_ID_FOR_SEEDS,
        user_id: PLACEHOLDER_USER_ID, // Mematuhi datasets_user_id_fkey
        name: 'Sample Data HACKATHON',
        source_file_name: DUMMY_FILE_NAME,
        source_file_type: DUMMY_FILE_TYPE,
        storage_path: "/data/".concat(PLACEHOLDER_USER_ID, "/").concat(DATASET_ID_FOR_SEEDS),
        status: DUMMY_STATUS, // Mematuhi datasets_status_check
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
    }];
var RAW_PRODUCTS = [
    { name: 'Keripik Singkong Balado', price: 15000, unit: 'Bungkus' },
    { name: 'Nasi Goreng Spesial', price: 25000, unit: 'Porsi' },
    { name: 'Es Kopi Susu Aren', price: 18000, unit: 'Cup' },
    { name: 'Roti Isi Cokelat Keju', price: 12000, unit: 'Pcs' },
    { name: 'Sambal Bawang Kemasan', price: 30000, unit: 'Botol' },
];
var SEEDED_PRODUCTS = RAW_PRODUCTS.map(function (p) { return (__assign(__assign({}, p), { id: uuidv4(), user_id: PLACEHOLDER_USER_ID, dataset_id: DATASET_ID_FOR_SEEDS, is_active: true, created_at: new Date().toISOString() })); });
var DAYS_TO_GENERATE = 60;
// --- III. LOGIKA GENERASI DATA ---
function generateSalesData(days) {
    var sales = [];
    var today = new Date();
    for (var i = 0; i < days; i++) {
        var currentDate = new Date(today);
        currentDate.setDate(today.getDate() - i);
        var dateString = currentDate.toISOString().split('T')[0];
        // Logika Multiplier tetap
        var dayOfWeek = currentDate.getDay();
        var dayOfMonth = currentDate.getDate();
        var baseMultiplier = 1;
        if (dayOfWeek === 0 || dayOfWeek === 6) {
            baseMultiplier *= 1.5;
        }
        if (dayOfMonth >= 24 && dayOfMonth <= 26) {
            baseMultiplier *= 2.5;
        }
        if (i === 10 || i === 30 || i === 50) {
            baseMultiplier *= 4.0;
        }
        var randomBaseSales = Math.floor(Math.random() * 51) + 50;
        var totalSalesForDay = Math.floor(randomBaseSales * baseMultiplier);
        var remainingSales = totalSalesForDay;
        for (var _i = 0, SEEDED_PRODUCTS_1 = SEEDED_PRODUCTS; _i < SEEDED_PRODUCTS_1.length; _i++) {
            var product = SEEDED_PRODUCTS_1[_i];
            var allocationFactor = product.price < 20000 ? 0.35 : 0.15;
            var salesForProduct = Math.floor(Math.random() * (remainingSales * allocationFactor) + 1);
            salesForProduct = Math.min(salesForProduct, remainingSales);
            if (salesForProduct > 0) {
                // Pilih sumber secara acak dari SALE_SOURCES (manual, xlsx, etc.)
                var randomSourceIndex = Math.floor(Math.random() * SALE_SOURCES.length);
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
function seedDatabase() {
    return __awaiter(this, void 0, void 0, function () {
        var datasetInsertError, productInsertError, salesData, BATCH_SIZE, i, batch, salesInsertError;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log("===============================================");
                    console.log("\uD83D\uDE80 Seeding dimulai. URL Proyek: ".concat(supabaseUrl));
                    // --- Langkah 1: Hapus Data Lama ---
                    console.log("1/5. Menghapus data lama (sales, products, datasets)...");
                    return [4 /*yield*/, supabase.from('sales').delete().neq('id', '0')];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, supabase.from('products').delete().neq('id', '0')];
                case 2:
                    _a.sent();
                    return [4 /*yield*/, supabase.from('datasets').delete().neq('id', '0')];
                case 3:
                    _a.sent();
                    console.log("   ✅ Data lama berhasil dihapus.");
                    // --- Langkah 2: Masukkan Data Dataset (Wajib sebelum Products) ---
                    console.log("2/5. Memasukkan data 1 Dataset...");
                    return [4 /*yield*/, supabase
                            .from('datasets')
                            .insert(SEEDED_DATASETS)];
                case 4:
                    datasetInsertError = (_a.sent()).error;
                    if (datasetInsertError) {
                        console.error("❌ Gagal memasukkan data dataset:", datasetInsertError.message);
                        return [2 /*return*/];
                    }
                    console.log("   ✅ Berhasil memasukkan 1 dataset dummy.");
                    // --- Langkah 3: Masukkan Data Produk ---
                    console.log("3/5. Memasukkan data 5 Produk...");
                    return [4 /*yield*/, supabase
                            .from('products')
                            .insert(SEEDED_PRODUCTS)];
                case 5:
                    productInsertError = (_a.sent()).error;
                    if (productInsertError) {
                        console.error("❌ Gagal memasukkan data produk:", productInsertError.message);
                        return [2 /*return*/];
                    }
                    console.log("   \u2705 Berhasil memasukkan ".concat(SEEDED_PRODUCTS.length, " produk."));
                    salesData = generateSalesData(DAYS_TO_GENERATE);
                    console.log("4/5. Berhasil generate ".concat(salesData.length, " entri penjualan."));
                    console.log("5/5. Memasukkan data penjualan ke Supabase (Batching)...");
                    BATCH_SIZE = 1000;
                    i = 0;
                    _a.label = 6;
                case 6:
                    if (!(i < salesData.length)) return [3 /*break*/, 9];
                    batch = salesData.slice(i, i + BATCH_SIZE);
                    return [4 /*yield*/, supabase
                            .from('sales')
                            .insert(batch)];
                case 7:
                    salesInsertError = (_a.sent()).error;
                    if (salesInsertError) {
                        console.error("\u274C Gagal memasukkan batch penjualan #".concat(i, ":"), salesInsertError.message);
                        return [2 /*return*/];
                    }
                    _a.label = 8;
                case 8:
                    i += BATCH_SIZE;
                    return [3 /*break*/, 6];
                case 9:
                    console.log("   \u2705 Berhasil memasukkan total ".concat(salesData.length, " transaksi penjualan."));
                    console.log("===============================================");
                    console.log("🎉 SEEDING SELESAI! Data siap digunakan di Supabase.");
                    console.log("===============================================");
                    return [2 /*return*/];
            }
        });
    });
}
// Eksekusi fungsi seeding
seedDatabase();
