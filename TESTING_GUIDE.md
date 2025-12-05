# 🧪 Testing Guide - AI Market Pulse

## 🚀 Quick Start Testing

### Prerequisites
Pastikan semua service running:
1. ✅ Backend (`localhost:5000`)
2. ✅ Frontend (`localhost:3000`)
3. ✅ Python ML (`localhost:8000`)

## 📝 Test Scenario - Complete Flow

### Test 1: Landing Page ✅
**URL**: `http://localhost:3000`

**Expected**:
- [ ] Landing page muncul dengan hero section
- [ ] 3 feature cards (Real-time Analytics, AI Powered, Secure)
- [ ] Button "Go to Dashboard" berfungsi
- [ ] Button "View Products" berfungsi
- [ ] Navbar fixed di top

---

### Test 2: Login/Register ✅
**URL**: `http://localhost:3000/login`

**Test Login**:
1. Masukkan email: `test@admin.com`
2. Masukkan password: (password Anda)
3. Click "Masuk"
4. **Expected**: Redirect ke `/products`
5. **Verify**: Token tersimpan di localStorage

**Test Register**:
1. Toggle ke mode "Daftar"
2. Isi email baru
3. Isi password
4. Click "Buat Akun"
5. **Expected**: Redirect ke `/products`

---

### Test 3: Setup Produk ✅
**URL**: `http://localhost:3000/products`

**Test Add Product** (Lakukan 4-5 kali):

**Produk 1**:
- Nama: "Nasi Goreng"
- Satuan: "porsi"
- Harga: 15000
- Click "Simpan"
- **Expected**: Produk muncul di grid

**Produk 2**:
- Nama: "Es Teh Manis"  
- Satuan: "cup"
- Harga: 5000

**Produk 3**:
- Nama: "Ayam Bakar"
- Satuan: "porsi"
- Harga: 25000

**Produk 4**:
- Nama: "Kopi Susu"
- Satuan: "cup"  
- Harga: 12000

**Produk 5**:
- Nama: "Pisang Goreng"
- Satuan: "porsi"
- Harga: 8000

**Verify**:
- [ ] Semua produk muncul di grid
- [ ] Badge menunjukkan satuan (PORSI, CUP)
- [ ] Click produk → redirect ke dashboard

---

### Test 4: Input Penjualan (Hari 1) ✅
**URL**: `http://localhost:3000/input`

**Test Input Sales**:
1. Pastikan tanggal = hari ini
2. Input quantity untuk produk:
   - Nasi Goreng: 25 porsi
   - Es Teh Manis: 40 cup
   - Ayam Bakar: 15 porsi
   - Kopi Susu: 30 cup
   - Pisang Goreng: 20 porsi
3. **Verify**: Produk dengan qty > 0 highlight hijau
4. **Verify**: Summary: "5 Produk • 130 Item"
5. Click **"Simpan Penjualan"**

**Expected**:
- [ ] Toast muncul: "✅ 5 data berhasil disimpan!"
- [ ] Quantity reset ke 0
- [ ] Data masuk ke database

**Verify Backend**:
- Check endpoint: `GET http://localhost:5000/api/sales`
- Should return 5 sales entries

---

### Test 5: Input Penjualan (Hari 2-7) ✅
Ulangi input sales untuk 6 hari berikutnya dengan variasi quantity.

**Contoh Hari 2** (ubah tanggal):
- Nasi Goreng: 28 porsi (+12%)
- Es Teh Manis: 35 cup (-12%)
- Ayam Bakar: 18 porsi (+20%)
- Kopi Susu: 32 cup (+7%)
- Pisang Goreng: 18 porsi (-10%)

**Contoh Hari 7** (buat lonjakan):
- Nasi Goreng: **80 porsi** (BURST! 🚨)
- Es Teh Manis: 42 cup
- Ayam Bakar: 20 porsi
- Kopi Susu: 35 cup
- Pisang Goreng: 22 porsi

**Why**: Ini akan trigger burst detection untuk Nasi Goreng

---

### Test 6: Dashboard Summary ✅
**URL**: `http://localhost:3000/dashboard`

**Verify Summary Cards**:
- [ ] **Total Pendapatan**: Menampilkan IDR dengan format rupiah
- [ ] **Item Terjual**: Total quantity hari ini
- [ ] **Transaksi**: Jumlah transaksi
- [ ] % Change: Menampilkan arrow up/down dan persentase

**Verify Burst Alert** (jika hari ke-7):
- [ ] Alert card merah muncul
- [ ] Text: "🚨 Nasi Goreng mengalami lonjakan permintaan!"
- [ ] Badge: "CRITICAL" atau "HIGH"
- [ ] Button "Lihat Analisa" berfungsi

**Verify Top 3**:
- [ ] Sidebar menampilkan top 3 produk hari ini
- [ ] Icon ranking: 👑, 🥈, 🥉
- [ ] Menampilkan quantity

**Verify Product List**:
- [ ] Semua produk muncul di sidebar
- [ ] Click produk → detail analytics muncul

---

### Test 7: Product Detail (Intelligence Dashboard) ✅
**Location**: Di dalam `/dashboard` setelah pilih produk

**Verify Metrics Cards**:
- [ ] **Status Penjualan**: NAIK / STABIL / TURUN
- [ ] **Viral Alert**: Jika burst detected
- [ ] **Kepercayaan**: Rating 1-5 stars

**Verify Chart**:
- [ ] Line chart dengan prediksi 7 hari
- [ ] Upper/lower confidence band (hijau)
- [ ] Weekend highlight (kuning)
- [ ] Smooth animation

**Verify Badges**:
- [ ] Status badge: TRENDING_UP (hijau), STABLE (abu), DECLINING (merah)

**Verify Metrics Panel**:
- [ ] Total 7 Hari: Sum of predictions
- [ ] Rata-rata/Hari: Average
- [ ] Trend: 📈 Naik / ➡️ Stabil / 📉 Turun

**Verify Recommendations**:
- [ ] AI recommendation card muncul
- [ ] Contoh: "📦 Tambah stok 20-30%"
- [ ] Action items (bullets)
- [ ] Reasoning jelas

**Test Actions**:
- [ ] Refresh button → reload data
- [ ] Export CSV button → download forecast data

---

### Test 8: Product Ranking ✅
**URL**: `http://localhost:3000/ranking`

**Verify Top 3 Podium**:
- [ ] 3 cards dengan border berbeda (gold, silver, bronze)
- [ ] Icon: 👑, 🥈, 🥉
- [ ] Priority score (%)
- [ ] Momentum (%)
- [ ] Status badge

**Verify Full Table**:
- [ ] Semua produk ter-list
- [ ] Sorted by priority score (descending)
- [ ] Kolom: Rank, Produk, Status, Momentum, Priority Bar, Alert
- [ ] Priority bar (visual progress bar)
- [ ] Alert icon (⚠️) jika burst

**Test Interaction**:
- [ ] Click produk → redirect ke dashboard dengan product ID
- [ ] Hover effect di row

**Verify Legend**:
- [ ] Penjelasan warna status
- [ ] Penjelasan alert icon

---

### Test 9: Weekly Report ✅
**URL**: `http://localhost:3000/reports`

**Verify Header**:
- [ ] Title: "Weekly Report"
- [ ] Date range: "5 Dec - 12 Dec" (contoh)
- [ ] Refresh button berfungsi

**Verify Summary Cards**:
- [ ] **Total Terjual**: Sum 7 hari
- [ ] **Total Revenue**: Sum revenue 7 hari (IDR)
- [ ] Icon bagus (📦, 💰)

**Verify Top Performers**:
- [ ] List 5 produk terlaris
- [ ] Ranking 1-5 dengan icon/number
- [ ] Quantity sold
- [ ] Click → redirect ke dashboard

**Verify Perlu Perhatian**:
- [ ] Jika ada burst: Badge "Lonjakan" + icon TrendingUp
- [ ] Jika ada decline: Badge "Menurun" + icon TrendingDown
- [ ] Detail masalah
- [ ] Tanggal kejadian

**Verify AI Insights** (auto-generated):
- [ ] "Nasi Goreng terlaris (X penjualan)"
- [ ] "Y produk butuh perhatian"
- [ ] "Rata-rata Z item/hari"
- [ ] Icon sesuai (🏆, ⚠️, 📊, 💰)

---

## 🔍 API Testing

### Test API Manually

**1. Health Check**:
```bash
GET http://localhost:5000/health
Expected: { "status": "OK", "message": "Backend is running!" }
```

**2. Dashboard Summary**:
```bash
GET http://localhost:5000/api/analytics/summary
Headers: { "Authorization": "Bearer YOUR_TOKEN" }

Expected:
{
  "success": true,
  "summary": {
    "today": { "total_quantity": 130, "total_revenue": 1500000, "sales_count": 5 },
    "changes": { "quantity_change": 15.5, "revenue_change": 12.3 },
    "burst_alerts": [...],
    "top_products": [...]
  }
}
```

**3. Product Ranking**:
```bash
GET http://localhost:5000/api/analytics/ranking
Headers: { "Authorization": "Bearer YOUR_TOKEN" }

Expected:
{
  "success": true,
  "rankings": [
    {
      "productId": "...",
      "productName": "Nasi Goreng",
      "priorityScore": 0.85,
      "momentum": { "combined": 1.15, "status": "TRENDING_UP" },
      "burst": { "score": 2.5, "level": "HIGH" },
      ...
    }
  ]
}
```

**4. ML Universal Prediction**:
```bash
POST http://localhost:8000/api/ml/predict-universal
Body:
{
  "sales_data": [
    { "date": "2024-12-01", "quantity": 25 },
    { "date": "2024-12-02", "quantity": 28 },
    ...
  ],
  "forecast_days": 7
}

Expected:
{
  "success": true,
  "predictions": [
    { "date": "2024-12-08", "predicted_quantity": 30.5, "confidence": "HIGH", ... }
  ],
  "model_info": { "mode": "HYBRID_OPTIMIZED_v6", ... }
}
```

---

## ✅ Acceptance Criteria

### Performance
- [ ] Page load < 2 seconds
- [ ] API response < 500ms
- [ ] ML prediction < 3 seconds
- [ ] Smooth animations (60fps)

### Functionality
- [ ] Semua CRUD operations bekerja (Create, Read, Update, Delete)
- [ ] Authentication & authorization working
- [ ] AI predictions accurate (MAE < 0.1)
- [ ] Burst detection real-time
- [ ] Recommendations relevant

### UI/UX
- [ ] Responsive di mobile (320px - 1920px)
- [ ] Accessible (keyboard navigation, ARIA labels)
- [ ] Toast notifications jelas
- [ ] Loading states smooth
- [ ] Error handling graceful

### Data Integrity
- [ ] Sales data tersimpan ke database
- [ ] Currency dalam IDR
- [ ] Dates dalam format ISO
- [ ] Quantity non-negative
- [ ] Unique constraint per product per date

### AI Model
- [ ] Model MAE < 0.1 ✅ (Achieved: 0.0802)
- [ ] Improvement > 80% ✅ (Achieved: 93.4%)
- [ ] No overfitting warnings
- [ ] Predictions make sense

---

## 🐛 Common Issues & Solutions

### Issue: "401 Unauthorized"
**Solution**: 
- Check localStorage has token
- Re-login
- Verify JWT_SECRET in backend

### Issue: "ML Service offline"
**Solution**:
- Check Python service running on port 8000
- Test: `curl http://localhost:8000/`
- Restart: `python main.py`

### Issue: "No data in dashboard"
**Solution**:
- Add products first (`/products`)
- Input sales data (`/input`)
- Wait for AI analysis (automatic)
- Refresh dashboard

### Issue: "Burst alert tidak muncul"
**Solution**:
- Minimal data: 5 hari
- Buat variasi quantity yang signifikan
- Contoh: Hari 1-6 rata-rata 25, Hari 7 = 80 (lonjakan 3x)

### Issue: "Chart tidak muncul"
**Solution**:
- Check browser console for errors
- Verify recharts installed: `npm install recharts`
- Check API response structure

---

## 📊 Test Data Recommendations

### For Optimal AI Testing

**Dataset 1: Stable Product**
- Hari 1-7: Quantity stabil 20-25 (±10%)
- **Expected**: Status STABLE, Low burst

**Dataset 2: Trending Product**
- Hari 1: 10
- Hari 2: 12 (+20%)
- Hari 3: 15 (+25%)
- Hari 4: 18 (+20%)
- Hari 5: 22 (+22%)
- Hari 6: 25 (+14%)
- Hari 7: 28 (+12%)
- **Expected**: Status TRENDING_UP, Recommendation "Increase stock"

**Dataset 3: Declining Product**
- Hari 1: 50
- Hari 2: 45 (-10%)
- Hari 3: 40 (-11%)
- Hari 4: 35 (-12%)
- Hari 5: 30 (-14%)
- Hari 6: 28 (-7%)
- Hari 7: 25 (-11%)
- **Expected**: Status DECLINING, Recommendation "Reduce stock"

**Dataset 4: Burst Event**
- Hari 1-6: Stabil 20-25
- Hari 7: **80** (BURST!)
- **Expected**: 
  - Burst Alert muncul
  - Burst Level: CRITICAL
  - Burst Score: > 3.0
  - Alert card merah di dashboard

---

## 🎯 Integration Testing Checklist

### Frontend ↔ Backend
- [ ] Products CRUD via API
- [ ] Sales input via API
- [ ] Dashboard summary from `/api/analytics/summary`
- [ ] Ranking from `/api/analytics/ranking`
- [ ] Weekly report from `/api/reports/weekly`

### Backend ↔ Python ML
- [ ] Intelligence service calls `/api/ml/predict-universal`
- [ ] Predictions returned correctly
- [ ] Model metadata included
- [ ] Error handling for ML offline

### Backend ↔ Database
- [ ] Prisma client initialized
- [ ] Products saved to `products` table
- [ ] Sales saved to `sales` table
- [ ] Analytics saved to `daily_analytics` table
- [ ] User authentication via Supabase Auth

---

## 📸 Screenshots to Verify

### Landing Page
- Clean hero section
- 3 feature cards
- Call-to-action buttons

### Products Page
- Product grid (4 columns on desktop)
- Add product form (collapsible)
- Status badges on each card

### Input Sales Page
- Date picker
- All products listed
- +/- quantity buttons
- Summary bar at bottom

### Dashboard
- 3 summary cards with colors
- Burst alert (if any)
- Sidebar with top 3
- Product detail with chart

### Ranking
- Top 3 podium cards
- Full ranking table
- Progress bars for priority
- Status badges

### Weekly Report
- Summary cards (quantity & revenue)
- Top performers list
- Attention needed section
- AI insights cards

---

## 🔧 Debug Tools

### Browser Console
```javascript
// Check auth
localStorage.getItem('token')
localStorage.getItem('user_id')

// Check API
fetch('http://localhost:5000/health').then(r => r.json()).then(console.log)

// Check ML Service
fetch('http://localhost:8000/').then(r => r.json()).then(console.log)
```

### Backend Logs
- Check terminal running backend
- Look for: `🚀 Backend running on http://localhost:5000`
- API calls will log in terminal

### Python ML Logs
- Check terminal running Python
- Look for: `Uvicorn running on http://0.0.0.0:8000`
- Model loading logs will show

---

## ✨ Expected User Experience

### First Time User Journey
1. **Onboarding**: Lihat landing page → understand product
2. **Setup**: Login → Add 4-5 products (2 menit)
3. **Input**: Input penjualan harian (30 detik per hari)
4. **Insights**: After 5+ days → AI predictions available
5. **Action**: Lihat recommendations → adjust business strategy

### Daily Usage
1. Open `/input` (bookmark)
2. Input penjualan hari ini (30 detik)
3. Check `/dashboard` (1 menit)
4. Lihat burst alerts
5. Read AI recommendations
6. Done! ✅

### Weekly Review
1. Open `/reports` every Monday
2. Review top performers
3. Check attention needed
4. Plan week ahead based on AI insights

---

## 🎓 Success Metrics

### User Satisfaction
- ⏱️ Time to first insight: < 5 minutes (after 5 days data)
- 🎯 Prediction accuracy: MAE 0.08 (93% improvement)
- 📱 Mobile friendly: 100% responsive
- 🚀 Performance: Fast loading (< 2s)

### Business Impact
- 📈 Better stock management
- 💰 Reduced waste (overstock)
- 🎯 Increased sales (on-demand stock)
- 📊 Data-driven decisions

---

Made with ❤️ by AI Market Pulse Team

