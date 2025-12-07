# 📡 API Documentation - AI Market Pulse

Base URL: `http://localhost:5000`

## 🔐 Authentication

All endpoints (except auth & health) require JWT token in header:
```
Authorization: Bearer YOUR_JWT_TOKEN
```

---

## 🔑 Auth Endpoints

### POST `/api/auth/register`
Register new user account

**Request Body**:
```json
{
  "email": "user@example.com",
  "password": "securepassword123",
  "name": "John Doe" // optional
}
```

**Response** (201):
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid-here",
      "email": "user@example.com"
    },
    "access_token": "jwt.token.here"
  }
}
```

---

### POST `/api/auth/login`
Login existing user

**Request Body**:
```json
{
  "email": "user@example.com",
  "password": "securepassword123"
}
```

**Response** (200):
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid-here",
      "email": "user@example.com"
    },
    "access_token": "jwt.token.here"
  }
}
```

---

## 📦 Product Endpoints

### GET `/api/products`
Get all products for authenticated user

**Query Params**:
- `user_id` (optional): Filter by user

**Response** (200):
```json
{
  "success": true,
  "data": [
    {
      "id": "prod-uuid-1",
      "name": "Nasi Goreng",
      "unit": "porsi",
      "price": "15000",
      "is_active": true,
      "created_at": "2024-12-01T10:00:00Z"
    }
  ]
}
```

---

### POST `/api/products`
Create new product

**Request Body**:
```json
{
  "user_id": "user-uuid",
  "name": "Nasi Goreng",
  "unit": "porsi",
  "price": 15000 // optional
}
```

**Response** (201):
```json
{
  "success": true,
  "data": {
    "id": "prod-uuid",
    "name": "Nasi Goreng",
    "unit": "porsi",
    "price": "15000",
    "is_active": true,
    "created_at": "2024-12-01T10:00:00Z"
  }
}
```

**Error** (400):
```json
{
  "error": "Produk dengan nama ini sudah ada"
}
```

---

## 🛒 Sales Endpoints

### POST `/api/sales`
Create sales entry with automatic AI analysis

**Request Body**:
```json
{
  "product_id": "prod-uuid",
  "product_name": "Nasi Goreng",
  "quantity": 25,
  "sale_date": "2024-12-05"
}
```

**Response** (201):
```json
{
  "success": true,
  "message": "Sales data saved successfully",
  "data": {
    "product_id": "prod-uuid",
    "product_name": "Nasi Goreng",
    "sale_date": "2024-12-05",
    "quantity": 25
  },
  "ai_analysis": {
    "momentum": {
      "combined": 1.15,
      "status": "TRENDING_UP"
    },
    "burst": {
      "score": 2.3,
      "severity": "HIGH"
    },
    "forecast_summary": "Prediksi ML universal (45 hari data)",
    "recommendations": [
      {
        "type": "STOCK_INCREASE",
        "priority": "HIGH",
        "message": "Nasi Goreng tren naik. Tambah stok 20-30%.",
        "actionable": true,
        "action": "Tingkatkan stok Nasi Goreng",
        "details": ["Momentum: TRENDING_UP", "Avg: 28.5 unit/hari"]
      }
    ],
    "confidence": "HIGH"
  }
}
```

---

### GET `/api/sales`
Get sales data with filters

**Query Params**:
- `product_id` (optional): Filter by product
- `start_date` (optional): Start date (YYYY-MM-DD)
- `end_date` (optional): End date (YYYY-MM-DD)
- `limit` (optional): Max results (default: 100)

**Response** (200):
```json
{
  "success": true,
  "count": 45,
  "data": [
    {
      "id": "sale-uuid",
      "product_id": "prod-uuid",
      "sale_date": "2024-12-05",
      "quantity": "25",
      "revenue": "375000",
      "products": {
        "name": "Nasi Goreng",
        "unit": "porsi",
        "price": "15000"
      },
      "created_at": "2024-12-05T10:00:00Z"
    }
  ]
}
```

---

## 📊 Analytics Endpoints

### GET `/api/analytics/summary` ⭐ NEW
Get dashboard summary (today vs yesterday)

**Response** (200):
```json
{
  "success": true,
  "summary": {
    "today": {
      "total_quantity": 130,
      "total_revenue": 1500000,
      "sales_count": 5
    },
    "changes": {
      "quantity_change": 15.5,
      "revenue_change": 12.3
    },
    "burst_alerts": [
      {
        "product_id": "prod-uuid-1",
        "product_name": "Nasi Goreng",
        "burst_score": 3.2,
        "burst_level": "CRITICAL"
      }
    ],
    "top_products": [
      {
        "product_id": "prod-uuid-1",
        "product_name": "Nasi Goreng",
        "quantity": 80
      },
      {
        "product_id": "prod-uuid-2",
        "product_name": "Es Teh Manis",
        "quantity": 42
      }
    ]
  }
}
```

---

### GET `/api/analytics/ranking` ⭐ NEW
Get product ranking based on AI priority scores

**Query Params**:
- `limit` (optional): Max products (default: 50)

**Response** (200):
```json
{
  "success": true,
  "rankings": [
    {
      "productId": "prod-uuid-1",
      "productName": "Nasi Goreng",
      "unit": "porsi",
      "priorityScore": 0.85,
      "momentum": {
        "combined": 1.15,
        "status": "TRENDING_UP"
      },
      "burst": {
        "score": 2.5,
        "level": "HIGH"
      },
      "avgQuantity": 28.5,
      "forecast": [
        {
          "date": "2024-12-06",
          "predicted_quantity": 30.2,
          "confidence": "HIGH"
        }
      ],
      "confidence": "HIGH"
    }
  ],
  "total": 5,
  "generatedAt": "2024-12-05T10:00:00Z"
}
```

---

### GET `/api/analytics/products/:productId/forecast`
Get ML forecast for specific product

**Path Params**:
- `productId`: Product UUID

**Query Params**:
- `days` (optional): Forecast days (default: 7)

**Response** (200):
```json
{
  "success": true,
  "product": {
    "id": "prod-uuid",
    "name": "Nasi Goreng",
    "unit": "porsi",
    "price": "15000"
  },
  "productId": "prod-uuid",
  "productName": "Nasi Goreng",
  "realtime": {
    "momentum": {
      "combined": 1.15,
      "status": "TRENDING_UP"
    },
    "burst": {
      "score": 2.3,
      "severity": "HIGH"
    },
    "classification": "SPIKE",
    "lastUpdated": "2024-12-05T10:00:00Z"
  },
  "forecast": {
    "method": "hybrid-ml (universal)",
    "predictions": [
      {
        "date": "2024-12-06",
        "predicted_quantity": 30.5,
        "confidence": "HIGH",
        "lower_bound": 25.2,
        "upper_bound": 35.8
      }
    ],
    "trend": "INCREASING",
    "totalForecast7d": 210,
    "summary": "Prediksi ML universal (45 hari data)"
  },
  "recommendations": [
    {
      "type": "STOCK_INCREASE",
      "priority": "HIGH",
      "message": "Nasi Goreng tren naik. Tambah stok 20-30%.",
      "actionable": true,
      "action": "Tingkatkan stok Nasi Goreng",
      "details": ["Momentum: TRENDING_UP", "Avg: 28.5 unit/hari"]
    }
  ],
  "confidence": {
    "overall": "HIGH",
    "dataQuality": 0.75,
    "modelAgreement": 0.88
  }
}
```

---

### GET `/api/analytics/trending`
Get trending products (burst alerts)

**Response** (200):
```json
{
  "success": true,
  "trending": [
    {
      "productId": "prod-uuid",
      "productName": "Nasi Goreng",
      "burstScore": 3.2,
      "severity": "CRITICAL",
      "lastUpdated": "2024-12-05T10:00:00Z"
    }
  ],
  "count": 1,
  "generatedAt": "2024-12-05T10:00:00Z"
}
```

---

## 📈 Report Endpoints

### GET `/api/reports/weekly`
Get weekly report with analytics

**Response** (200):
```json
{
  "success": true,
  "data": {
    "dateRange": {
      "start": "2024-11-28",
      "end": "2024-12-05"
    },
    "summary": {
      "totalQuantity": 850,
      "totalRevenue": 12750000
    },
    "topPerformers": [
      {
        "id": "prod-uuid-1",
        "name": "Nasi Goreng",
        "quantity": 195
      },
      {
        "id": "prod-uuid-2",
        "name": "Ayam Bakar",
        "quantity": 140
      }
    ],
    "attentionNeeded": [
      {
        "name": "Pisang Goreng",
        "date": "2024-12-04",
        "status": "DECLINING",
        "detail": "Tren penjualan menurun tajam"
      }
    ]
  }
}
```

---

## 🧠 Intelligence Endpoints

### GET `/api/intelligence/analyze/:productId`
Get full AI analysis for product

**Path Params**:
- `productId`: Product UUID

**Response** (200):
Same as `/api/analytics/products/:productId/forecast`

---

## 🤖 Python ML Service Endpoints

Base URL: `http://localhost:8000`

### GET `/`
Health check for ML service

**Response** (200):
```json
{
  "message": "AI Market Pulse ML Service",
  "status": "running",
  "version": "v6.0"
}
```

---

### POST `/api/ml/predict-universal`
Universal ML prediction (used by backend)

**Request Body**:
```json
{
  "sales_data": [
    { "date": "2024-12-01", "quantity": 25 },
    { "date": "2024-12-02", "quantity": 28 },
    { "date": "2024-12-03", "quantity": 26 }
  ],
  "forecast_days": 7
}
```

**Response** (200):
```json
{
  "success": true,
  "predictions": [
    {
      "date": "2024-12-04",
      "predicted_quantity": 27.8,
      "lower_bound": 22.5,
      "upper_bound": 33.1,
      "confidence": "HIGH",
      "day_of_week": 2,
      "is_weekend": false
    }
  ],
  "model_info": {
    "mode": "HYBRID_OPTIMIZED_v6",
    "val_mae": 0.0523,
    "baseline_mae": 0.4821,
    "improvement_pct": 89.15,
    "overfit_ratio": 1.32,
    "ensemble_weights": {
      "ml": 0.85,
      "rule": 0.15
    }
  },
  "metadata": {
    "data_points": 45,
    "features_used": 33,
    "training_mode": "ML_TRAINED",
    "confidence": "HIGH"
  }
}
```

**Error** (400):
```json
{
  "success": false,
  "error": "Insufficient data for prediction (min 5 days required)"
}
```

---

## 📊 Response Codes

| Code | Meaning | When |
|------|---------|------|
| 200 | OK | Successful GET request |
| 201 | Created | Successful POST (created resource) |
| 400 | Bad Request | Invalid input data |
| 401 | Unauthorized | Missing or invalid token |
| 404 | Not Found | Resource doesn't exist |
| 500 | Server Error | Internal server error |

---

## 🔄 Data Flow Examples

### Example 1: Complete User Journey

**Step 1**: Register
```bash
POST /api/auth/register
→ Get access_token
→ Store in localStorage
```

**Step 2**: Add Product
```bash
POST /api/products
Body: { "name": "Nasi Goreng", "unit": "porsi" }
Headers: { "Authorization": "Bearer TOKEN" }
→ Product created with UUID
```

**Step 3**: Input Sales
```bash
POST /api/sales
Body: { 
  "product_id": "prod-uuid",
  "product_name": "Nasi Goreng",
  "quantity": 25,
  "sale_date": "2024-12-05"
}
→ Sales saved
→ AI analysis triggered automatically
→ Returns momentum, burst, recommendations
```

**Step 4**: View Dashboard
```bash
GET /api/analytics/summary
→ Returns today's metrics
→ Burst alerts if any
→ Top products
```

**Step 5**: Product Detail
```bash
GET /api/intelligence/analyze/prod-uuid
→ Calls Python ML service
→ Returns 7-day forecast
→ Returns recommendations
```

---

### Example 2: Burst Detection Flow

**Scenario**: User inputs sales yang tinggi abnormal

**Input**:
```bash
POST /api/sales
Body: { "product_id": "prod-uuid", "quantity": 80, "sale_date": "2024-12-05" }
```

**Backend Process**:
1. Save sales to database ✅
2. Fetch 60-day history ✅
3. Calculate momentum (EMA-based) ✅
4. Detect burst (z-score > 3) ✅
5. Call ML for predictions ✅
6. Generate recommendations ✅
7. Save to daily_analytics ✅

**Response**:
```json
{
  "success": true,
  "ai_analysis": {
    "burst": {
      "score": 3.2,
      "severity": "CRITICAL"
    },
    "recommendations": [
      {
        "type": "BURST_ALERT",
        "priority": "URGENT",
        "message": "Lonjakan signifikan: Nasi Goreng!",
        "action": "Siapkan stok tambahan"
      }
    ]
  }
}
```

**Frontend Display**:
- 🚨 Red alert card di dashboard
- Badge: "CRITICAL"
- Button: "Lihat Analisa"

---

## 🎯 Best Practices

### Frontend API Calls

**Use the helper**:
```typescript
import { fetchWithAuth } from '@/lib/api';

// Example
const response = await fetchWithAuth('http://localhost:5000/api/products');
const data = await response.json();
```

**Or use api object**:
```typescript
import api from '@/lib/api';

// Example
const response = await api.getProducts();
const data = await response.json();
```

### Error Handling
```typescript
try {
  const res = await fetchWithAuth(url);
  const data = await res.json();
  
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Request failed');
  }
  
  // Success handling
  setData(data.data);
  
} catch (error) {
  console.error(error);
  setError(error.message);
}
```

### Loading States
```typescript
const [loading, setLoading] = useState(false);

const fetchData = async () => {
  setLoading(true);
  try {
    // ... API call
  } finally {
    setLoading(false);
  }
};
```

---

## 🔍 Debugging API Calls

### Browser DevTools
```javascript
// Network tab
// Filter by: XHR/Fetch
// Check: Request headers, Response body, Status code

// Console
fetch('http://localhost:5000/health')
  .then(r => r.json())
  .then(console.log);
```

### Backend Logs
Check terminal running backend untuk request logs:
```
POST /api/sales 201 in 245ms
GET /api/analytics/summary 200 in 82ms
```

### Python ML Logs
Check terminal running Python untuk ML operations:
```
INFO:models.xgboost_optimal:Training HybridBrain for product: prod-uuid
INFO:models.xgboost_optimal:Using 33 features for 452 samples
INFO:models.xgboost_optimal:Model Val MAE: 0.0142, Baseline MAE: 0.7283
INFO:models.xgboost_optimal:Improvement over baseline: 98.0%
```

---

## 🧪 Testing with Postman/Thunder Client

### Collection Structure

**1. Auth**
- Register User
- Login User

**2. Products**
- Create Product
- Get All Products

**3. Sales**
- Create Sales Entry
- Get Sales History

**4. Analytics**
- Get Dashboard Summary
- Get Product Ranking
- Get Product Forecast
- Get Trending Products

**5. Reports**
- Get Weekly Report

**6. Health**
- Backend Health Check
- ML Service Health Check

### Environment Variables
```
BASE_URL = http://localhost:5000
ML_URL = http://localhost:8000
TOKEN = {{auth_token}}
USER_ID = {{user_id}}
PRODUCT_ID = {{product_id}}
```

---

## 📝 Rate Limiting (Future)

Currently no rate limiting, recommended for production:
- Auth endpoints: 5 requests/min
- Read endpoints: 100 requests/min
- Write endpoints: 30 requests/min
- ML endpoints: 10 requests/min

---

## 🔐 Security Notes

### Current Implementation
- ✅ JWT authentication
- ✅ User ownership validation
- ✅ SQL injection prevention (Prisma)
- ✅ CORS configured
- ✅ Input validation

### Production Recommendations
- [ ] HTTPS only
- [ ] Rate limiting
- [ ] Request size limits
- [ ] API key for ML service
- [ ] Audit logging
- [ ] IP whitelisting (optional)

---

## 📚 Related Documentation

- `README.md` - Setup & overview
- `TESTING_GUIDE.md` - Testing scenarios
- `IMPLEMENTATION_SUMMARY.md` - Technical details
- `START_ALL.md` - Quick start guide

---

**API Version**: v1.0.0
**Last Updated**: December 2025
**Status**: ✅ Production Ready

