"""
FastAPI server for AI Market Pulse ML Service
Serves predictions from trained models
"""

from datetime import datetime, timedelta
import logging
import glob
import json
import os
import re
import sys
from typing import Dict, List, Optional

from fastapi import FastAPI, HTTPException, Request, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, validator

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


def sanitize_product_id(product_id: str) -> str:
    """
    Sanitize product ID to prevent path traversal attacks
    Only allows alphanumeric, underscore, hyphen, and space
    """
    safe_id = re.sub(r'[^a-zA-Z0-9_\-\s]', '', product_id)
    if not safe_id or len(safe_id) > 100:
        raise HTTPException(status_code=400, detail="Invalid product_id format")
    return safe_id


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

    @validator('days')
    def validate_days(cls, v):
        if v < 1 or v > 30:
            raise ValueError('days must be between 1 and 30')
        return v


class HybridForecastRequest(BaseModel):
    product_id: str
    realtime_data: Dict
    days: int = 7

    @validator('days')
    def validate_days(cls, v):
        if v < 1 or v > 30:
            raise ValueError('days must be between 1 and 30')
        return v


class UniversalPredictRequest(BaseModel):
    """Request model for universal prediction endpoint"""
    sales_data: List[Dict]
    forecast_days: int = 7
    product_id: Optional[str] = None

    @validator('forecast_days')
    def validate_forecast_days(cls, v):
        if v < 1 or v > 30:
            raise ValueError('forecast_days must be between 1 and 30')
        return v

    @validator('sales_data')
    def validate_sales_data(cls, v):
        if not v or len(v) < 3:
            raise ValueError('sales_data must have at least 3 data points')
        return v


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
def get_forecast(productId: str, days: int = Query(7, ge=1, le=30)):
    """Get ML forecast for product"""
    try:
        # Sanitize product ID to prevent path traversal
        productId = sanitize_product_id(productId)
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
            available_models = get_all_product_ids_from_models()
            logger.error(f"Model not found for product: {productId}")
            raise HTTPException(
                status_code=404,
                detail={
                    "error": f"Model not found for product: {productId}",
                    "available_models": available_models[:10],
                    "total_models": len(available_models),
                    "suggestion": "Check product_id spelling or train a model first"
                }
            )

        product_forecaster = HybridBrain(product_id=productId)
        success = product_forecaster.load_model(productId, model_path)
        if not success:
            logger.error(f"Failed to load model for product: {productId} from {model_path}")
            raise HTTPException(
                status_code=500,
                detail=f"Model file found but failed to load. It may be corrupted. Try retraining the model."
            )

        logger.info(f"Loaded model for {productId}, generating predictions...")
        predictions = product_forecaster.predict_next_days(days)

        # Safety check for empty predictions
        if not predictions or len(predictions) == 0:
            logger.error(f"Model returned empty predictions for {productId}")
            raise HTTPException(
                status_code=500,
                detail={
                    'error': 'Model failed to generate predictions',
                    'productId': productId,
                    'suggestion': 'Model may need retraining with more data'
                }
            )

        first_pred = predictions[0].get('predicted_quantity', 0)
        last_pred = predictions[-1].get('predicted_quantity', 0)

        return {
            'success': True,
            'productId': productId,
            'model_loaded': model_path,
            'predictions': predictions,
            'data_quality_days': 60,
            'debug': {
                'first_pred': first_pred,
                'last_pred': last_pred,
                'avg_pred': float(sum(p.get('predicted_quantity', 0) for p in predictions) / len(predictions)),
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
    Universal prediction endpoint - works with any sales data without pre-trained model.
    Uses physics-based prediction with on-the-fly training.

    This is the main endpoint used by the backend for product analysis.
    """
    try:
        sales_data = request.sales_data
        forecast_days = request.forecast_days
        product_id = request.product_id or "universal"

        logger.info(f"Universal predict: {len(sales_data)} data points, {forecast_days} days forecast")

        # Validate and clean sales data
        if not sales_data:
            raise HTTPException(status_code=400, detail="sales_data cannot be empty")

        # Convert to DataFrame format expected by HybridBrain
        import pandas as pd
        try:
            df = pd.DataFrame(sales_data)
            if 'date' not in df.columns or 'quantity' not in df.columns:
                raise HTTPException(
                    status_code=400,
                    detail="sales_data must contain 'date' and 'quantity' fields"
                )

            # Ensure proper types
            df['date'] = pd.to_datetime(df['date'])
            df['quantity'] = pd.to_numeric(df['quantity'], errors='coerce').fillna(0)
            df = df.sort_values('date')

            # Remove duplicates, keep last
            df = df.drop_duplicates(subset=['date'], keep='last')

        except Exception as e:
            logger.error(f"Data parsing error: {e}")
            raise HTTPException(status_code=400, detail=f"Invalid sales_data format: {str(e)}")

        # Try to load existing model first if product_id is provided
        model_loaded = False
        brain = HybridBrain(product_id=product_id)

        if product_id and product_id != "universal":
            model_candidates = [
                os.path.join(BASE_DIR, "training", "models_output", f"xgboost_{product_id}.pkl"),
                os.path.join(BASE_DIR, "models", f"xgboost_{product_id}.pkl"),
                os.path.join(BASE_DIR, "models", "artifacts", f"xgboost_{product_id}.pkl"),
            ]

            for path in model_candidates:
                if os.path.exists(path):
                    if brain.load_model(product_id, path):
                        model_loaded = True
                        logger.info(f"Loaded existing model for {product_id}")
                        break

        # If no model loaded, train on-the-fly with the provided data
        if not model_loaded:
            logger.info(f"No model found, training on-the-fly with {len(df)} data points")

            # Prepare training data
            training_data = df.to_dict('records')
            for row in training_data:
                row['date'] = row['date'].strftime('%Y-%m-%d') if hasattr(row['date'], 'strftime') else str(row['date'])

            # Train the model
            try:
                brain.train(training_data, product_id)
            except Exception as train_err:
                logger.warning(f"Training failed: {train_err}, using physics-based fallback")
                # Continue anyway - brain will use physics-based predictions

        # Generate predictions
        predictions = brain.predict_next_days(forecast_days)

        if not predictions:
            # Fallback to simple physics-based prediction
            logger.warning("Model predictions empty, generating fallback")
            predictions = _generate_fallback_predictions(df, forecast_days)

        # Calculate confidence based on data quality
        data_quality = min(1.0, len(df) / 30)  # Max confidence at 30 days of data

        # Detect momentum from data
        momentum = _calculate_momentum(df)

        # Detect burst
        burst = _detect_burst(df)

        return {
            'success': True,
            'product_id': product_id,
            'model_type': 'trained' if model_loaded else 'on-the-fly',
            'predictions': predictions,
            'data_points': len(df),
            'data_quality': round(data_quality, 2),
            'momentum': momentum,
            'burst': burst,
            'generated_at': datetime.now().isoformat()
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Universal predict error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


def _generate_fallback_predictions(df, days: int) -> List[Dict]:
    """Generate simple physics-based predictions when model fails"""
    import pandas as pd

    if df.empty:
        return []

    # Calculate baseline from recent data
    recent = df.tail(14)
    baseline = recent['quantity'].mean() if len(recent) > 0 else 0
    std = recent['quantity'].std() if len(recent) > 1 else baseline * 0.1

    predictions = []
    last_date = df['date'].max()

    for i in range(1, days + 1):
        pred_date = last_date + timedelta(days=i)
        day_of_week = pred_date.weekday()

        # Weekend factor
        weekend_factor = 1.2 if day_of_week in [5, 6] else 1.0

        # Day of month factor (payday effect)
        day_of_month = pred_date.day
        payday_factor = 1.15 if (day_of_month >= 25 or day_of_month <= 5) else 1.0

        predicted = max(0, baseline * weekend_factor * payday_factor)
        lower = max(0, predicted - std)
        upper = predicted + std

        predictions.append({
            'date': pred_date.strftime('%Y-%m-%d'),
            'predicted_quantity': round(predicted, 2),
            'lower_bound': round(lower, 2),
            'upper_bound': round(upper, 2),
            'confidence': 'LOW'
        })

    return predictions


def _calculate_momentum(df) -> Dict:
    """Calculate momentum from sales data"""
    if len(df) < 7:
        return {'combined': 1.0, 'status': 'STABLE'}

    recent_7 = df.tail(7)['quantity'].mean()
    previous_7 = df.tail(14).head(7)['quantity'].mean() if len(df) >= 14 else recent_7

    ratio = recent_7 / previous_7 if previous_7 > 0 else 1.0

    if ratio > 1.15:
        status = 'TRENDING_UP'
    elif ratio > 1.05:
        status = 'GROWING'
    elif ratio < 0.85:
        status = 'DECLINING'
    elif ratio < 0.95:
        status = 'FALLING'
    else:
        status = 'STABLE'

    return {
        'combined': round(ratio, 3),
        'status': status
    }


def _detect_burst(df) -> Dict:
    """Detect burst/anomaly in sales data"""
    if len(df) < 5:
        return {'score': 0, 'level': 'NORMAL', 'type': 'NORMAL'}

    quantities = df['quantity'].values
    baseline = quantities[:-1]
    latest = quantities[-1]

    mean = baseline.mean() if len(baseline) > 0 else 0
    std = baseline.std() if len(baseline) > 1 else 1
    std = max(std, 0.1)  # Prevent division by zero

    z_score = (latest - mean) / std

    if z_score > 3:
        level = 'CRITICAL'
    elif z_score > 2:
        level = 'HIGH'
    elif z_score > 1.5:
        level = 'MEDIUM'
    else:
        level = 'NORMAL'

    # Determine type
    burst_type = 'NORMAL'
    if level != 'NORMAL':
        last_date = df['date'].max()
        if hasattr(last_date, 'weekday'):
            day = last_date.weekday()
            burst_type = 'SEASONAL' if day in [5, 6] else 'SPIKE'

    return {
        'score': round(float(z_score), 2),
        'level': level,
        'type': burst_type
    }


@app.post("/api/ml/train")
def train_model(request: TrainRequest):
    """Train new model"""
    try:
        # Sanitize product ID
        request.product_id = sanitize_product_id(request.product_id)

        # Validate sales_data is not empty
        if not request.sales_data or len(request.sales_data) == 0:
            raise HTTPException(
                status_code=400,
                detail="sales_data cannot be empty"
            )

        # Validate minimum data size
        if len(request.sales_data) < 7:
            raise HTTPException(
                status_code=400,
                detail=f"Insufficient data: {len(request.sales_data)} rows (minimum 7 required for training)"
            )

        # Validate data structure (check first 3 rows for performance)
        for i, row in enumerate(request.sales_data[:3]):
            if not isinstance(row, dict):
                raise HTTPException(
                    status_code=400,
                    detail=f"Row {i} must be a dictionary"
                )
            if 'date' not in row or 'quantity' not in row:
                raise HTTPException(
                    status_code=400,
                    detail=f"Row {i} missing required fields ('date', 'quantity')"
                )

        result = forecaster.train(request.sales_data, request.product_id)

        os.makedirs(os.path.join(BASE_DIR, 'models'), exist_ok=True)
        model_path = os.path.join(BASE_DIR, "models", f"xgboost_{request.product_id}.pkl")
        forecaster.save_model(request.product_id, model_path)

        return {
            'success': True,
            'trained': True,
            'model': result
        }

    except HTTPException:
        raise
    except ValueError as e:
        # Training validation errors
        logger.error(f"Training validation error: {e}", exc_info=True)
        raise HTTPException(status_code=400, detail=f"Invalid data: {str(e)}")
    except Exception as e:
        logger.error(f"Training error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Training failed: {str(e)}")


@app.post("/api/ml/forecast-hybrid")
def hybrid_forecast(request: HybridForecastRequest):
    """Ensemble forecast with realtime data"""
    try:
        # Sanitize product ID
        request.product_id = sanitize_product_id(request.product_id)

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
        logger.error(f"Hybrid forecast error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/ml/inventory/optimize")
def optimize_inventory(request: dict):
    """
    Inventory optimization endpoint
    v2.0: Supports service_level parameter (low/medium/high/critical)
    """
    try:
        product_id = request.get('product_id')
        service_level = request.get('service_level', 'medium')

        if not product_id:
            raise HTTPException(status_code=400, detail="product_id is required")

        # Sanitize product ID
        product_id = sanitize_product_id(product_id)

        # Validate and convert current_stock
        try:
            current_stock = float(request.get('current_stock', 0))
            if current_stock < 0:
                raise HTTPException(status_code=400, detail="current_stock cannot be negative")
        except (ValueError, TypeError):
            raise HTTPException(status_code=400, detail="current_stock must be a number")

        # Validate and convert lead_time_days
        try:
            lead_time_days = int(request.get('lead_time_days', 3))
            if lead_time_days < 1 or lead_time_days > 30:
                raise HTTPException(status_code=400, detail="lead_time_days must be between 1 and 30")
        except (ValueError, TypeError):
            raise HTTPException(status_code=400, detail="lead_time_days must be an integer")

        model_candidates = [
            os.path.join(BASE_DIR, "training", "models_output", f"xgboost_{product_id}.pkl"),
            os.path.join(BASE_DIR, "models", f"xgboost_{product_id}.pkl"),
            os.path.join(BASE_DIR, "models", "artifacts", f"xgboost_{product_id}.pkl"),
        ]

        model_path = None
        for path in model_candidates:
            if os.path.exists(path):
                model_path = path
                break

        if not model_path:
            raise HTTPException(status_code=404, detail=f"Model not found for product: {product_id}")

        brain = HybridBrain(product_id)
        if not brain.load_model(product_id, model_path):
            raise HTTPException(status_code=500, detail="Failed to load model")

        predictions = brain.predict_next_days(14)
        quantities = [p.get('predicted_quantity', 0) for p in predictions]

        optimizer = InventoryOptimizer()
        inventory_result = optimizer.optimize_inventory(
            quantities[:7],
            current_stock,
            lead_time_days,
            service_level
        )

        return {
            'success': True,
            'product_id': product_id,
            'inventory': inventory_result,
            'forecast_7days': predictions[:7],
            'generated_at': datetime.now().isoformat()
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Inventory optimization error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/ml/profit/forecast")
def forecast_profit(request: dict):
    """
    Profit forecasting endpoint
    v2.0: Auto-allocates fixed costs across portfolio
    """
    try:
        product_id = request.get('product_id')

        if not product_id:
            raise HTTPException(status_code=400, detail="product_id is required")

        # Sanitize product ID
        product_id = sanitize_product_id(product_id)

        # Validate numeric inputs
        try:
            cost_per_unit = float(request.get('cost_per_unit', 0))
            price_per_unit = float(request.get('price_per_unit', 0))
            fixed_costs_weekly = float(request.get('fixed_costs_weekly', 0))
            days = int(request.get('days', 7))

            if cost_per_unit < 0:
                raise HTTPException(status_code=400, detail="cost_per_unit cannot be negative")
            if price_per_unit <= 0:
                raise HTTPException(status_code=400, detail="price_per_unit must be positive")
            if fixed_costs_weekly < 0:
                raise HTTPException(status_code=400, detail="fixed_costs_weekly cannot be negative")
            if days < 1 or days > 30:
                raise HTTPException(status_code=400, detail="days must be between 1 and 30")
        except (ValueError, TypeError) as e:
            raise HTTPException(status_code=400, detail=f"Invalid numeric parameter: {str(e)}")

        model_candidates = [
            os.path.join(BASE_DIR, "training", "models_output", f"xgboost_{product_id}.pkl"),
            os.path.join(BASE_DIR, "models", f"xgboost_{product_id}.pkl"),
            os.path.join(BASE_DIR, "models", "artifacts", f"xgboost_{product_id}.pkl"),
        ]

        model_path = None
        for path in model_candidates:
            if os.path.exists(path):
                model_path = path
                break

        if not model_path:
            raise HTTPException(status_code=404, detail=f"Model not found for product: {product_id}")

        brain = HybridBrain(product_id)
        if not brain.load_model(product_id, model_path):
            raise HTTPException(status_code=500, detail="Failed to load model")

        predictions = brain.predict_next_days(days)

        analyzer = ProfitAnalyzer()
        profit_result = analyzer.forecast_profit(
            predictions,
            cost_per_unit,
            price_per_unit,
            fixed_costs_weekly
        )

        return {
            'success': True,
            'product_id': product_id,
            'profit_analysis': profit_result,
            'generated_at': datetime.now().isoformat()
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Profit forecast error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/ml/report/weekly")
def get_weekly_report(request: Request, product_id: Optional[str] = None):
    """Generate weekly report for products"""
    try:
        if product_id:
            products = [product_id]
        else:
            products = get_all_product_ids_from_models()

        if not products:
            return {
                'success': True,
                'message': 'No trained models found',
                'report': None
            }

        end_date = datetime.now()
        start_date = end_date - timedelta(days=7)

        period_info = {
            'start': start_date.strftime('%Y-%m-%d'),
            'end': end_date.strftime('%Y-%m-%d'),
            'days': 7
        }
        products_data: List[Dict] = []

        for pid in products:
            try:
                model_path = None
                for candidate in [
                    os.path.join(BASE_DIR, "training", "models_output", f"xgboost_{pid}.pkl"),
                    os.path.join(BASE_DIR, "models", f"xgboost_{pid}.pkl"),
                    os.path.join(BASE_DIR, "models", "artifacts", f"xgboost_{pid}.pkl")
                ]:
                    if os.path.exists(candidate):
                        model_path = candidate
                        break

                if not model_path:
                    continue

                brain = HybridBrain(pid)
                if not brain.load_model(pid, model_path):
                    continue

                predictions = brain.predict_next_days(7)
                next_week_total = sum(p['predicted_quantity'] for p in predictions)

                momentum_data = brain.physics_metrics.get('momentum', {})
                status = momentum_data.get('status', 'STABLE')
                combined_momentum = momentum_data.get('combined', 0)

                burst_data = brain.physics_metrics.get('burst', {})
                recommendation = brain.get_recommendation()

                product_report = {
                    'product_id': pid,
                    'next_week_forecast': round(next_week_total, 1),
                    'avg_daily_forecast': round(next_week_total / 7, 1),
                    'momentum': {
                        'status': status,
                        'percentage': round(combined_momentum * 100, 1),
                        'trend': 'UP' if combined_momentum > 0.05 else 'DOWN' if combined_momentum < -0.05 else 'FLAT'
                    },
                    'burst': {
                        'level': burst_data.get('level', 'NORMAL'),
                        'score': round(burst_data.get('burst_score', 0), 2)
                    },
                    'recommendation': {
                        'type': recommendation.get('type'),
                        'priority': recommendation.get('priority'),
                        'message': recommendation.get('message')
                    },
                    'predictions': predictions
                }

                products_data.append(product_report)

            except Exception as e:
                logger.warning(f"Failed to generate report for {pid}: {e}")
                continue

        ranking_strategy = request.query_params.get('ranking_strategy', 'balanced')

        # Safely parse top_n parameter
        try:
            top_n = int(request.query_params.get('top_n', 3))
            top_n = max(1, min(top_n, 20))  # Clamp to [1, 20]
        except (ValueError, TypeError):
            logger.warning(f"Invalid top_n parameter, using default 3")
            top_n = 3

        include_insights = request.query_params.get('include_insights', 'true').lower() == 'true'

        ranked_products = report_ranker.rank_products(products=products_data, strategy=ranking_strategy)
        needs_attention = report_ranker.identify_needs_attention(products=ranked_products, top_n=top_n)
        top_performers = ranked_products[:top_n]

        insights = None
        if include_insights:
            insights = report_ranker.generate_insights(
                products=ranked_products,
                top_performers=top_performers,
                needs_attention=needs_attention
            )

        summary = {
            "total_products": len(ranked_products),
            "trending_up": sum(1 for p in ranked_products if p['momentum']['status'] == 'TRENDING_UP'),
            "growing": sum(1 for p in ranked_products if p['momentum']['status'] == 'GROWING'),
            "stable": sum(1 for p in ranked_products if p['momentum']['status'] == 'STABLE'),
            "falling": sum(1 for p in ranked_products if p['momentum']['status'] == 'FALLING'),
            "declining": sum(1 for p in ranked_products if p['momentum']['status'] == 'DECLINING')
        }

        report = {
            'period': period_info,
            'ranking_strategy': ranking_strategy,
            'summary': summary,
            'top_performers': top_performers,
            'needs_attention': needs_attention,
            'insights': insights,
            'products': ranked_products if product_id else None
        }

        return {
            'success': True,
            'report': report,
            'generated_at': datetime.now().isoformat()
        }

    except Exception as e:
        logger.error(f"Weekly report error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    logger.info(f"Starting server with BASE_DIR: {BASE_DIR}")
    uvicorn.run(app, host="0.0.0.0", port=8000)