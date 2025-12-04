"""
Ensemble Predictor - Combines ML + Rules
"""

import json
import os
from typing import Dict, List, Optional

from .xgboost_optimal import forecaster

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))


class EnsemblePredictor:
    """Combines ML predictions with real-time rule-based analysis"""

    def __init__(self):
        self.forecaster = forecaster

    def predict(self, product_id: str, realtime_data: Dict, days: int = 7) -> Dict:
        """
        Generate hybrid prediction

        Args:
            product_id: Product identifier
            realtime_data: Real-time metrics (momentum, burst, etc.)
            days: Number of days to forecast

        Returns:
            Combined prediction with recommendations
        """
        try:
            model_path = self._find_model_path(product_id)
            if not model_path:
                return {
                    'success': False,
                    'error': f'Model not found for product: {product_id}'
                }

            if not self.forecaster.load_model(product_id, model_path):
                return {
                    'success': False,
                    'error': f'Failed to load model for product: {product_id}'
                }

            ml_predictions = self.forecaster.predict(product_id, days)

            metadata_path = model_path.replace('.pkl', '_metadata.json')
            physics_metrics: Dict = {}
            recommendation: Dict = {}

            if os.path.exists(metadata_path):
                with open(metadata_path, 'r', encoding='utf-8') as f:
                    metadata = json.load(f)
                    physics_metrics = metadata.get('physics_metrics', {})
                    recommendation = metadata.get('recommendation', {})

            if realtime_data:
                if 'momentum' in realtime_data:
                    physics_metrics['momentum'] = realtime_data['momentum']
                if 'burst' in realtime_data:
                    physics_metrics['burst'] = realtime_data['burst']

            peak_info = self._detect_peak(ml_predictions)

            return {
                'success': True,
                'product_id': product_id,
                'predictions': ml_predictions,
                'physics_metrics': physics_metrics,
                'recommendation': recommendation,
                'peak_info': peak_info
            }

        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }

    def _find_model_path(self, product_id: str) -> Optional[str]:
        candidates = [
            os.path.join(BASE_DIR, "training", "models_output", f"xgboost_{product_id}.pkl"),
            os.path.join(BASE_DIR, "models", f"xgboost_{product_id}.pkl"),
        ]
        for path in candidates:
            if os.path.exists(path):
                return path
        return None

    def _detect_peak(self, predictions: List[Dict]) -> Optional[Dict]:
        """Detect peak in forecast for 2-phase strategy"""
        if not predictions or len(predictions) < 3:
            return None

        max_idx = 0
        max_val = predictions[0]['predicted_quantity']

        for i, pred in enumerate(predictions):
            if pred['predicted_quantity'] > max_val:
                max_val = pred['predicted_quantity']
                max_idx = i

        if max_idx < len(predictions) - 2:
            post_peak_avg = sum(p['predicted_quantity'] for p in predictions[max_idx + 1:]) / (len(predictions) - max_idx - 1)
            decline_pct = (max_val - post_peak_avg) / max_val if max_val > 0 else 0

            if decline_pct > 0.25:
                return {
                    'has_peak': True,
                    'peak_day': max_idx + 1,
                    'peak_date': predictions[max_idx]['date'],
                    'peak_value': max_val,
                    'decline_percentage': decline_pct * 100
                }

        return None
