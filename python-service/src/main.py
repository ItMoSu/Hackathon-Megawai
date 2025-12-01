from fastapi import FastAPI
from pydantic import BaseModel
from typing import List
import math

app = FastAPI()

class SalesData(BaseModel):
    product_id: str
    date: str
    qty: int

class AnalysisRequest(BaseModel):
    history: List[SalesData]
    current_qty: int
    baseline_avg: float

def calculate_burst_score(current_qty, baseline, history):
    expected = baseline 
    residuals = [x.qty - baseline for x in history] 
    
    if len(residuals) < 2: return 0.0
    
    mean = sum(residuals) / len(residuals)
    variance = sum([((x - mean) ** 2) for x in residuals]) / len(residuals)
    std_dev = math.sqrt(variance) or 1
    
    return (current_qty - expected) / std_dev

@app.post("/analyze")
async def analyze_market(data: AnalysisRequest):
    burst_score = calculate_burst_score(
        data.current_qty, 
        data.baseline_avg, 
        data.history
    )
    
    status = "NORMAL"
    if burst_score > 3.0: status = "CRITICAL_BURST"
    elif burst_score > 1.5: status = "MILD_BURST"

    return {
        "burst_score": burst_score,
        "status": status,
        "recommendation": "Cek stok barang segera!" if burst_score > 1.5 else "Aman."
    }

# Cara run: uvicorn src.main:app --reload --port 8000