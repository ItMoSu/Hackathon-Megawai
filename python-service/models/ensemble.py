from __future__ import annotations

from typing import Dict, List, Sequence

import numpy as np


def calculate_adaptive_weights(data_quality_days: int, agreement_score: float) -> Dict[str, float]:
    """
    Adaptive weighting between rule-based and ML forecasts.
    """
    if data_quality_days < 60:
        return {"rule": 0.7, "ml": 0.3}
    if data_quality_days > 90 and agreement_score >= 0.8:
        return {"rule": 0.3, "ml": 0.7}
    return {"rule": 0.5, "ml": 0.5}


def _to_lookup(preds: Sequence[dict], key: str) -> Dict[str, float]:
    lookup: Dict[str, float] = {}
    for row in preds or []:
        date = row.get("date")
        if date is None:
            continue
        lookup[str(date)] = float(row.get(key, 0))
    return lookup


def _confidence_from_width(lower: float, upper: float, value: float) -> str:
    width = max(upper - lower, 0.0)
    denom = max(abs(value), 1.0)
    ratio = width / denom
    if ratio < 0.2:
        return "HIGH"
    if ratio < 0.4:
        return "MEDIUM"
    return "LOW"


def ensemble_forecast(
    rule_pred: Sequence[dict],
    ml_p10: Sequence[dict],
    ml_p50: Sequence[dict],
    ml_p90: Sequence[dict],
    weights: Dict[str, float],
) -> Dict:
    rule_lookup = _to_lookup(rule_pred, "predicted_quantity")
    p10_lookup = _to_lookup(ml_p10, "lower_bound")
    p50_lookup = _to_lookup(ml_p50, "predicted_quantity")
    p90_lookup = _to_lookup(ml_p90, "upper_bound")

    all_dates = sorted(set(rule_lookup.keys()) | set(p50_lookup.keys()))
    predictions: List[dict] = []
    confidence_levels: List[str] = []
    agreement_scores: List[float] = []

    for date in all_dates:
        rule_val = rule_lookup.get(date, 0.0)
        p10 = p10_lookup.get(date, rule_val)
        p50 = p50_lookup.get(date, rule_val)
        p90 = p90_lookup.get(date, max(p50, rule_val))

        ensemble_qty = weights.get("rule", 0.5) * rule_val + weights.get("ml", 0.5) * p50

        diff = abs(rule_val - p50)
        agreement_scores.append(1 - min(diff / max(p50, 1.0), 1.0))

        conf = _confidence_from_width(p10, p90, ensemble_qty)
        confidence_levels.append(conf)

        predictions.append(
            {
                "date": date,
                "rule_based": rule_val,
                "ml_p10": p10,
                "ml_p50": p50,
                "ml_p90": p90,
                "predicted_quantity": ensemble_qty,
                "forecast": ensemble_qty,
                "lower_bound": min(p10, ensemble_qty),
                "upper_bound": max(p90, ensemble_qty),
                "confidence": conf,
            }
        )

    if not predictions:
        return {"predictions": [], "agreement_score": 0.0, "trend": "STABLE"}

    overall_agreement = float(np.mean(agreement_scores)) if agreement_scores else 0.0
    trend = "STABLE"
    if predictions[-1]["predicted_quantity"] > predictions[0]["predicted_quantity"] * 1.05:
        trend = "INCREASING"
    elif predictions[-1]["predicted_quantity"] < predictions[0]["predicted_quantity"] * 0.95:
        trend = "DECREASING"

    conf_score = np.mean(
        [1.0 if c == "HIGH" else 0.6 if c == "MEDIUM" else 0.3 for c in confidence_levels]
    )
    overall_confidence = "HIGH" if conf_score >= 0.8 else "MEDIUM" if conf_score >= 0.55 else "LOW"

    return {
        "predictions": predictions,
        "agreement_score": overall_agreement,
        "trend": trend,
        "confidence": overall_confidence,
    }


def generate_recommendations(
    realtime_burst: Dict,
    realtime_momentum: Dict,
    ml_forecast: List[Dict],
    ensemble: List[Dict]
) -> List[Dict]:
    '''
    Generate actionable recommendations based on all intelligence layers
    WITH peak-aware strategy to prevent overstock
    '''
    recommendations = []
    
    if not ensemble:
        return []

    # Calculate trend from forecast
    forecast_values = [p['forecast'] for p in ensemble]
    trend_direction = 'INCREASING' if forecast_values[-1] > forecast_values[0] else 'DECREASING' if forecast_values[-1] < forecast_values[0] else 'STABLE'
    total_forecast_7d = sum(forecast_values)
    
    # DETECT PEAK AND POST-PEAK DECLINE
    peak_index = forecast_values.index(max(forecast_values))
    peak_value = forecast_values[peak_index]
    peak_date_idx = peak_index  # 0-indexed
    
    is_peak_with_decline = (
        peak_index < len(forecast_values) - 2 and  # Peak not at end
        forecast_values[-1] < peak_value * 0.75  # After peak drops >25%
    )
    
    # === RULE 1: Viral Opportunity ===
    if (realtime_burst.get('severity') == 'CRITICAL' and 
        trend_direction == 'INCREASING' and
        ensemble[0]['confidence'] == 'HIGH'):
        
        recommendations.append({
            'type': 'SCALE_UP',
            'priority': 'URGENT',
            'icon': '🚀',
            'title': 'Deteksi Peluang Viral',
            'message': 'Produk sedang viral dan diprediksi terus naik 7 hari ke depan.',
            'action': f'Siapkan stok {int(total_forecast_7d * 1.3)} units untuk 7 hari ke depan (+30% buffer).',
            'reasoning': [
                f'Lonjakan: {realtime_burst.get("score", 0):.1f}x di atas normal',
                f'Momentum: +{realtime_momentum.get("combined", 0)*100:.0f}%',
                f'Prediksi ML: {trend_direction}',
                f'Tingkat keyakinan: {ensemble[0]["confidence"]}'
            ]
        })
    
    # === RULE 2: PEAK WITH DECLINE - SMART 2-PHASE STRATEGY ===
    elif is_peak_with_decline:
        before_peak = forecast_values[:peak_index+1]
        after_peak = forecast_values[peak_index+1:]
        
        # Calculate smart totals
        stock_before_peak = int(sum(before_peak) * 1.2)  # +20% buffer before peak
        stock_after_peak = int(sum(after_peak) * 1.0)   # No buffer after peak
        total_smart = stock_before_peak + stock_after_peak
        total_naive = int(total_forecast_7d * 1.3)  # Naive flat approach
        savings = total_naive - total_smart
        
        # Get peak date from ensemble
        peak_date = ensemble[peak_index]['date']
        peak_day_name = ensemble[peak_index].get('day_name', '')
        
        recommendations.append({
            'type': 'PEAK_STRATEGY',
            'priority': 'HIGH',
            'icon': '🎯',
            'title': 'Strategi 2 Fase: Peak Terdeteksi',
            'message': f'Puncak diprediksi pada hari ke-{peak_index+1} ({peak_day_name}), lalu turun {int((1 - forecast_values[-1]/peak_value)*100)}%.',
            'phases': [
                {
                    'phase_name': f'Fase 1: Menuju Peak (Hari 1-{peak_index+1})',
                    'icon': '📈',
                    'stock_needed': stock_before_peak,
                    'daily_avg': int(stock_before_peak / len(before_peak)),
                    'advice': f'Tingkatkan produksi. Target: {stock_before_peak} porsi total.',
                    'days': list(range(1, peak_index+2))
                },
                {
                    'phase_name': f'Fase 2: Setelah Peak (Hari {peak_index+2}-7)',
                    'icon': '📉',
                    'stock_needed': stock_after_peak,
                    'daily_avg': int(stock_after_peak / len(after_peak)),
                    'advice': f'Kurangi produksi. Cukup {stock_after_peak} porsi total.',
                    'warning': 'PENTING: Jangan produksi berlebih setelah peak untuk hindari waste.',
                    'days': list(range(peak_index+2, 8))
                }
            ],
            'savings': {
                'amount': savings,
                'total_smart': total_smart,
                'total_naive': total_naive,
                'percentage': int(savings / total_naive * 100) if total_naive > 0 else 0
            },
            'peak_info': {
                'date': peak_date,
                'day_name': peak_day_name,
                'quantity': int(peak_value),
                'index': peak_index + 1
            },
            'reasoning': [
                f'Peak: Hari ke-{peak_index+1} dengan {int(peak_value)} porsi',
                f'Penurunan setelah peak: {int((1 - forecast_values[-1]/peak_value)*100)}%',
                f'Strategi 2 fase hemat {savings} porsi vs produksi flat',
                'Mencegah overstock dan modal terbuang'
            ]
        })
    
    # === RULE 3: Declining Alert ===
    elif (realtime_momentum.get('status') == 'DECLINING' and 
          trend_direction == 'DECREASING'):
        
        recommendations.append({
            'type': 'INTERVENTION',
            'priority': 'PENTING',
            'icon': '⚠️',
            'title': 'Momentum Turun',
            'message': 'Penjualan turun dan diprediksi terus menurun.',
            'action': 'Pertimbangkan promo atau bundling untuk menghentikan penurunan.',
            'suggestions': [
                'Buat promo "Beli 2 Gratis 1" atau diskon 15-20%',
                'Bundle dengan produk lain yang laku',
                'Evaluasi harga vs kompetitor',
                'Survey feedback pelanggan'
            ]
        })
    
    # === RULE 4: Stable Optimization ===
    elif realtime_momentum.get('status') == 'STABLE' and ensemble[0]['confidence'] == 'HIGH':
        avg_daily = total_forecast_7d / 7
        buffer_stock = int(avg_daily * 3)  # 3 days buffer
        
        recommendations.append({
            'type': 'OPTIMIZE',
            'priority': 'RENDAH',
            'icon': '✅',
            'title': 'Demand Stabil',
            'message': 'Penjualan stabil dan mudah diprediksi.',
            'action': f'Maintain stok level: ~{buffer_stock} porsi (buffer 3 hari).',
            'reasoning': [
                f'Prediksi harian: {int(avg_daily)} porsi',
                'Tingkat keyakinan tinggi',
                'Tidak perlu overstock'
            ]
        })
    
    # === RULE 5: Default - Standard Forecast ===
    else:
        avg_daily = total_forecast_7d / 7
        
        recommendations.append({
            'type': 'STANDARD',
            'priority': 'MEDIUM',
            'icon': '📊',
            'title': 'Prediksi Standar',
            'message': f'Prediksi demand 7 hari ke depan: {int(total_forecast_7d)} porsi.',
            'action': f'Siapkan rata-rata {int(avg_daily)} porsi per hari dengan buffer kecil.',
            'reasoning': [
                f'Total 7 hari: {int(total_forecast_7d)} porsi',
                f'Rata-rata harian: {int(avg_daily)} porsi',
                f'Trend: {trend_direction}'
            ]
        })
    
    # Sort by priority
    priority_order = {'URGENT': 0, 'HIGH': 1, 'PENTING': 2, 'MEDIUM': 3, 'RENDAH': 4}
    return sorted(recommendations, key=lambda x: priority_order.get(x['priority'], 99))
