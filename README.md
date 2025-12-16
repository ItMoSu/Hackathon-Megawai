# 🚀 AI Market Pulse - Complete System

Platform analisis penjualan berbasis AI untuk UMKM dengan prediksi akurat dan rekomendasi bisnis otomatis.

## 📊 Metrics AI Model (Latest)
- **Average Validation MAE**: 0.0802 ✅
- **Average Normalized MAE**: 0.0193 ✅ 
- **Average Improvement**: 93.4% ✅
- **Models ≥90% Improvement**: 180/211 (85%) 🏆

## 🏗️ Arsitektur System

```
┌─────────────┐      ┌─────────────┐      ┌──────────────┐
│  Frontend   │ ───▶ │  Backend    │ ───▶ │ Python ML    │
│  (Next.js)  │      │  (Express)  │      │ (XGBoost v6) │
│  Port 3000  │      │  Port 5000  │      │ Port 8000    │
└─────────────┘      └─────────────┘      └──────────────┘
                            │
                            ▼
                     ┌─────────────┐
                     │  PostgreSQL │
                     │  (Supabase) │
                     └─────────────┘
```

## 📦 Instalasi

### 1. Backend Setup
```bash
cd backend
npm install
npx prisma generate
npm run dev
```

Backend akan berjalan di `http://localhost:5000`

### 2. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

Frontend akan berjalan di `http://localhost:3000`

### 3. Python ML Service Setup
```bash
cd python-service
pip install -r requirements.txt
python main.py
```

ML Service akan berjalan di `http://localhost:8000`

## 🎯 Alur Penggunaan (User Flow)

### **LANGKAH 1: Landing Page** ✅
- Buka aplikasi di `http://localhost:3000`
- Lihat fitur-fitur utama
- Klik "Go to Dashboard" atau "View Products"

### **LANGKAH 2: Setup Produk** ✅
**Halaman**: `/products`

1. Klik tombol **"Tambah"**
2. Isi form:
   - **Nama produk** (wajib): contoh "Nasi Goreng"
   - **Satuan**: pcs, porsi, cup, dll
   - **Harga** (opsional): contoh 15000
3. Klik **"Simpan"**
4. Produk muncul di grid dengan status badges
5. Ulangi untuk 4-5 produk

**Fitur**:
- Badge status: Trending Up, Stable, Declining (dari AI)
- Momentum indicator (% perubahan)
- Average quantity per hari
- Click produk untuk lihat detail di dashboard

### **LANGKAH 3: Input Penjualan Harian** ✅
**Halaman**: `/input`

1. Pilih **tanggal penjualan**
2. Lihat semua produk dalam 1 form
3. Input quantity untuk setiap produk:
   - Gunakan **+ / -** button
   - Atau ketik langsung
4. Produk dengan quantity > 0 akan highlight hijau
5. Lihat ringkasan: X Produk • Y Item
6. Klik **"Simpan Penjualan"**
7. Sistem menampilkan toast **"X data berhasil disimpan!"**

**Fitur**:
- Batch input untuk semua produk sekaligus
- Visual feedback (hijau untuk item yang terisi)
- Real-time summary
- AI analysis otomatis setelah save

### **LANGKAH 4: Dashboard Summary** ✅
**Halaman**: `/dashboard`

**Summary Cards**:
- 💰 **Total Pendapatan** (IDR) + % change vs kemarin
- 📦 **Item Terjual** + % change vs kemarin  
- 🛒 **Transaksi** hari ini

**Burst Alert** (jika ada):
- Alert card merah dengan animasi
- Contoh: "🚨 Nasi Goreng mengalami lonjakan permintaan!"
- Tombol **"Lihat Analisa"** → langsung ke detail produk

**Top 3 Produk**:
- Ranking hari ini dengan icon 👑
- Quick view dari sidebar

**Sidebar Produk**:
- List semua produk
- Click untuk lihat detail analisis AI

### **LANGKAH 5: Product Detail** ✅
**Komponen**: `IntelligenceDashboard` (di dalam Dashboard)

**Metrics Cards**:
- 📈 **Status Penjualan**: NAIK / TURUN / STABIL
- 🚨 **Viral Alert**: Deteksi lonjakan mendadak
- 🎯 **Kepercayaan**: Akurasi AI (berdasarkan data historis)

**Chart Prediksi**:
- Line chart 7 hari ke depan
- Confidence band (upper/lower bound)
- Highlight weekend & payday period
- Peak detection (garis merah)

**Badge Status**:
- 🟢 TRENDING UP
- 🟡 STABLE
- 🔴 DECLINING

**Metrics**:
- Momentum score (% change)
- Burst score (z-score)
- Total prediksi 7 hari
- Rata-rata per hari
- Trend direction

**Rekomendasi AI**:
- Actionable recommendations
- Contoh: "📦 Tambah stok 20-30%"
- Reasoning dan action items

### **LANGKAH 6: Product Ranking** ✅
**Halaman**: `/ranking`

1. Lihat **Top 3 Podium**:
   - 👑 Rank #1 (gold)
   - 🥈 Rank #2 (silver)
   - 🥉 Rank #3 (bronze)
   - Priority score & momentum

2. **Tabel Lengkap**:
   - Semua produk ter-ranking berdasarkan **Priority Score**
   - Kolom: Rank, Produk, Status, Momentum, Priority Bar, Alert
   - Produk dengan priority tinggi di atas
   - Badge status untuk setiap produk
   - Burst alert indicator (⚠️)

3. **Legend Status**:
   - 🟢 Trending Up / Growing
   - ⚪ Stable
   - 🔴 Declining / Falling
   - ⚠️ Burst Alert (Lonjakan)

**Klik produk** → Langsung ke detail di Dashboard

### **LANGKAH 7: Weekly Report** ✅
**Halaman**: `/reports`

**Summary**:
- 📦 **Total Item Terjual** (7 hari)
- 💰 **Total Revenue** (estimasi)
- 📅 Date range (start - end)

**Top Performers**:
- Top 5 produk terlaris minggu ini
- Ranking dengan icon 1, 2, 3
- Total quantity sold
- Click untuk lihat detail

**Perlu Perhatian**:
- Produk dengan VIRAL SPIKE (lonjakan)
- Produk dengan penurunan drastis
- Detail masalah & tanggal
- Badge status: Lonjakan / Menurun

**AI Insights**:
- Otomatis generated dari data
- Contoh:
  - "Nasi Goreng terlaris (125 penjualan)"
  - "3 produk butuh perhatian"
  - "Rata-rata 42 item/hari"
  - "Harga rata-rata: Rp 12,500"

## 🔗 API Endpoints

### Authentication
- `POST /api/auth/login` - Login user
- `POST /api/auth/register` - Register user

### Products
- `GET /api/products` - Get all products
- `POST /api/products` - Create product

### Sales
- `POST /api/sales` - Create sales entry (dengan AI analysis otomatis)
- `GET /api/sales` - Get sales data

### Analytics
- `GET /api/analytics/summary` - Dashboard summary
- `GET /api/analytics/ranking` - Product ranking dengan AI priority
- `GET /api/analytics/products/:productId/forecast` - Get ML forecast
- `GET /api/analytics/trending` - Get burst alerts

### Intelligence (Python ML)
- `POST /api/ml/predict-universal` - Universal ML prediction
- `GET /api/intelligence/analyze/:productId` - Full AI analysis

### Reports
- `GET /api/reports/weekly` - Weekly report

## 🎨 Tech Stack

### Frontend
- **Next.js 15** (App Router)
- **TypeScript**
- **Tailwind CSS**
- **Framer Motion** (minimal animations)
- **Recharts** (charting)
- **Lucide React** (icons)

### Backend
- **Express.js**
- **TypeScript**
- **Prisma ORM**
- **PostgreSQL** (Supabase)
- **JWT Authentication**
- **Axios** (ML service communication)

### Python ML Service
- **FastAPI**
- **XGBoost v6** (Hybrid Brain)
- **Pandas** (data processing)
- **NumPy** (numerical computing)

## 🧠 AI Model Features

### Feature Engineering
- **Lag features**: 1, 2, 3, 7, 14 days
- **Rolling statistics**: mean, std, min, max (windows: 3, 7, 14)
- **Day-of-week patterns**: Cyclical encoding
- **Momentum indicators**: ROC, diff, EMA
- **Calendar factors**: Weekend, payday periods

### Anti-Overfitting Strategy
- Adaptive hyperparameters based on dataset size
- Strong regularization (alpha, lambda, gamma)
- Time-series cross-validation
- Ensemble with rule-based predictions
- Smart baseline comparison

### Prediction Method
- **Hybrid Ensemble**: ML + Rule-based
- **Dynamic weighting**: Based on improvement score
- **Confidence levels**: HIGH / MEDIUM / LOW
- **Uncertainty bands**: Upper/lower bounds

## 🎯 Key Performance Indicators

| Metric | Target | Achieved | Status |
|--------|--------|----------|--------|
| Validation MAE | ~0.1 | 0.0802 | ✅ |
| Normalized MAE | ≤0.1 | 0.0193 | ✅ |
| Improvement | ≥80% | 93.4% | ✅ |
| Models ≥90% | >70% | 85% | ✅ |

## 🔐 Environment Variables

### Backend (.env)
```env
PORT=5000
DATABASE_URL=your_supabase_url
DIRECT_URL=your_supabase_direct_url
JWT_SECRET=your_jwt_secret
ML_API_URL=http://localhost:8000
```

### Frontend (.env.local)
```env
NEXT_PUBLIC_API_URL=http://localhost:5000
```

### Python Service (.env)
```env
PORT=8000
MODEL_PATH=./training/models_output
```

## 📱 UI/UX Design

### Design System
- **Primary Color**: Red #DC2626
- **Background**: Gray-50 (clean, minimal)
- **Typography**: Inter (body), Space Grotesk (headings)
- **Border Radius**: Rounded (8px-12px)
- **Shadows**: Subtle elevation

### Responsiveness
- ✅ Mobile-first approach
- ✅ Breakpoints: sm (640px), md (768px), lg (1024px), xl (1280px)
- ✅ Collapsible sidebar di mobile
- ✅ Touch-friendly buttons (min 44x44px)

### Key Components
- **Card**: Reusable container dengan border-left accent
- **Badge**: Status indicators (Trending, Stable, etc)
- **Button**: Primary, Secondary, Outline variants
- **Navbar**: Fixed top dengan scroll effect
- **Toast**: Notification system

## 🚦 Development Commands

### Start All Services
```bash
# Terminal 1 - Backend
cd backend && npm run dev

# Terminal 2 - Frontend  
cd frontend && npm run dev

# Terminal 3 - Python ML
cd python-service && python main.py
```

### Database
```bash
cd backend
npx prisma db pull      # Sync schema from DB
npx prisma generate     # Generate Prisma client
npx prisma studio       # Open Prisma Studio
```

### AI Model Training
```bash
cd python-service
python training/train.py  # Train all models
python training/preprocess.py  # Preprocess data only
```

## 📈 Analytics Flow

```
User Input Sales
     ↓
Save to Database
     ↓
Trigger AI Analysis
     ↓
Calculate Momentum & Burst
     ↓
Call ML Service (XGBoost)
     ↓
Generate Predictions (7 days)
     ↓
Create Recommendations
     ↓
Update Daily Analytics Table
     ↓
Display in Dashboard
```

## 🎓 Business Intelligence Features

### Momentum Detection
- **TRENDING_UP**: Combined momentum > 5%
- **GROWING**: Combined momentum > 2%
- **STABLE**: ±2% range
- **DECLINING**: Combined momentum < -2%
- **FALLING**: Combined momentum < -5%

### Burst Detection  
- **CRITICAL**: Z-score > 3.0
- **HIGH**: Z-score > 2.0
- **MEDIUM**: Z-score > 1.5
- **NORMAL**: Z-score ≤ 1.5

### Priority Score
```
Priority = 0.7 × Momentum Factor + 0.3 × Burst Factor
```

Produk dengan priority tinggi = perlu perhatian segera

## 🛠️ Troubleshooting

### Backend tidak running
```bash
cd backend
npm install
npx prisma generate
npm run dev
```

### Frontend error
```bash
cd frontend
npm install
npm run dev
```

### ML Service tidak connect
```bash
cd python-service
pip install -r requirements.txt
python main.py
```

### Database schema outdated
```bash
cd backend
npx prisma db pull
npx prisma generate
```

## 📝 Notes

- Semua data penjualan disimpan dalam **IDR** (Indonesian Rupiah)
- Minimum data untuk ML prediction: **5 hari**
- Optimal data untuk accuracy: **30+ hari**
- Model di-retrain otomatis saat ada data baru
- Prediksi di-cache untuk performa
- Real-time burst detection

## 👨‍💻 Development

**Version**: 1.0.0  
**AI Model**: Hybrid Brain v6.0  
**Last Updated**: December 2025

---
Made with ❤️ for Indonesian UMKM

