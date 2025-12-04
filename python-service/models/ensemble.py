"""
Ensemble Predictor - Combines ML model with realtime data
"""

from typing import Dict, List, Optional
import logging
from datetime import datetime, timedelta
import os

from models.xgboost_optimal import HybridBrain

logger = logging.getLogger(__name__)


class EnsemblePredictor:
    """
    Ensemble predictor that combines:
    1. Pre-trained ML model
    2. Realtime data adjustments
    3. Rule-based fallbacks
    """

    def __init__(self):
        self.models_cache: Dict[str, HybridBrain] = {}

    def predict(
        self,
        product_id: str,
        realtime_data: Dict,
        days: int = 7
    ) -> Dict:
        """
        Generate ensemble prediction with realtime data
        
        Args:
            product_id: Product identifier
            realtime_data: Recent sales data
            days: Number of days to forecast
        
        Returns:
            Prediction results with metadata
        """
        try:
            # Load or get cached model
            brain = self._get_model(product_id)
            
            if not brain:
                return {
                    'success': False,
                    'error': f'Model not found for product: {product_id}'
                }

            # Get base prediction
            predictions = brain.predict_next_days(days)

            # Apply realtime adjustments if provided
            if realtime_data and 'recent_sales' in realtime_data:
                predictions = self._apply_realtime_adjustment(
                    predictions,
                    realtime_data['recent_sales']
                )

            return {
                'success': True,
                'product_id': product_id,
                'predictions': predictions,
                'method': 'ENSEMBLE',
                'realtime_adjusted': bool(realtime_data),
                'recommendation': brain.get_recommendation()
            }

        except Exception as e:
            logger.error(f"Ensemble prediction failed for {product_id}: {e}")
            return {
                'success': False,
                'error': str(e)
            }

    def _get_model(self, product_id: str) -> Optional[HybridBrain]:
        """Load model from cache or disk"""
        
        # Check cache
        if product_id in self.models_cache:
            return self.models_cache[product_id]

        # Try to load from disk
        model_paths = [
            f"training/models_output/xgboost_{product_id}.pkl",
            f"models/artifacts/xgboost_{product_id}.pkl"
        ]

        for path in model_paths:
            if os.path.exists(path):
                brain = HybridBrain(product_id)
                if brain.load_model(product_id, path):
                    self.models_cache[product_id] = brain
                    return brain

        return None

    def _apply_realtime_adjustment(
        self,
        predictions: List[Dict],
        recent_sales: List[float]
    ) -> List[Dict]:
        """Adjust predictions based on recent sales trend"""
        
        if not recent_sales or len(recent_sales) < 3:
            return predictions

        # Calculate recent trend
        recent_avg = sum(recent_sales[-3:]) / 3
        historical_avg = sum(recent_sales) / len(recent_sales)
        
        if historical_avg > 0:
            adjustment_factor = recent_avg / historical_avg
            # Limit adjustment to ±20%
            adjustment_factor = max(0.8, min(1.2, adjustment_factor))

            # Apply adjustment
            for pred in predictions:
                pred['predicted_quantity'] *= adjustment_factor
                pred['lower_bound'] *= adjustment_factor
                pred['upper_bound'] *= adjustment_factor
                pred['realtime_adjusted'] = True

        return predictions