# 🚀 Quick Start Guide - AI Market Pulse

## ⚡ Startup Sequence (3 Terminals)

### Terminal 1: Backend (Express + PostgreSQL)
```powershell
cd backend
npm run dev
```
✅ **Expected Output**: 
```
🚀 Backend running on http://localhost:5000
```

### Terminal 2: Frontend (Next.js)
```powershell
cd frontend
npm run dev
```
✅ **Expected Output**:
```
✓ Ready in 3s
- Local: http://localhost:3000
- Network: http://192.168.x.x:3000
```

### Terminal 3: Python ML Service
```powershell
cd python-service
python main.py
```
✅ **Expected Output**:
```
INFO: Uvicorn running on http://0.0.0.0:8000
```

---

## 🎯 Access Points

| Service | URL | Status |
|---------|-----|--------|
| **Frontend** | http://localhost:3000 | Open in browser |
| **Backend API** | http://localhost:5000 | Check http://localhost:5000/health |
| **Python ML** | http://localhost:8000 | Check http://localhost:8000/ |

---

## ✅ Verification Checklist

### 1. Check Backend
```powershell
# In browser or curl
http://localhost:5000/health
```
**Expected**: `{ "status": "OK", "message": "Backend is running!" }`

### 2. Check Python ML
```powershell
# In browser or curl
http://localhost:8000/
```
**Expected**: `{ "message": "AI Market Pulse ML Service", "status": "running" }`

### 3. Check Frontend
```powershell
# Open browser
http://localhost:3000
```
**Expected**: Landing page dengan Market Pulse branding

---

## 🔧 First Time Setup

### If Fresh Installation

**1. Install Dependencies**
```powershell
# Backend
cd backend
npm install
npx prisma generate

# Frontend
cd frontend
npm install

# Python
cd python-service
pip install -r requirements.txt
```

**2. Setup Environment Variables**

**Backend** (`backend/.env`):
```env
PORT=5000
DATABASE_URL="your_supabase_url"
DIRECT_URL="your_supabase_direct_url"
JWT_SECRET="your_secret_key"
ML_API_URL="http://localhost:8000"
```

**Frontend** (`frontend/.env.local`):
```env
NEXT_PUBLIC_API_URL="http://localhost:5000"
```

**3. Database Setup**
```powershell
cd backend
npx prisma db pull      # Sync schema
npx prisma generate     # Generate client
```

---

## 🎮 Usage Flow

### Step 1: Login (First Time)
1. Open http://localhost:3000/login
2. Register akun baru atau login
3. **Token** akan tersimpan otomatis

### Step 2: Add Products
1. Go to **Products** page
2. Click **"Tambah"**
3. Tambah 4-5 produk
   - Contoh: Nasi Goreng, Es Teh, Ayam Bakar, Kopi Susu, Pisang Goreng

### Step 3: Input Sales (Daily)
1. Go to **Input Sales** page
2. Pilih tanggal
3. Input quantity untuk setiap produk
4. Click **"Simpan Penjualan"**
5. **Repeat for 7+ days** (bisa ubah tanggal manual)

### Step 4: View Analytics
1. Go to **Dashboard**
   - Lihat summary cards
   - Check burst alerts
   - Click produk → lihat detail + chart + rekomendasi AI
2. Go to **Ranking**
   - Lihat top 3 podium
   - View full ranking table
3. Go to **Reports**
   - Weekly summary
   - Top performers
   - Attention needed

---

## 🚨 Troubleshooting

### Backend Error: "Prisma client not initialized"
```powershell
cd backend
npx prisma generate
npm run dev
```

### Frontend Error: "Module not found"
```powershell
cd frontend
npm install
npm run dev
```

### Python Error: "Module not found"
```powershell
cd python-service
pip install -r requirements.txt
python main.py
```

### API Error: "401 Unauthorized"
- Clear localStorage
- Re-login
- Check JWT_SECRET di backend .env

### No Burst Alerts Showing
- Input minimal 5-7 hari data
- Buat variasi signifikan (lonjakan 2-3x)
- Refresh dashboard

---

## 📊 Test Data (Quick Testing)

### Quick Test Script
Gunakan data ini untuk testing cepat:

**Hari 1-6**: Quantity stabil (20-30)
**Hari 7**: Quantity tinggi (80) → Trigger BURST

```
Nasi Goreng:
Day 1: 25, Day 2: 28, Day 3: 26, Day 4: 24, Day 5: 27, Day 6: 26, Day 7: 80 🚨
```

Setelah input hari 7, dashboard akan menampilkan:
- 🚨 Burst Alert Card (merah)
- Badge: CRITICAL
- Recommendation: Tambah stok segera

---

## 💡 Pro Tips

### For Best AI Results
1. **Konsisten input data** - Minimal 14 hari untuk accuracy optimal
2. **Variasi realistis** - Jangan terlalu flat atau terlalu random
3. **Include weekends** - Weekend pattern penting untuk AI
4. **Mark special days** - Payday, holiday affects predictions

### For Best UX
1. Gunakan **keyboard shortcuts** (Tab, Enter)
2. **Bookmark** `/input` page untuk daily use
3. Check **Dashboard** every morning
4. Review **Reports** every Monday
5. Act on **Burst Alerts** immediately

---

## 📱 Mobile Testing

### Breakpoints to Test
- **320px** - Small mobile (iPhone SE)
- **375px** - Standard mobile (iPhone 12)
- **768px** - Tablet (iPad)
- **1024px** - Desktop (laptop)
- **1920px** - Large desktop

### Key Areas
- [ ] Navbar collapses to hamburger
- [ ] Cards stack vertically
- [ ] Tables scroll horizontally
- [ ] Forms full-width on mobile
- [ ] Buttons touch-friendly (min 44px)

---

## 🎯 Success Criteria

After running for 7+ days with real data, you should see:

### Dashboard
- ✅ Accurate summary metrics
- ✅ Burst alerts for anomalies
- ✅ Top 3 updates daily

### Product Detail
- ✅ Chart with smooth predictions
- ✅ Confidence bands realistic
- ✅ Recommendations actionable

### Ranking
- ✅ Priority scores make sense
- ✅ Top products align with actual sales
- ✅ Status badges accurate

### Reports
- ✅ Weekly trends clear
- ✅ Top performers correct
- ✅ Attention items relevant

---

## 🎓 Learn More

### Architecture
- Read `README.md` for system overview
- Check `IMPLEMENTATION_SUMMARY.md` for technical details

### Testing
- Follow `TESTING_GUIDE.md` for complete test scenarios
- Use test data provided above

### AI Model
- Check `python-service/training/README.md`
- View training logs in `training/models_output/`
- MAE reports in metadata JSON files

---

## 🤝 Support

**System Status**: ✅ All services running
**AI Model**: v6.0 (MAE: 0.0802, Improvement: 93.4%)
**Last Updated**: December 2025

For issues: Check terminal logs, verify .env files, restart services.

---

**Happy Testing! 🎉**

