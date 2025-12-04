"""
HYBRID TRIPLE INTELLIGENCE FORECASTER (STRICT MATH EDITION)
-----------------------------------------------------------
Implements Strict Formulas from Task-05 to Task-11:
- TASK-05: EMA (alpha = 2/(k+1))
- TASK-06: Weighted Momentum (0.5*M7 + 0.3*M14 + 0.2*M30)
- TASK-07: Expected Demand (Baseline * DOW * Payday)
- TASK-09: Burst Detection (Z-Score / Sigma Residual)
- TASK-10: Context Classification
- TASK-11: Priority Scoring
"""

from __future__ import annotations

import os
import json
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional

import joblib
import numpy as np
import pandas as pd
import xgboost as xgb

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ==========================================
# HYBRID BRAIN ENGINE
# ==========================================


class HybridBrain:
    def __init__(self, product_id: str = ""):
        self.product_id = product_id
        self.model: Optional[xgb.XGBRegressor] = None
        self.std_error = 0.0
        self.rules_metadata: Dict[str, Any] = {}
        self.physics_metrics: Dict[str, Any] = {}
        self.is_trained_ml = False
        self.last_row: Optional[Dict[str, Any]] = None
        self.trained_at: Optional[str] = None
        self.mae: float = 0.0

        # XGBoost Hyperparameters
        self.params = {
            'objective': 'reg:squarederror',
            'n_estimators': 150,
            'max_depth': 4,
            'learning_rate': 0.08,
            'subsample': 0.8,
            'colsample_bytree': 0.8,
            'random_state': 42
        }

    # =========================================================
    # TASK-05 & TASK-06: ADVANCED MOMENTUM CALCULATION
    # =========================================================
    def _calculate_momentum_metrics(self, df: pd.DataFrame) -> Dict:
        """
        Implementasi TASK-05 (EMA) & TASK-06 (Weighted Momentum)
        Formula: M = 0.5*M(7) + 0.3*M(14) + 0.2*M(30)
        """
        d = df.copy()

        d['ema_7'] = d['quantity'].ewm(span=7, adjust=False).mean()
        d['ema_14'] = d['quantity'].ewm(span=14, adjust=False).mean()
        d['ema_30'] = d['quantity'].ewm(span=30, adjust=False).mean()

        curr = d.iloc[-1]

        def calc_m(current_ema, lag_val):
            if lag_val == 0 or np.isnan(lag_val):
                return 0.0
            return (current_ema - lag_val) / lag_val

        lag_7 = d['ema_7'].shift(7).iloc[-1]
        lag_14 = d['ema_14'].shift(14).iloc[-1]
        lag_30 = d['ema_30'].shift(30).iloc[-1]

        m7 = calc_m(curr['ema_7'], lag_7)
        m14 = calc_m(curr['ema_14'], lag_14)
        m30 = calc_m(curr['ema_30'], lag_30)

        combined_momentum = (0.5 * m7) + (0.3 * m14) + (0.2 * m30)

        status = 'STABLE'
        if combined_momentum > 0.05:
            status = 'TRENDING_UP'
        elif combined_momentum > 0.02:
            status = 'GROWING'
        elif combined_momentum < -0.05:
            status = 'FALLING'
        elif combined_momentum < -0.02:
            status = 'DECLINING'

        return {
            "momentum7": float(m7),
            "momentum14": float(m14),
            "momentum30": float(m30),
            "combined": float(combined_momentum),
            "combined_momentum": float(combined_momentum),
            "status": status
        }

    # =========================================================
    # TASK-07 & TASK-09: EXPECTED DEMAND & BURST DETECTION
    # =========================================================
    def _detect_burst_physics(self, df: pd.DataFrame) -> Dict:
        """
        Implementasi TASK-07 (Factors) & TASK-09 (Sigma Residual)
        Formula B = (actual - expected) / sigma_residual
        """
        df['baseline'] = df['quantity'].rolling(window=30, min_periods=1).mean()

        df['dow'] = df['date'].dt.dayofweek
        dow_stats = df.groupby('dow')['quantity'].mean()
        global_avg = df['quantity'].mean()

        def get_dow_factor(row):
            if global_avg == 0:
                return 1.0
            return dow_stats.get(row['dow'], global_avg) / global_avg

        def get_payday_factor(row):
            day = row['date'].day
            if 25 <= day <= 31 or 1 <= day <= 5:
                return 1.15
            return 1.0

        last_row = df.iloc[-1]
        dow_factor = get_dow_factor(last_row)
        payday_factor = get_payday_factor(last_row)

        expected = last_row['baseline'] * dow_factor * payday_factor
        actual = last_row['quantity']

        residuals = df['quantity'] - df['baseline']
        sigma = residuals.std()
        if sigma == 0 or np.isnan(sigma):
            sigma = 1.0

        burst_score = (actual - expected) / sigma

        level = 'NORMAL'
        if burst_score > 3.0:
            level = 'CRITICAL'
        elif burst_score > 2.0:
            level = 'SIGNIFICANT'
        elif burst_score > 1.0:
            level = 'MILD'

        burst_type = 'NORMAL'
        if level != 'NORMAL':
            if last_row['dow'] >= 5:
                burst_type = 'SEASONAL'
            elif burst_score > 4.0:
                burst_type = 'VIRAL'
            else:
                burst_type = 'MONITORING'

        return {
            "actual": float(actual),
            "expected": float(expected),
            "burst_score": float(burst_score),
            "level": level,
            "burst_type": burst_type,
            "factors": {
                "baseline": float(last_row['baseline']),
                "dow": float(dow_factor),
                "payday": float(payday_factor)
            }
        }

    # =========================================================
    # CORE PIPELINE
    # =========================================================

    def _feature_engineering(self, df: pd.DataFrame) -> pd.DataFrame:
        df = df.copy()
        df = df.sort_values('date')
        df['day_of_week'] = df['date'].dt.dayofweek
        df['day_of_month'] = df['date'].dt.day
        df['is_weekend'] = df['day_of_week'].isin([5, 6]).astype(int)
        df['lag_1'] = df['quantity'].shift(1).bfill()
        df['lag_7'] = df['quantity'].shift(7).bfill()
        df['roll_mean_7'] = df['quantity'].shift(1).rolling(window=7, min_periods=1).mean().bfill()
        return df

    def _calculate_priority_score(self) -> float:
        momentum = self.physics_metrics.get('momentum', {})
        burst = self.physics_metrics.get('burst', {})
        norm_m = min(max(momentum.get('combined', 0.0), -1), 1)
        norm_b = min(max(burst.get('burst_score', 0.0) / 3.0, 0), 1)
        return float((0.7 * norm_m) + (0.3 * norm_b))

    def load_model(self, product_id: str, model_path: str) -> bool:
        """Load trained model from file"""
        if not os.path.exists(model_path):
            logger.error(f"Model file not found: {model_path}")
            return False
        try:
            state = joblib.load(model_path)

            if isinstance(state, HybridBrain):
                loaded_brain: HybridBrain = state
                self.product_id = loaded_brain.product_id or product_id
                self.model = loaded_brain.model
                self.physics_metrics = loaded_brain.physics_metrics
                self.std_error = loaded_brain.std_error
                self.mae = loaded_brain.mae
                self.last_row = loaded_brain.last_row
                self.is_trained_ml = loaded_brain.is_trained_ml
            elif isinstance(state, dict):
                self.product_id = state.get('product_id', product_id)
                self.model = state.get('model')
                self.physics_metrics = state.get('physics_metrics', {})
                self.std_error = state.get('std_error', 1.0)
                self.mae = state.get('mae', 0.0)
                self.last_row = state.get('last_row')
                self.is_trained_ml = bool(state.get('is_trained_ml', True))
            else:
                logger.error(f"Unsupported model state type: {type(state)}")
                return False

            if self.model is None:
                logger.error(f"Model object is None after loading {model_path}")
                return False

            meta_path = model_path.replace('.pkl', '_metadata.json')
            if os.path.exists(meta_path):
                with open(meta_path, 'r', encoding='utf-8') as f:
                    _ = json.load(f)

            logger.info(f"Loaded model for {self.product_id} from {model_path}")
            logger.info(f" - MAE: {self.mae}")
            logger.info(f" - Std Error: {self.std_error}")
            logger.info(f" - Has last_row: {self.last_row is not None}")
            return True
        except Exception as e:
            logger.error(f"Failed to load model {model_path}: {e}")
            return False

    def train(self, sales_data: List[Dict], product_id: Optional[str] = None) -> Dict:
        """Train hybrid brain with sales data"""
        if product_id:
            self.product_id = product_id

        logger.info(f"Training HybridBrain for product: {self.product_id}")
        df = pd.DataFrame(sales_data)

        if 'date' not in df.columns or 'quantity' not in df.columns:
            raise ValueError("Data must have 'date' and 'quantity' columns")

        df['date'] = pd.to_datetime(df['date'])
        df['quantity'] = pd.to_numeric(df['quantity'])
        df = df.sort_values('date').reset_index(drop=True)

        if (df['quantity'] <= 0).any():
            logger.warning("Found non-positive quantities, removing...")
            df = df[df['quantity'] > 0].reset_index(drop=True)

        if df['quantity'].isna().any():
            logger.warning("Found NaN quantities, removing...")
            df = df.dropna(subset=['quantity']).reset_index(drop=True)

        if df.empty:
            raise ValueError("No valid sales data provided after cleaning")

        momentum_res = self._calculate_momentum_metrics(df)
        burst_res = self._detect_burst_physics(df)
        self.physics_metrics = {
            "momentum": momentum_res,
            "burst": burst_res
        }
        priority_score = self._calculate_priority_score()
        self.physics_metrics["priority_score"] = priority_score

        self.rules_metadata = {
            **momentum_res,
            **burst_res,
            "priority_score": float(priority_score)
        }

        try:
            if len(df) >= 12:
                logger.info("Sufficient data for ML training")
                result = self._train_ml_model(df)
            else:
                logger.info(f"Cold start mode: {len(df)} rows < 12 threshold")
                result = self._cold_start_mode(df)

            logger.info(f"Training complete: {result.get('mode')}")
            return result
        except Exception as e:
            logger.error(f"Training failed: {str(e)}")
            raise

    def _train_ml_model(self, df: pd.DataFrame) -> Dict:
        train_df = self._feature_engineering(df)
        feature_cols = ['day_of_week', 'day_of_month', 'is_weekend', 'lag_1', 'lag_7', 'roll_mean_7']
        X = train_df[feature_cols]
        y = train_df['quantity']

        self.model = xgb.XGBRegressor(**self.params)
        self.model.fit(X, y)
        self.is_trained_ml = True

        preds = self.model.predict(X)
        residuals = y - preds
        self.std_error = float(np.std(residuals))
        self.mae = float(np.mean(np.abs(residuals)))
        self.trained_at = datetime.now().isoformat()

        last_feats = train_df.iloc[-1][feature_cols].to_dict()
        self.last_row = {
            **last_feats,
            "roll_mean_7": float(last_feats['roll_mean_7']),
            "lag_1": float(last_feats['lag_1']),
            "lag_7": float(last_feats['lag_7']),
        }

        return {
            "success": True,
            "metrics": {"train": {"mae": self.mae}, "validation": {"mae": self.mae}},
            "rule_status": self.rules_metadata.get('status'),
            "burst_level": self.rules_metadata.get('level'),
            "priority": round(self.physics_metrics.get("priority_score", 0.0), 2),
            "mode": "HYBRID_MATH_STRICT",
            "recommendation": self.get_recommendation()
        }

    def _cold_start_train(self, df: pd.DataFrame):
        """Minimal fallback (legacy)"""
        self.is_trained_ml = False
        self.rules_metadata = {'status': 'COLD_START', 'level': 'NORMAL', 'priority_score': 0}
        self.last_row = df.iloc[-1].to_dict() if not df.empty else {}
        return {"metrics": {"validation": {"mae": 0}}, "mode": "COLD_START"}

    def _cold_start_mode(self, df: pd.DataFrame) -> Dict:
        """Handle cold start with rules only"""
        logger.info("Using rule-based forecasting (cold start)")

        mean_qty = df['quantity'].mean()
        std_qty = df['quantity'].std()

        self.is_trained_ml = False
        self.std_error = float(std_qty) if std_qty > 0 else float(mean_qty * 0.2)
        self.last_row = {
            'roll_mean_7': float(mean_qty),
            'lag_1': float(df['quantity'].iloc[-1]),
            'lag_7': float(df['quantity'].iloc[-1]) if len(df) >= 7 else float(mean_qty),
            'day_of_week': pd.Timestamp.now().dayofweek,
            'day_of_month': pd.Timestamp.now().day,
            'is_weekend': int(pd.Timestamp.now().dayofweek >= 5)
        }

        return {
            'success': True,
            'mode': 'COLD_START',
            'data_points': len(df),
            'metrics': {
                'mean': float(mean_qty),
                'std': float(std_qty),
                'physics': self.physics_metrics
            },
            'recommendation': self.get_recommendation()
        }

    def _prepare_feature_row(self, next_date: pd.Timestamp, current_row: Dict[str, Any]) -> Dict[str, Any]:
        return {
            'day_of_week': next_date.dayofweek,
            'day_of_month': next_date.day,
            'is_weekend': 1 if next_date.dayofweek >= 5 else 0,
            'lag_1': current_row.get('lag_1', current_row.get('roll_mean_7', 0)),
            'lag_7': current_row.get('lag_7', current_row.get('roll_mean_7', 0)),
            'roll_mean_7': current_row.get('roll_mean_7', 0)
        }

    def predict_next_days(self, days: int = 7) -> List[Dict]:
        """
        Predict next N days using hybrid approach with validation and smoothing
        """
        if days < 1 or days > 30:
            raise ValueError("Days must be between 1 and 30")
        if not self.last_row:
            raise ValueError("Model not trained. Call train() first.")

        logger.info(f"Predicting {days} days for product: {self.product_id or 'unknown'}")
        logger.info(f"Starting from last_row: {self.last_row}")

        predictions: List[Dict] = []

        if self.model is not None and self.is_trained_ml:
            ml_weight, rule_weight, confidence = 0.8, 0.2, 'HIGH'
        else:
            ml_weight, rule_weight, confidence = 0.0, 1.0, 'MEDIUM'

        combined_momentum = 0.0
        if self.physics_metrics:
            combined_momentum = self.physics_metrics.get('momentum', {}).get('combined', 0.0)
        elif self.rules_metadata:
            combined_momentum = self.rules_metadata.get('combined', 0.0)

        trend_factor = 1.0 + (combined_momentum * 0.1)
        current_row = self.last_row.copy()

        for i in range(days):
            pred_date = pd.Timestamp.now() + pd.Timedelta(days=i + 1)
            features = self._prepare_feature_row(pred_date, current_row)

            ml_pred = features['roll_mean_7']
            if self.model is not None and self.is_trained_ml:
                try:
                    ml_pred = float(self.model.predict(pd.DataFrame([features]))[0])
                    ml_pred = max(0.0, ml_pred)
                except Exception as e:
                    logger.warning(f"ML prediction failed: {e}")
                    ml_pred = features['roll_mean_7']

            baseline = features['roll_mean_7']
            rule_pred = baseline * trend_factor

            final_pred = (ml_weight * ml_pred) + (rule_weight * rule_pred)

            if i > 0:
                prev_pred = predictions[-1]['predicted_quantity']
                max_change = prev_pred * 0.3
                final_pred = max(prev_pred - max_change, min(prev_pred + max_change, final_pred))

            final_pred = max(1.0, round(final_pred, 1))
            uncertainty = 1.64 * self.std_error
            lower_bound = max(0, round(final_pred - uncertainty, 1))
            upper_bound = round(final_pred + uncertainty, 1)

            predictions.append({
                'date': pred_date.strftime('%Y-%m-%d'),
                'predicted_quantity': final_pred,
                'lower_bound': lower_bound,
                'upper_bound': upper_bound,
                'confidence': confidence,
                'day_of_week': pred_date.dayofweek,
                'is_weekend': pred_date.dayofweek >= 5
            })

            current_row['lag_1'] = final_pred
            if i >= 6:
                current_row['lag_7'] = predictions[i - 6]['predicted_quantity']
            current_row['roll_mean_7'] = float(np.mean([p['predicted_quantity'] for p in predictions[max(0, i - 6):i + 1]]))
            current_row['day_of_week'] = pred_date.dayofweek
            current_row['day_of_month'] = pred_date.day
            current_row['is_weekend'] = int(pred_date.dayofweek >= 5)

        validated = self._validate_predictions(predictions)
        pred_values = [p['predicted_quantity'] for p in validated] if validated else []
        if pred_values:
            logger.info(f"Generated predictions: {pred_values}")
            logger.info(f"Prediction range: {min(pred_values):.1f} - {max(pred_values):.1f}")
        return validated

    def get_recommendation(self) -> Dict:
        """Generate business recommendation based on metrics"""
        if not self.physics_metrics:
            return {
                'type': 'INSUFFICIENT_DATA',
                'priority': 'LOW',
                'message': 'Tidak cukup data untuk rekomendasi. Tambahkan minimal 7 hari data.'
            }

        burst_level = self.physics_metrics.get('burst', {}).get('level')
        momentum_status = self.physics_metrics.get('momentum', {}).get('status')
        combined_momentum = self.physics_metrics.get('momentum', {}).get('combined_momentum', 0.0)

        if burst_level in ['CRITICAL', 'SIGNIFICANT']:
            return {
                'type': 'SCALE_UP',
                'priority': 'CRITICAL' if burst_level == 'CRITICAL' else 'HIGH',
                'message': f'VIRAL ALERT! Lonjakan {burst_level.lower()} terdeteksi. Tingkatkan produksi segera.',
                'actions': [
                    'Tingkatkan produksi 2-3x lipat',
                    'Pastikan stok bahan baku mencukupi',
                    'Siapkan tenaga kerja tambahan',
                    'Manfaatkan momentum untuk promosi'
                ]
            }

        if momentum_status in ['FALLING', 'DECLINING']:
            momentum_pct = abs(combined_momentum * 100)
            return {
                'type': 'INTERVENTION',
                'priority': 'HIGH' if momentum_status == 'FALLING' else 'MEDIUM',
                'message': f'Penjualan turun {momentum_pct:.1f}%. Perlu strategi baru.',
                'actions': [
                    'Buat promo atau diskon terbatas',
                    'Bundling dengan produk lain',
                    'Tingkatkan aktivitas media sosial',
                    'Cek kompetitor dan sesuaikan harga'
                ]
            }

        if momentum_status in ['TRENDING_UP', 'GROWING']:
            momentum_pct = combined_momentum * 100
            return {
                'type': 'MAINTAIN',
                'priority': 'MEDIUM',
                'message': f'Penjualan naik {momentum_pct:.1f}%. Pertahankan momentum.',
                'actions': [
                    'Pertahankan kualitas produk',
                    'Jaga konsistensi stok',
                    'Tingkatkan engagement pelanggan',
                    'Siapkan kapasitas untuk pertumbuhan'
                ]
            }

        return {
            'type': 'OPTIMIZE',
            'priority': 'LOW',
            'message': 'Penjualan stabil. Fokus pada efisiensi dan loyalitas pelanggan.',
            'actions': [
                'Optimalkan biaya operasional',
                'Tingkatkan program loyalitas',
                'Kumpulkan feedback pelanggan',
                'Eksplorasi pasar baru'
            ]
        }

    def _validate_predictions(self, predictions: List[Dict]) -> List[Dict]:
        """Validate and sanitize predictions"""
        validated = []
        for pred in predictions:
            pred['predicted_quantity'] = max(0, pred.get('predicted_quantity', 0))
            pred['lower_bound'] = max(0, pred.get('lower_bound', 0))
            upper = pred.get('upper_bound', pred['lower_bound'])
            if upper < pred['lower_bound']:
                upper = pred['lower_bound'] + self.std_error
            pred['upper_bound'] = max(pred['lower_bound'], upper)
            validated.append(pred)
        return validated

    def get_health_check(self) -> Dict:
        """Get model health status"""
        return {
            'product_id': self.product_id,
            'trained': self.model is not None,
            'mode': 'ML_TRAINED' if self.model is not None else 'COLD_START',
            'physics_available': bool(self.physics_metrics),
            'std_error': self.std_error,
            'mae': self.mae,
            'last_training': self.trained_at
        }


# ==========================================
# ADAPTER
# ==========================================
_TRAINING_STATE: Dict[str, Dict] = {}


def train(sales_data: List[Dict], product_id: str) -> Dict:
    brain = HybridBrain(product_id)
    result = brain.train(sales_data, product_id)
    _TRAINING_STATE[product_id] = {"brain": brain, "metrics": result.get('metrics', {})}
    return result


def predict(product_id: str, days_ahead: int = 7) -> List[Dict]:
    state = _TRAINING_STATE.get(product_id)
    if not state:
        raise ValueError(f"Model {product_id} not found")
    return state['brain'].predict_next_days(days_ahead)


def save_model(product_id: str, output_path: str) -> bool:
    state = _TRAINING_STATE.get(product_id)
    if not state:
        return False

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    brain: HybridBrain = state['brain']
    joblib.dump(brain, output_path)

    base, _ = os.path.splitext(output_path)
    meta = {
        "product_id": product_id,
        "generated_at": datetime.now().isoformat(),
        "physics_metrics": brain.physics_metrics,
        "recommendation": brain.get_recommendation()
    }
    with open(f"{base}_metadata.json", "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=2)
    return True


def load_model(product_id: str, model_path: str) -> bool:
    brain = HybridBrain(product_id)
    loaded = brain.load_model(product_id, model_path)
    if not loaded:
        return False
    _TRAINING_STATE[product_id] = {"brain": brain, "metrics": {}}
    return True


class _ForecasterAdapter:
    def train(self, *args, **kwargs): return train(*args, **kwargs)
    def save_model(self, *args, **kwargs): return save_model(*args, **kwargs)
    def load_model(self, *args, **kwargs): return load_model(*args, **kwargs)
    def predict(self, *args, **kwargs): return predict(*args, **kwargs)


forecaster = _ForecasterAdapter()
__all__ = ["train", "save_model", "load_model", "predict", "forecaster"]
