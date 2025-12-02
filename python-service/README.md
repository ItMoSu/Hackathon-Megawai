# AI Market Pulse - ML Service

Python microservice for demand forecasting using XGBoost.

## Features

- **Quantile Regression**: P10, P50, P90 predictions
- **Early Stopping**: Prevents overfitting
- **Validation Metrics**: Train/val split for accuracy measurement
- **Model Persistence**: Save/load trained models with metadata
- **Batch Training**: Offline training for all products

## Setup
```bash
pip install -r requirements.txt
```

## Running
```bash
# Start service
uvicorn main:app --reload --port 8000

# Batch training (all products)
python scripts/train_all.py
```

## API Endpoints

- `POST /api/ml/train` - Train model for one product
- `GET /api/ml/forecast?productId=X&days=7` - Get forecast
- `POST /api/ml/forecast-hybrid` - Hybrid forecast (rule + ML)
- `GET /api/ml/models` - List all trained models
- `GET /api/ml/model-info/{productId}` - Get model metadata

## Model Storage

- Models: `models/xgboost_{productId}.pkl`
- Metadata: `models/xgboost_{productId}_metadata.json`

## Training Process

1. **Feature Engineering**: 12 features (time + lag + rolling)
2. **Train/Val Split**: 80/20 (no shuffle for time series)
3. **Early Stopping**: Auto-stop at optimal iteration
4. **Quantile Models**: 3 models (P10, P50, P90)
5. **Validation**: MAE/RMSE on held-out data

## Offline Training

For production, run batch training nightly:
```bash
# Run manually
python scripts/train_all.py

# Or setup cron (2 AM daily)
0 2 * * * cd /path/to/python-service && python scripts/train_all.py >> logs/cron.log 2>&1
```
