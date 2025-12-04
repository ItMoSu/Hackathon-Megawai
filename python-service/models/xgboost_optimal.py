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

from config.runtime_config import get_runtime_config

runtime_config = get_runtime_config()

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
        self.last_date: Optional[str] = None
        self.trained_at: Optional[str] = None
        self.mae: float = 0.0
        self.baseline_mae: Optional[float] = None
        self.ensemble_weights: Optional[Dict[str, float]] = None

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
        spans = runtime_config.demand.ema_spans
        weights = runtime_config.demand.ema_weights

        short_span = spans.get('short', 7)
        medium_span = spans.get('medium', 14)
        long_span = spans.get('long', 30)

        d['ema_short'] = d['quantity'].ewm(span=short_span, adjust=False).mean()
        d['ema_medium'] = d['quantity'].ewm(span=medium_span, adjust=False).mean()
        d['ema_long'] = d['quantity'].ewm(span=long_span, adjust=False).mean()

        curr = d.iloc[-1]

        def calc_m(current_ema, lag_val):
            if lag_val == 0 or np.isnan(lag_val):
                return 0.0
            return (current_ema - lag_val) / lag_val

        lag_short = d['ema_short'].shift(short_span).iloc[-1]
        lag_medium = d['ema_medium'].shift(medium_span).iloc[-1]
        lag_long = d['ema_long'].shift(long_span).iloc[-1]

        m_short = calc_m(curr['ema_short'], lag_short)
        m_medium = calc_m(curr['ema_medium'], lag_medium)
        m_long = calc_m(curr['ema_long'], lag_long)

        combined_momentum = (
            (weights.get('short', 0.0) * m_short)
            + (weights.get('medium', 0.0) * m_medium)
            + (weights.get('long', 0.0) * m_long)
        )

        thresholds = runtime_config.demand.momentum_thresholds

        status = 'STABLE'
        if combined_momentum > thresholds.get('up_strong', 0.05):
            status = 'TRENDING_UP'
        elif combined_momentum > thresholds.get('up_mild', 0.02):
            status = 'GROWING'
        elif combined_momentum < thresholds.get('down_strong', -0.05):
            status = 'FALLING'
        elif combined_momentum < thresholds.get('down_mild', -0.02):
            status = 'DECLINING'

        return {
            "momentum7": float(m_short),
            "momentum14": float(m_medium),
            "momentum30": float(m_long),
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
        df = df.copy()
        baseline_window = runtime_config.demand.baseline_window_days
        df['baseline'] = df['quantity'].rolling(window=baseline_window, min_periods=1).mean()

        df['dow'] = df['date'].dt.dayofweek
        dow_stats = df.groupby('dow')['quantity'].mean()
        global_avg = df['quantity'].mean()
        weekend_dows = set(runtime_config.calendar.weekend_dows)

        def get_dow_factor(row):
            if global_avg == 0:
                return 1.0
            return dow_stats.get(row['dow'], global_avg) / global_avg

        def get_payday_factor(date_val: pd.Timestamp):
            day = date_val.day
            for start, end in runtime_config.calendar.payday_ranges:
                if start <= day <= end:
                    return runtime_config.calendar.payday_multiplier
            return 1.0

        def get_special_factor(date_val: pd.Timestamp):
            return runtime_config.calendar.special_boost_dates.get(date_val.strftime('%Y-%m-%d'), 1.0)

        df['expected_full'] = df.apply(
            lambda row: row['baseline']
            * get_dow_factor(row)
            * get_payday_factor(row['date'])
            * get_special_factor(row['date']),
            axis=1
        )

        residuals = df['quantity'] - df['expected_full']
        sigma = residuals.std()
        if sigma == 0 or np.isnan(sigma):
            fallback = global_avg * runtime_config.demand.residual_fallback_ratio
            sigma = fallback if fallback > 0 else 1.0

        last_row = df.iloc[-1]
        expected = last_row['expected_full']
        actual = last_row['quantity']
        dow_factor = get_dow_factor(last_row)

        burst_score = (actual - expected) / sigma

        thresholds = runtime_config.demand.burst_thresholds
        level = 'NORMAL'
        if burst_score > thresholds.get('critical', 3.0):
            level = 'CRITICAL'
        elif burst_score > thresholds.get('significant', 2.0):
            level = 'SIGNIFICANT'
        elif burst_score > thresholds.get('mild', 1.0):
            level = 'MILD'

        burst_type = 'NORMAL'
        if level != 'NORMAL':
            window_days = runtime_config.demand.burst_seasonal_window_days
            cutoff_date = last_row['date'] - pd.Timedelta(days=window_days)
            recent = df[df['date'] >= cutoff_date]
            if not recent.empty:
                weekend_mean = recent[recent['dow'].isin(weekend_dows)]['quantity'].mean()
                weekday_mean = recent[~recent['dow'].isin(weekend_dows)]['quantity'].mean()
            else:
                weekend_mean = weekday_mean = 0

            weekend_bias = (
                weekday_mean > 0
                and last_row['dow'] in weekend_dows
                and weekend_mean >= weekday_mean * runtime_config.demand.weekend_seasonal_ratio
            )

            if weekend_bias:
                burst_type = 'SEASONAL'
            elif burst_score > runtime_config.demand.burst_viral_threshold:
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
                "payday": float(get_payday_factor(last_row['date'])),
                "special": float(get_special_factor(last_row['date']))
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
        weekend_dows = set(runtime_config.calendar.weekend_dows)
        df['is_weekend'] = df['day_of_week'].isin(weekend_dows).astype(int)
        df['lag_1'] = df['quantity'].shift(1).bfill()
        df['lag_7'] = df['quantity'].shift(7).bfill()
        df['roll_mean_7'] = df['quantity'].shift(1).rolling(window=7, min_periods=1).mean().bfill()
        return df

    def _calculate_priority_score(self) -> float:
        momentum = self.physics_metrics.get('momentum', {})
        burst = self.physics_metrics.get('burst', {})
        m_clamp_min = runtime_config.demand.priority_m_clamp_min
        m_clamp_max = runtime_config.demand.priority_m_clamp_max
        norm_m = min(max(momentum.get('combined', 0.0), m_clamp_min), m_clamp_max)

        burst_divisor = runtime_config.demand.priority_burst_divisor or 1.0
        norm_b = burst.get('burst_score', 0.0) / burst_divisor
        norm_b = min(max(norm_b, 0.0), 1.0)

        m_weight = runtime_config.demand.priority_momentum_weight
        b_weight = runtime_config.demand.priority_burst_weight
        return float((m_weight * norm_m) + (b_weight * norm_b))

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
                self.baseline_mae = getattr(loaded_brain, "baseline_mae", None)
                self.ensemble_weights = getattr(loaded_brain, "ensemble_weights", None)
                self.last_date = getattr(loaded_brain, "last_date", None)
            elif isinstance(state, dict):
                self.product_id = state.get('product_id', product_id)
                self.model = state.get('model')
                self.physics_metrics = state.get('physics_metrics', {})
                self.std_error = state.get('std_error', 1.0)
                self.mae = state.get('mae', 0.0)
                self.last_row = state.get('last_row')
                self.is_trained_ml = bool(state.get('is_trained_ml', True))
                self.baseline_mae = state.get('baseline_mae')
                self.ensemble_weights = state.get('ensemble_weights')
                self.last_date = state.get('last_date')
            else:
                logger.error(f"Unsupported model state type: {type(state)}")
                return False

            if self.model is None:
                logger.error(f"Model object is None after loading {model_path}")
                return False

            if self.ensemble_weights is None and self.baseline_mae is not None:
                self.ensemble_weights = self._compute_ensemble_weights()

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

        self.last_date = df['date'].iloc[-1].isoformat()

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
        baseline_preds = train_df['roll_mean_7']
        self.baseline_mae = float(np.mean(np.abs(baseline_preds - y)))
        self.trained_at = datetime.now().isoformat()

        self.ensemble_weights = self._compute_ensemble_weights()

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

    def _compute_ensemble_weights(self) -> Dict[str, float]:
        """More aggressive rule weighting for volatile products"""
        default_ml = runtime_config.demand.ensemble_ml_weight_default
        min_ml = runtime_config.demand.ensemble_ml_weight_min
        max_ml = runtime_config.demand.ensemble_ml_weight_max

        baseline_mae = self.baseline_mae
        ml_mae = self.mae

        if baseline_mae is None or baseline_mae <= 0 or ml_mae is None:
            ml_weight = default_ml
        else:
            improvement = max(0.0, min(1.0, 1.0 - (ml_mae / baseline_mae)))
            ml_weight = min_ml + (max_ml - min_ml) * improvement

        # ✅ UPDATED: More aggressive CV penalty
        if hasattr(self, 'last_row') and self.last_row:
            baseline = self.last_row.get('roll_mean_7', 0)
            if baseline > 0 and self.std_error > 0:
                cv = self.std_error / baseline
                
                # High CV → Much more rules, less ML
                if cv > 0.6:  # CV > 60% (very volatile)
                    penalty = 0.45  # 35% penalty
                    ml_weight = max(min_ml, ml_weight - penalty)
                    logger.info(f"Very high CV ({cv:.1%}), reducing ML to {ml_weight:.1%}")
                elif cv > 0.5:  # CV 50-60%
                    penalty = 0.35  # 25% penalty
                    ml_weight = max(min_ml, ml_weight - penalty)
                    logger.info(f"High CV ({cv:.1%}), reducing ML to {ml_weight:.1%}")
                elif cv > 0.4:  # CV 40-50%
                    penalty = 0.25  # 15% penalty
                    ml_weight = max(min_ml, ml_weight - penalty)
                    logger.info(f"Moderate CV ({cv:.1%}), reducing ML to {ml_weight:.1%}")

        ml_weight = min(max(ml_weight, min_ml), max_ml)
        rule_weight = 1.0 - ml_weight
        
        logger.info(f"Final weights: ML={ml_weight:.1%}, Rules={rule_weight:.1%}")
        
        return {"ml": ml_weight, "rule": rule_weight}

    def _cold_start_train(self, df: pd.DataFrame):
        """Minimal fallback (legacy)"""
        self.is_trained_ml = False
        self.rules_metadata = {'status': 'COLD_START', 'level': 'NORMAL', 'priority_score': 0}
        self.last_row = df.iloc[-1].to_dict() if not df.empty else {}
        return {"metrics": {"validation": {"mae": 0}}, "mode": "COLD_START"}

    def _cold_start_mode(self, df: pd.DataFrame) -> Dict:
        """Handle cold start with rules only"""
        logger.info("Using rule-based forecasting (cold start)")

        mean_qty = max(df['quantity'].mean(), 1.0)  # ✅ Ensure non-zero
        std_qty = df['quantity'].std()

        self.is_trained_ml = False
        self.std_error = float(std_qty) if std_qty > 0 else float(mean_qty * 0.2)
        
        last_dt = df['date'].iloc[-1] if 'date' in df.columns else pd.Timestamp.now()
        self.last_date = pd.to_datetime(last_dt).isoformat()
        day_of_week = pd.to_datetime(last_dt).dayofweek
        weekend_dows = set(runtime_config.calendar.weekend_dows)
        
        # ✅ Safe last_row with guaranteed non-zero values
        last_quantity = max(df['quantity'].iloc[-1], 1.0)
        lag_7_val = max(df['quantity'].iloc[-7], mean_qty) if len(df) >= 7 else mean_qty
        
        self.last_row = {
            'roll_mean_7': float(mean_qty),
            'lag_1': float(last_quantity),
            'lag_7': float(lag_7_val),
            'day_of_week': day_of_week,
            'day_of_month': pd.to_datetime(last_dt).day,
            'is_weekend': int(day_of_week in weekend_dows)
        }
        
        logger.info(f"Cold start last_row: {self.last_row}")  # ✅ Debug log
        
        self.baseline_mae = None
        self.ensemble_weights = {"ml": 0.0, "rule": 1.0}

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
        weekend_dows = set(runtime_config.calendar.weekend_dows)
        
        # SAFE DEFAULTS - prevent zero predictions
        safe_roll_mean = current_row.get('roll_mean_7', 0)
        if safe_roll_mean <= 0:
            # Fallback to lag_1 or a minimum baseline
            safe_roll_mean = max(
                current_row.get('lag_1', 0),
                current_row.get('lag_7', 0),
                1.0  # Minimum baseline
            )
        
        safe_lag_1 = current_row.get('lag_1', safe_roll_mean)
        safe_lag_7 = current_row.get('lag_7', safe_roll_mean)
        
        return {
            'day_of_week': next_date.dayofweek,
            'day_of_month': next_date.day,
            'is_weekend': 1 if next_date.dayofweek in weekend_dows else 0,
            'lag_1': max(safe_lag_1, 0.1),  # Ensure non-zero
            'lag_7': max(safe_lag_7, 0.1),  # Ensure non-zero
            'roll_mean_7': max(safe_roll_mean, 0.1)  # Ensure non-zero
        }
        
    def predict_next_days(self, days: int = 7) -> List[Dict]:
        """
        Predict next N days using hybrid approach with validation and smoothing
        """
        if days < 1 or days > 30:
            raise ValueError("Days must be between 1 and 30")
        if not self.last_row:
            raise ValueError("Model not trained. Call train() first.")

        # Validation
        required_keys = ['roll_mean_7', 'lag_1', 'lag_7']
        for key in required_keys:
            if key not in self.last_row or self.last_row[key] is None:
                logger.warning(f"Missing {key} in last_row, using fallback")
                baseline = self.physics_metrics.get('burst', {}).get('factors', {}).get('baseline', 1.0)
                self.last_row[key] = max(baseline, 1.0)
        
        for key in required_keys:
            if self.last_row[key] <= 0:
                self.last_row[key] = 1.0
        
        logger.info(f"Predicting {days} days for product: {self.product_id or 'unknown'}")
        logger.info(f"Starting from last_row: {self.last_row}")

        predictions: List[Dict] = []

        if self.model is not None and self.is_trained_ml:
            weights = self.ensemble_weights or {
                "ml": runtime_config.demand.ensemble_ml_weight_default,
                "rule": 1.0 - runtime_config.demand.ensemble_ml_weight_default
            }
            ml_weight = weights.get("ml", runtime_config.demand.ensemble_ml_weight_default)
            rule_weight = max(0.0, 1.0 - ml_weight)
            confidence = 'HIGH' if ml_weight >= runtime_config.demand.ensemble_high_conf_threshold else 'MEDIUM'
        else:
            ml_weight, rule_weight, confidence = 0.0, 1.0, 'MEDIUM'

        combined_momentum = 0.0
        if self.physics_metrics:
            combined_momentum = self.physics_metrics.get('momentum', {}).get('combined', 0.0)
        elif self.rules_metadata:
            combined_momentum = self.rules_metadata.get('combined', 0.0)

        trend_factor = 1.0 + (combined_momentum * runtime_config.demand.trend_factor_scale)
        current_row = self.last_row.copy()

        base_date = pd.Timestamp.now()
        if self.last_date:
            try:
                base_date = pd.to_datetime(self.last_date)
            except Exception:
                base_date = pd.Timestamp.now()

        smoothing_frac = runtime_config.demand.smoothing_max_change_fraction
        min_qty = runtime_config.demand.min_prediction_quantity
        weekend_dows = set(runtime_config.calendar.weekend_dows)
        uncertainty_z = runtime_config.demand.forecast_uncertainty_z

        for i in range(days):
            pred_date = base_date + pd.Timedelta(days=i + 1)
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
                max_change = prev_pred * smoothing_frac
                final_pred = max(prev_pred - max_change, min(prev_pred + max_change, final_pred))

            final_pred = max(min_qty, round(final_pred, 1))
            uncertainty = uncertainty_z * self.std_error
            lower_bound = max(0, round(final_pred - uncertainty, 1))
            upper_bound = round(final_pred + uncertainty, 1)

            predictions.append({
                'date': pred_date.strftime('%Y-%m-%d'),
                'predicted_quantity': final_pred,
                'lower_bound': lower_bound,
                'upper_bound': upper_bound,
                'confidence': confidence,
                'day_of_week': pred_date.dayofweek,
                'is_weekend': pred_date.dayofweek in weekend_dows
            })

            current_row['lag_1'] = final_pred
            if i >= 6:
                current_row['lag_7'] = predictions[i - 6]['predicted_quantity']
            current_row['roll_mean_7'] = float(np.mean([p['predicted_quantity'] for p in predictions[max(0, i - 6):i + 1]]))
            current_row['day_of_week'] = pred_date.dayofweek
            current_row['day_of_month'] = pred_date.day
            current_row['is_weekend'] = int(pred_date.dayofweek in weekend_dows)

        # ✅ NEW: Sanity check - cap extreme deviations
        pred_values = [p['predicted_quantity'] for p in predictions]
        pred_mean = sum(pred_values) / len(pred_values) if pred_values else 0
        baseline = self.last_row.get('roll_mean_7', pred_mean)
        
        if baseline > 0 and pred_mean > 0:
            deviation = abs(pred_mean - baseline) / baseline
            if deviation > 1.0:  # >100% deviation from recent average
                logger.warning(f"Predictions deviate {deviation:.0%} from baseline ({baseline:.1f}), capping to ±50%...")
                # Cap to ±50% of baseline
                scale_factor = min(1.5, max(0.5, baseline / pred_mean))
                for p in predictions:
                    p['predicted_quantity'] = round(p['predicted_quantity'] * scale_factor, 1)
                    p['lower_bound'] = max(0, round(p['lower_bound'] * scale_factor, 1))
                    p['upper_bound'] = round(p['upper_bound'] * scale_factor, 1)

        validated = self._validate_predictions(predictions)
        pred_values = [p['predicted_quantity'] for p in validated] if validated else []
        if pred_values:
            logger.info(f"Generated predictions: {pred_values}")
            logger.info(f"Prediction range: {min(pred_values):.1f} - {max(pred_values):.1f}")
        return validated
    
    def get_recommendation(self) -> Dict:
        """
        Generate stock recommendation based on current state
        Returns basic recommendation for training validation
        """
        if not self.last_row:
            return {
                'status': 'NO_DATA',
                'message': 'Insufficient data for recommendation'
            }
        
        baseline = self.last_row.get('roll_mean_7', 0)
        
        # Simple recommendation based on momentum
        momentum_status = 'STABLE'
        if self.physics_metrics:
            momentum_status = self.physics_metrics.get('momentum', {}).get('status', 'STABLE')
        
        if momentum_status in ['TRENDING_UP', 'GROWING']:
            recommendation = f"Consider increasing stock by 20-30%. Current avg: {baseline:.1f} units/day"
        elif momentum_status in ['FALLING', 'DECLINING']:
            recommendation = f"Consider reducing stock by 10-20%. Current avg: {baseline:.1f} units/day"
        else:
            recommendation = f"Maintain current stock levels. Current avg: {baseline:.1f} units/day"
        
        return {
            'status': momentum_status,
            'message': recommendation,
            'baseline': baseline
        }
        
    def save_model(self, product_id: str, model_path: str) -> bool:
        """
        Save trained model and metadata to disk
        
        Args:
            product_id: Product identifier
            model_path: Path to save the model file (.pkl)
            
        Returns:
            True if successful, False otherwise
        """
        if self.model is None and not self.is_trained_ml:
            logger.error("No model to save")
            return False
        
        try:
            import pickle
            
            # Create directory if needed
            os.makedirs(os.path.dirname(model_path), exist_ok=True)
            
            # Save using joblib (same as your load_model expects)
            joblib.dump(self, model_path)
            
            # Save metadata separately
            base, _ = os.path.splitext(model_path)
            meta = {
                "product_id": product_id,
                "generated_at": datetime.now().isoformat(),
                "mae": float(self.mae),
                "baseline_mae": float(self.baseline_mae) if self.baseline_mae else None,
                "std_error": float(self.std_error),
                "physics_metrics": self.physics_metrics,
                "ensemble_weights": self.ensemble_weights,
                "recommendation": self.get_recommendation()
            }
            
            with open(f"{base}_metadata.json", "w", encoding="utf-8") as f:
                json.dump(meta, f, indent=2)
            
            logger.info(f"Model saved to {model_path}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to save model: {e}", exc_info=True)
            return False

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

    def _extract_mae(state_obj) -> Optional[float]:
        if isinstance(state_obj, HybridBrain):
            return getattr(state_obj, "mae", None)
        if isinstance(state_obj, dict):
            return state_obj.get("mae")
        return None

    existing_mae: Optional[float] = None
    if os.path.exists(output_path):
        try:
            existing_state = joblib.load(output_path)
            existing_mae = _extract_mae(existing_state)
        except Exception as e:
            logger.warning(f"Could not load existing model for comparison: {e}")

    new_mae = brain.mae
    if existing_mae is not None and new_mae is not None and new_mae >= existing_mae:
        logger.info(
            f"Skip saving model {product_id}: new MAE {new_mae:.4f} "
            f"is not better than existing {existing_mae:.4f}"
        )
        return False

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
