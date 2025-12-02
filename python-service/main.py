from datetime import date
from typing import List, Optional
import os
import json

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from models.ensemble import (
    calculate_adaptive_weights,
    ensemble_forecast,
    generate_recommendations,
)
from models.xgboost_optimal import MIN_TRAINING_DAYS, forecaster

app = FastAPI(title="Optimal XGBoost ML Service", version="1.0.0")


class SalesDataPoint(BaseModel):
    date: date
    quantity: float = Field(..., ge=0)


class TrainRequest(BaseModel):
    productId: str = Field(..., alias="productId")
    salesData: List[SalesDataPoint] = Field(default_factory=list, alias="salesData")


class RulePrediction(BaseModel):
    date: date
    predicted_quantity: float = Field(..., ge=0, alias="predicted_quantity")


class HybridForecastRequest(BaseModel):
    productId: str = Field(..., alias="productId")
    rulePredictions: List[RulePrediction] = Field(default_factory=list, alias="rulePredictions")
    dataQualityDays: Optional[int] = Field(None, alias="dataQualityDays")
    agreementScore: Optional[float] = Field(None, alias="agreementScore")
    burst: Optional[dict] = None
    momentum: Optional[dict] = None
    days: int = 7


@app.get("/")
def root():
    return {"status": "ok", "message": "Optimal XGBoost ML Service ready"}


@app.post("/api/ml/train")
def train_model(request: TrainRequest):
    if not request.salesData:
        raise HTTPException(status_code=400, detail="salesData is required for training")

    if len(request.salesData) < MIN_TRAINING_DAYS:
        raise HTTPException(
            status_code=400,
            detail=f"Need at least {MIN_TRAINING_DAYS} days of data to train",
        )

    payload = [
        {"date": item.date.isoformat(), "quantity": item.quantity}
        for item in request.salesData
    ]

    try:
        meta = forecaster.train(payload, request.productId)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return {"success": True, "trained": True, "model": meta}


@app.get("/api/ml/forecast")
def forecast(productId: str, days: int = 7):
    if days <= 0:
        raise HTTPException(status_code=400, detail="days must be positive")

    try:
        predictions, data_quality = forecaster.predict(productId, days)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return {
        "success": True,
        "productId": productId,
        "data_quality_days": data_quality,
        "predictions": predictions,
    }


@app.post("/api/ml/forecast-hybrid")
def forecast_hybrid(request: HybridForecastRequest):
    days = request.days if request.days > 0 else 7
    try:
        ml_predictions, data_quality = forecaster.predict(request.productId, days)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    ml_p10 = [
        {"date": p["date"], "lower_bound": p["lower_bound"]} for p in ml_predictions
    ]
    ml_p50 = [
        {"date": p["date"], "predicted_quantity": p["predicted_quantity"]}
        for p in ml_predictions
    ]
    ml_p90 = [{"date": p["date"], "upper_bound": p["upper_bound"]} for p in ml_predictions]

    rule_predictions = [
        {"date": rp.date.isoformat(), "predicted_quantity": rp.predicted_quantity}
        for rp in request.rulePredictions
    ]

    weights = calculate_adaptive_weights(
        request.dataQualityDays or data_quality,
        request.agreementScore or 0.5,
    )

    ensemble = ensemble_forecast(rule_predictions, ml_p10, ml_p50, ml_p90, weights)
    recommendations = generate_recommendations(
        request.burst or {},
        request.momentum or {},
        ml_predictions,
        ensemble.get("predictions", []),
    )

    return {
        "success": True,
        "productId": request.productId,
        "weights": weights,
        "data_quality_days": request.dataQualityDays or data_quality,
        "ml_predictions": ml_predictions,
        "ensemble": ensemble,
        "recommendations": recommendations,
    }


@app.get("/api/ml/models")
async def list_models():
    """List all trained models with metadata"""
    models_dir = forecaster.models_dir
    models: List[dict] = []

    if not models_dir.exists():
        return {"success": True, "models": [], "total": 0}

    for file in os.listdir(models_dir):
        if file.endswith("_metadata.json"):
            try:
                with open(models_dir / file, "r", encoding="utf-8") as f:
                    metadata = json.load(f)
                    models.append(
                        {
                            "product_id": metadata.get("product_id"),
                            "trained_at": metadata.get("trained_at"),
                            "data_points": metadata.get("data_points"),
                            "val_mae": metadata.get("metrics", {})
                            .get("validation", {})
                            .get("mae"),
                            "best_iteration": metadata.get("best_iteration"),
                        }
                    )
            except Exception:
                continue

    models.sort(key=lambda x: x.get("trained_at", "") or "", reverse=True)
    return {"success": True, "models": models, "total": len(models)}


@app.get("/api/ml/model-info/{productId}")
async def get_model_info(productId: str):
    """Get detailed model metadata"""
    metadata_path = forecaster.models_dir / f"xgboost_{productId}_metadata.json"
    if not metadata_path.exists():
        raise HTTPException(status_code=404, detail="Model metadata not found")
    with open(metadata_path, "r", encoding="utf-8") as f:
        metadata = json.load(f)
    return {"success": True, "product_id": productId, "metadata": metadata}
