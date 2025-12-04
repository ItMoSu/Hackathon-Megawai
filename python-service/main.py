"""
FastAPI server for AI Market Pulse ML Service
Serves predictions from trained models
"""

from datetime import datetime, timedelta
import logging
import glob
import json
import os
import sys
from typing import Dict, List, Optional

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import pandas as pd  # ✅ ADD THIS
import numpy as np   # ✅ ADD THIS

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Ensure local imports resolve when running as a script
BASE_DIR = os.path.abspath(os.path.dirname(__file__))
if BASE_DIR not in sys.path:
    sys.path.append(BASE_DIR)

from models.xgboost_optimal import forecaster, HybridBrain  # noqa: E402
from models.ensemble import EnsemblePredictor  # noqa: E402
from models.inventory_optimizer import InventoryOptimizer  # noqa: E402
from models.profit_analyzer import ProfitAnalyzer  # noqa: E402
from models.weekly_report_ranker import WeeklyReportRanker, RankingStrategy  # noqa: E402

app = FastAPI(title="AI Market Pulse ML Service")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize components
ensemble = EnsemblePredictor()
report_ranker = WeeklyReportRanker(default_strategy="balanced")


def get_all_product_ids_from_models() -> List[str]:
    """Get all product IDs from available models"""
    product_ids: List[str] = []

    training_dir = os.path.join(BASE_DIR, "training", "models_output")
    logger.info(f"Scanning training dir: {training_dir}")
    
    if os.path.exists(training_dir):
        try:
            for file in os.listdir(training_dir):
                if file.startswith("xgboost_") and file.endswith(".pkl"):
                    pid = file.replace("xgboost_", "").replace(".pkl", "")
                    if pid not in product_ids:
                        product_ids.append(pid)
        except Exception as e:
            logger.error(f"Error scanning training dir: {e}")

    models_dir = os.path.join(BASE_DIR, "models")
    if os.path.exists(models_dir):
        try:
            for file in os.listdir(models_dir):
                if file.startswith("xgboost_") and file.endswith(".pkl"):
                    pid = file.replace("xgboost_", "").replace(".pkl", "")
                    if pid not in product_ids:
                        product_ids.append(pid)
        except Exception as e:
            logger.error(f"Error scanning models dir: {e}")

    artifacts_dir = os.path.join(BASE_DIR, "models", "artifacts")
    if os.path.exists(artifacts_dir):
        try:
            for file in os.listdir(artifacts_dir):
                if file.startswith("xgboost_") and file.endswith(".pkl"):
                    pid = file.replace("xgboost_", "").replace(".pkl", "")
                    if pid not in product_ids:
                        product_ids.append(pid)
        except Exception as e:
            logger.error(f"Error scanning artifacts dir: {e}")

    logger.info(f"Found {len(product_ids)} product IDs")
    return product_ids


# Pydantic models
class TrainRequest(BaseModel):
    product_id: str
    sales_data: List[Dict]


class ForecastRequest(BaseModel):
    product_id: str
    days: int = 7


class HybridForecastRequest(BaseModel):
    product_id: str
    realtime_data: Dict
    days: int = 7


# ✅ ADD NEW PYDANTIC MODELS
class SalesDataPoint(BaseModel):
    date: str
    quantity: float


class UniversalPredictRequest(BaseModel):
    sales_data: List[SalesDataPoint]
    forecast_days: int = 7


@app.get("/")
def root():
    return {
        "service": "AI Market Pulse ML Service",
        "status": "running",
        "version": "1.0.0",
        "base_dir": BASE_DIR
    }


@app.get("/api/ml/debug")
def debug_paths():
    """Debug endpoint to check paths"""
    training_dir = os.path.join(BASE_DIR, "training", "models_output")
    
    files = []
    if os.path.exists(training_dir):
        try:
            files = [f for f in os.listdir(training_dir) if f.endswith('.pkl')]
        except Exception as e:
            files = [f"Error: {e}"]
    
    product_ids = get_all_product_ids_from_models()
    
    return {
        "BASE_DIR": BASE_DIR,
        "training_dir": training_dir,
        "dir_exists": os.path.exists(training_dir),
        "files_count": len(files),
        "sample_files": files[:5],
        "product_ids_count": len(product_ids),
        "sample_product_ids": product_ids[:5]
    }


@app.get("/api/ml/models")
def list_models():
    """List all trained models"""
    try:
        models = []
        product_ids = get_all_product_ids_from_models()
        
        logger.info(f"Processing {len(product_ids)} product IDs")
        
        for product_id in product_ids:
            model_path = None
            for candidate in [
                os.path.join(BASE_DIR, "training", "models_output", f"xgboost_{product_id}.pkl"),
                os.path.join(BASE_DIR, "models", f"xgboost_{product_id}.pkl"),
                os.path.join(BASE_DIR, "models", "artifacts", f"xgboost_{product_id}.pkl")
            ]:
                if os.path.exists(candidate):
                    model_path = candidate
                    break
            
            if not model_path:
                continue
            
            metadata_path = model_path.replace('.pkl', '_metadata.json')
            metadata = {}
            if os.path.exists(metadata_path):
                try:
                    with open(metadata_path, 'r', encoding='utf-8') as f:
                        metadata = json.load(f)
                except Exception as e:
                    logger.warning(f"Failed to load metadata for {product_id}: {e}")
            
            models.append({
                'product_id': product_id,
                'model_path': model_path,
                'trained_at': metadata.get('generated_at', 'unknown'),
                'metrics': metadata.get('physics_metrics', {})
            })

        logger.info(f"Returning {len(models)} models")
        
        return {
            'success': True,
            'models': models,
            'total': len(models)
        }

    except Exception as e:
        logger.error(f"list_models error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/ml/forecast")
def get_forecast(productId: str, days: int = 7):
    """Get ML forecast for product"""
    try:
        logger.info(f"Forecast request for: {productId}, days: {days}")
        
        model_candidates = [
            os.path.join(BASE_DIR, "training", "models_output", f"xgboost_{productId}.pkl"),
            os.path.join(BASE_DIR, "models", f"xgboost_{productId}.pkl"),
            os.path.join(BASE_DIR, "models", "artifacts", f"xgboost_{productId}.pkl"),
        ]

        model_path: Optional[str] = None
        for path in model_candidates:
            logger.info(f"Checking: {path} - Exists: {os.path.exists(path)}")
            if os.path.exists(path):
                model_path = path
                logger.info(f"Found model for {productId}: {path}")
                break

        if not model_path:
            logger.error(f"Model not found for product: {productId}")
            raise HTTPException(status_code=404, detail=f"Model not found for product: {productId}")

        product_forecaster = HybridBrain(product_id=productId)
        success = product_forecaster.load_model(productId, model_path)
        if not success:
            logger.error(f"Failed to load model for product: {productId} from {model_path}")
            raise HTTPException(status_code=500, detail=f"Failed to load model for product: {productId}")

        logger.info(f"Loaded model for {productId}, generating predictions...")
        predictions = product_forecaster.predict_next_days(days)
        first_pred = predictions[0].get('predicted_quantity') if predictions else None
        last_pred = predictions[-1].get('predicted_quantity') if predictions else None

        return {
            'success': True,
            'productId': productId,
            'model_loaded': model_path,
            'predictions': predictions,
            'data_quality_days': 60,
            'debug': {
                'first_pred': first_pred,
                'last_pred': last_pred,
                'avg_pred': float(sum(p.get('predicted_quantity', 0) for p in predictions) / len(predictions)) if predictions else None,
                'model_mae': product_forecaster.mae,
                'model_std_error': product_forecaster.std_error,
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Forecast error for {productId}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/ml/predict-universal")
def predict_universal(request: UniversalPredictRequest):
    """
    ✅ Universal prediction endpoint - works with ANY product
    Uses statistical methods for products without trained models
    """
    try:
        logger.info(f"Universal predict request: {len(request.sales_data)} data points, {request.forecast_days} days")
        
        # Validate minimum data
        if len(request.sales_data) < 5:
            return {
                "success": False,
                "message": "Insufficient data: need at least 5 data points"
            }
        
        # Convert to arrays
        dates = []
        quantities = []
        
        for item in request.sales_data:
            dates.append(item.date)
            quantities.append(float(item.quantity))
        
        # Sort by date
        sorted_pairs = sorted(zip(dates, quantities), key=lambda x: x[0])
        dates, quantities = zip(*sorted_pairs)
        quantities = list(quantities)
        
        logger.info(f"Processed {len(quantities)} data points")
        
        # Calculate simple statistics
        mean_qty = sum(quantities) / len(quantities)
        
        # Calculate trend (simple linear regression)
        n = len(quantities)
        x = list(range(n))
        x_mean = sum(x) / n
        y_mean = mean_qty
        
        numerator = sum((x[i] - x_mean) * (quantities[i] - y_mean) for i in range(n))
        denominator = sum((x[i] - x_mean) ** 2 for i in range(n))
        
        if denominator != 0:
            slope = numerator / denominator
            intercept = y_mean - slope * x_mean
        else:
            slope = 0
            intercept = mean_qty
        
        # Calculate MAE for confidence
        predictions_train = [slope * i + intercept for i in x]
        mae = sum(abs(quantities[i] - predictions_train[i]) for i in range(n)) / n
        
        # Determine confidence
        relative_error = mae / mean_qty if mean_qty > 0 else 1.0
        
        if relative_error < 0.15 and len(quantities) >= 60:
            confidence_level = "HIGH"
        elif relative_error < 0.30 and len(quantities) >= 30:
            confidence_level = "MEDIUM"
        else:
            confidence_level = "LOW"
        
        # Generate forecasts
        forecast_results = []
        last_date_str = dates[-1]
        
        try:
            from datetime import datetime, timedelta
            last_date = datetime.strptime(last_date_str, '%Y-%m-%d')
        except:
            last_date = datetime.now()
        
        for i in range(1, request.forecast_days + 1):
            # Linear projection with slight randomness for realism
            base_pred = slope * (n + i - 1) + intercept
            
            # Ensure non-negative
            base_pred = max(0, base_pred)
            
            # Add some variance based on historical data
            variance = np.std(quantities) if len(quantities) > 1 else 0
            lower = max(0, base_pred - variance)
            upper = base_pred + variance
            
            forecast_date = last_date + timedelta(days=i)
            
            forecast_results.append({
                "date": forecast_date.strftime('%Y-%m-%d'),
                "predicted_quantity": round(float(base_pred), 2),
                "confidence": confidence_level,
                "lower_bound": round(float(lower), 2),
                "upper_bound": round(float(upper), 2)
            })
        
        logger.info(f"Successfully generated {len(forecast_results)} predictions")
        
        return {
            "success": True,
            "method": "universal-statistical",
            "predictions": forecast_results,
            "data_quality_days": len(quantities),
            "debug": {
                "mean": round(mean_qty, 2),
                "trend_slope": round(slope, 4),
                "mae": round(mae, 2),
                "relative_error": round(relative_error, 2),
                "confidence_level": confidence_level,
                "data_points": len(quantities),
                "avg_pred": round(float(np.mean([p['predicted_quantity'] for p in forecast_results])), 2)
            }
        }
        
    except Exception as e:
        logger.error(f"Universal predict error: {str(e)}", exc_info=True)
        return {
            "success": False,
            "message": f"Prediction failed: {str(e)}"
        }


@app.post("/api/ml/train")
def train_model(request: TrainRequest):
    """Train new model"""
    try:
        result = forecaster.train(request.sales_data, request.product_id)

        os.makedirs(os.path.join(BASE_DIR, 'models'), exist_ok=True)
        model_path = os.path.join(BASE_DIR, "models", f"xgboost_{request.product_id}.pkl")
        forecaster.save_model(request.product_id, model_path)

        return {
            'success': True,
            'trained': True,
            'model': result
        }

    except Exception as e:
        logger.error(f"Training error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# ... rest of the file stays the same (forecast-hybrid, inventory, profit, weekly report)
# Keep all remaining endpoints as they are


if __name__ == "__main__":
    import uvicorn
    logger.info(f"Starting server with BASE_DIR: {BASE_DIR}")
    uvicorn.run(app, host="0.0.0.0", port=8000)