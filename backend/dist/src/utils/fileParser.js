"use strict";
/**
 * Dynamic file parser for CSV, Excel, and DOCX
 * Supports flexible column names in Indonesian and English
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseFlexibleDate = parseFlexibleDate;
exports.parseCSV = parseCSV;
exports.parseExcel = parseExcel;
exports.parseDOCX = parseDOCX;
exports.parseFile = parseFile;
const XLSX = __importStar(require("xlsx"));
// Column name patterns - supports various Indonesian and English variations
const COLUMN_PATTERNS = {
    product: [
        'nama', 'produk', 'product', 'menu', 'item', 'barang', 'name',
        'nama_produk', 'nama produk', 'product_name', 'product name',
        'nama_menu', 'nama menu', 'menu_name', 'nama_barang', 'nama barang'
    ],
    quantity: [
        'qty', 'quantity', 'jumlah', 'terjual', 'sold', 'jml', 'kuantitas',
        'jumlah_terjual', 'jumlah terjual', 'total', 'banyak', 'unit',
        'pcs', 'porsi', 'amount', 'count', 'stok_keluar', 'stok keluar'
    ],
    date: [
        'tanggal', 'date', 'tgl', 'waktu', 'time', 'hari', 'day',
        'tanggal_transaksi', 'tanggal transaksi', 'transaction_date',
        'sale_date', 'sale date', 'order_date', 'order date', 'created', 'created_at'
    ],
    price: [
        'harga', 'price', 'hrg', 'nilai', 'value', 'cost', 'biaya',
        'harga_satuan', 'harga satuan', 'unit_price', 'unit price',
        'harga_jual', 'harga jual', 'selling_price', 'sell_price'
    ]
};
// Find best matching column index
function findColumnIndex(headers, patterns) {
    const lowerHeaders = headers.map(h => h.toLowerCase().trim().replace(/[^a-z0-9_\s]/g, ''));
    for (const pattern of patterns) {
        const idx = lowerHeaders.findIndex(h => h === pattern ||
            h.includes(pattern) ||
            pattern.includes(h));
        if (idx !== -1)
            return idx;
    }
    return -1;
}
// Detect column mapping from headers
function detectColumns(headers) {
    return {
        product: findColumnIndex(headers, COLUMN_PATTERNS.product),
        quantity: findColumnIndex(headers, COLUMN_PATTERNS.quantity),
        date: findColumnIndex(headers, COLUMN_PATTERNS.date),
        price: findColumnIndex(headers, COLUMN_PATTERNS.price)
    };
}
// Parse flexible date formats
function parseFlexibleDate(dateInput) {
    if (!dateInput)
        return undefined;
    // Handle Excel serial date number
    if (typeof dateInput === 'number') {
        try {
            const date = XLSX.SSF.parse_date_code(dateInput);
            if (date) {
                const y = date.y;
                const m = String(date.m).padStart(2, '0');
                const d = String(date.d).padStart(2, '0');
                return `${y}-${m}-${d}`;
            }
        }
        catch { }
    }
    const dateStr = String(dateInput).trim();
    if (!dateStr)
        return undefined;
    // YYYY-MM-DD format
    let match = dateStr.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/);
    if (match) {
        const [, y, m, d] = match;
        return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
    // DD-MM-YYYY or DD/MM/YYYY format (Indonesian style)
    match = dateStr.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})/);
    if (match) {
        const [, d, m, y] = match;
        return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
    // DD-MM-YY or DD/MM/YY format
    match = dateStr.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{2})$/);
    if (match) {
        const [, d, m, yy] = match;
        const y = parseInt(yy) > 50 ? `19${yy}` : `20${yy}`;
        return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
    // Try Indonesian date format: "1 Januari 2024" or "1 Jan 2024"
    const monthNames = {
        'januari': '01', 'jan': '01', 'february': '02', 'februari': '02', 'feb': '02',
        'maret': '03', 'mar': '03', 'march': '03', 'april': '04', 'apr': '04',
        'mei': '05', 'may': '05', 'juni': '06', 'jun': '06', 'june': '06',
        'juli': '07', 'jul': '07', 'july': '07', 'agustus': '08', 'aug': '08', 'agu': '08',
        'september': '09', 'sep': '09', 'sept': '09', 'oktober': '10', 'oct': '10', 'okt': '10',
        'november': '11', 'nov': '11', 'desember': '12', 'dec': '12', 'des': '12'
    };
    const textMatch = dateStr.toLowerCase().match(/(\d{1,2})\s+([a-z]+)\s+(\d{4})/);
    if (textMatch) {
        const [, d, monthStr, y] = textMatch;
        const m = monthNames[monthStr];
        if (m) {
            return `${y}-${m}-${d.padStart(2, '0')}`;
        }
    }
    // Try native Date parsing as fallback
    try {
        const d = new Date(dateStr);
        if (!isNaN(d.getTime()) && d.getFullYear() > 2000) {
            return d.toISOString().split('T')[0];
        }
    }
    catch { }
    return undefined;
}
// Parse number from various formats
function parseNumber(value) {
    if (typeof value === 'number')
        return value;
    if (!value)
        return 0;
    const str = String(value).trim()
        .replace(/[Rr][Pp]\.?\s*/g, '') // Remove Rp
        .replace(/\./g, '') // Remove thousand separator (Indonesian)
        .replace(/,/g, '.') // Replace comma with dot for decimals
        .replace(/[^\d.-]/g, ''); // Remove non-numeric except dot and minus
    const num = parseFloat(str);
    return isNaN(num) ? 0 : num;
}
/**
 * Parse CSV content with dynamic column detection
 */
function parseCSV(content) {
    const lines = content.split(/\r?\n/).filter(line => line.trim());
    const result = [];
    if (lines.length === 0)
        return result;
    // Detect delimiter (comma, semicolon, or tab)
    const firstLine = lines[0];
    const delimiter = firstLine.includes(';') ? ';' :
        firstLine.includes('\t') ? '\t' : ',';
    // Parse header
    const headers = firstLine.split(delimiter).map(h => h.trim().replace(/"/g, ''));
    const colMap = detectColumns(headers);
    // Check if we have required columns
    if (colMap.product === -1 || colMap.quantity === -1) {
        // Try without header - assume first col is product, second is quantity
        const hasHeader = headers.some(h => COLUMN_PATTERNS.product.some(p => h.toLowerCase().includes(p)) ||
            COLUMN_PATTERNS.quantity.some(p => h.toLowerCase().includes(p)));
        if (!hasHeader) {
            // No header detected, use positional
            colMap.product = 0;
            colMap.quantity = 1;
            colMap.date = headers.length > 2 ? 2 : -1;
        }
    }
    const startIndex = colMap.product !== 0 || colMap.quantity !== 1 ? 1 : 0;
    for (let i = startIndex; i < lines.length; i++) {
        const cols = lines[i].split(delimiter).map(c => c.trim().replace(/"/g, ''));
        if (cols.length < 2)
            continue;
        const productName = cols[colMap.product] || '';
        const quantity = parseNumber(cols[colMap.quantity]);
        const date = colMap.date >= 0 ? parseFlexibleDate(cols[colMap.date]) : undefined;
        const price = colMap.price >= 0 ? parseNumber(cols[colMap.price]) : undefined;
        if (productName && quantity >= 0) {
            result.push({ productName, quantity, date, price });
        }
    }
    return result;
}
/**
 * Parse Excel file (xlsx/xls) with dynamic column detection
 */
function parseExcel(buffer) {
    const result = [];
    try {
        const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
        // Get first sheet
        const sheetName = workbook.SheetNames[0];
        if (!sheetName)
            return result;
        const sheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        if (data.length < 2)
            return result;
        // First row is headers
        const firstRow = data[0];
        if (!Array.isArray(firstRow))
            return result;
        const headers = firstRow.map(h => String(h || ''));
        const colMap = detectColumns(headers);
        // If no headers detected, try to infer from data
        if (colMap.product === -1 && colMap.quantity === -1) {
            // Assume first text column is product, first number column is quantity
            const sampleRow = data[1];
            if (Array.isArray(sampleRow)) {
                for (let i = 0; i < sampleRow.length; i++) {
                    const val = sampleRow[i];
                    if (colMap.product === -1 && typeof val === 'string' && val.length > 0) {
                        colMap.product = i;
                    }
                    else if (colMap.quantity === -1 && typeof val === 'number') {
                        colMap.quantity = i;
                    }
                }
            }
        }
        if (colMap.product === -1)
            colMap.product = 0;
        if (colMap.quantity === -1)
            colMap.quantity = 1;
        // Parse data rows
        for (let i = 1; i < data.length; i++) {
            const row = data[i];
            if (!Array.isArray(row) || row.length < 2)
                continue;
            const productName = String(row[colMap.product] || '').trim();
            const quantity = parseNumber(row[colMap.quantity]);
            const date = colMap.date >= 0 ? parseFlexibleDate(row[colMap.date]) : undefined;
            const price = colMap.price >= 0 ? parseNumber(row[colMap.price]) : undefined;
            if (productName && quantity >= 0) {
                result.push({ productName, quantity, date, price });
            }
        }
    }
    catch (error) {
        console.error('Excel parse error:', error);
    }
    return result;
}
/**
 * Parse DOCX file - extracts tables
 * Note: Basic implementation, looks for table-like structures
 */
function parseDOCX(buffer) {
    const result = [];
    try {
        // DOCX is a zip file, xlsx library can read the xml inside
        // But for tables, we need a different approach
        // For now, try to extract any tabular data from the raw XML
        const zip = XLSX.read(buffer, { type: 'buffer' });
        // Look for any embedded spreadsheet
        if (zip.SheetNames && zip.SheetNames.length > 0) {
            return parseExcel(buffer);
        }
        // If no spreadsheet, return empty - DOCX table parsing is complex
        console.log('DOCX file has no embedded spreadsheet data');
    }
    catch (error) {
        console.error('DOCX parse error:', error);
    }
    return result;
}
/**
 * Main parse function - auto-detects file type
 */
function parseFile(buffer, filename) {
    const lowerName = filename.toLowerCase();
    if (lowerName.endsWith('.csv') || lowerName.endsWith('.txt')) {
        return parseCSV(buffer.toString('utf-8'));
    }
    if (lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls')) {
        return parseExcel(buffer);
    }
    if (lowerName.endsWith('.docx')) {
        return parseDOCX(buffer);
    }
    throw new Error(`Unsupported file format: ${filename}`);
}
