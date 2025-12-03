"""
FastAPI server for AI Market Pulse ML Service
Serves predictions from trained models
"""

from datetime import datetime
import logging
import glob
import json
import os
import sys
from typing import Dict, List, Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Ensure local imports resolve when running as a script
BASE_DIR = os.path.abspath(os.path.dirname(__file__))
if BASE_DIR not in sys.path:
    sys.path.append(BASE_DIR)

from models.xgboost_optimal import forecaster, HybridBrain  # noqa: E402
from models.ensemble import EnsemblePredictor  # noqa: E402

logger = logging.getLogger(__name__)

app = FastAPI(title="AI Market Pulse ML Service")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize ensemble predictor
ensemble = EnsemblePredictor()


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


@app.get("/")
def root():
    return {
        "service": "AI Market Pulse ML Service",
        "status": "running",
        "version": "1.0.0"
    }


@app.get("/api/ml/models")
def list_models():
    """List all trained models"""
    try:
        model_paths: List[str] = []

        training_models = glob.glob(os.path.join(BASE_DIR, "training", "models_output", "xgboost_*.pkl"))
        model_paths.extend(training_models)

        prod_models = glob.glob(os.path.join(BASE_DIR, "models", "xgboost_*.pkl"))
        model_paths.extend(prod_models)

        models = []
        for path in model_paths:
            filename = os.path.basename(path)
            product_id = filename.replace('xgboost_', '').replace('.pkl', '')

            metadata_path = path.replace('.pkl', '_metadata.json')
            metadata = {}
            if os.path.exists(metadata_path):
                with open(metadata_path, 'r', encoding='utf-8') as f:
                    metadata = json.load(f)

            models.append({
                'product_id': product_id,
                'model_path': path,
                'trained_at': metadata.get('generated_at', 'unknown'),
                'metrics': metadata.get('physics_metrics', {})
            })

        return {
            'success': True,
            'models': models,
            'total': len(models)
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/ml/forecast")
def get_forecast(productId: str, days: int = 7):
    """Get ML forecast for product"""
    try:
        model_candidates = [
            os.path.join(BASE_DIR, "training", "models_output", f"xgboost_{productId}.pkl"),
            os.path.join(BASE_DIR, "models", f"xgboost_{productId}.pkl"),
        ]

        model_path: Optional[str] = None
        for path in model_candidates:
            if os.path.exists(path):
                model_path = path
                logger.info(f"Found model for {productId}: {path}")
                break

        if not model_path:
            logger.error(f"Model not found for product: {productId}. Searched: {model_candidates}")
            raise HTTPException(status_code=404, detail=f"Model not found for product: {productId}")

        product_forecaster = HybridBrain(product_id=productId)
        success = product_forecaster.load_model(productId, model_path)
        if not success:
            logger.error(f"Failed to load model for product: {productId} from {model_path}")
            raise HTTPException(status_code=500, detail=f"Failed to load model for product: {productId}")

        logger.info(f"Loaded model for {productId} from {model_path}")
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
        logger.error(f"Forecast error for {productId}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


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
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/ml/forecast-hybrid")
def hybrid_forecast(request: HybridForecastRequest):
    """Ensemble forecast with realtime data"""
    try:
        result = ensemble.predict(
            product_id=request.product_id,
            realtime_data=request.realtime_data,
            days=request.days
        )
        if not result.get('success'):
            raise HTTPException(status_code=404, detail=result.get('error', 'Hybrid forecast failed'))
        return result

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
