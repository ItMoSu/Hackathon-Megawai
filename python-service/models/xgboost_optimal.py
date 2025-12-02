from __future__ import annotations

from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Optional, Sequence, Tuple

import joblib
import json
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from xgboost import XGBRegressor

MIN_TRAINING_DAYS = 30
PAYDAY_DAYS = {*range(25, 32), *range(1, 6)}


class OptimalXGBoostForecaster:
    """
    Train and serve quantile XGBoost forecasters (P10, P50, P90)
    with robust feature engineering for small retail datasets.
    """

    def __init__(self) -> None:
        self.models: Dict[str, Dict[str, XGBRegressor]] = {}
        self.feature_cols: List[str] = [
            "day_of_week",
            "day_of_month",
            "week_of_month",
            "is_weekend",
            "is_payday",
            "sales_lag_1",
            "sales_lag_7",
            "sales_lag_14",
            "rolling_mean_7",
            "rolling_mean_14",
            "rolling_std_7",
            "trend",
        ]
        self.history_cache: Dict[str, pd.DataFrame] = {}
        self.models_dir = (Path(__file__).resolve().parent / ".." / "models").resolve()

    def _normalize_dataframe(self, sales_data: Sequence[dict]) -> pd.DataFrame:
        df = pd.DataFrame(sales_data)
        if df.empty:
            return df

        qty_col = (
            "quantity"
            if "quantity" in df.columns
            else "qty"
            if "qty" in df.columns
            else None
        )
        if qty_col is None:
            raise ValueError("salesData must include a quantity/qty field")

        df = df.rename(columns={qty_col: "quantity"})
        df["date"] = pd.to_datetime(df["date"])
        df["quantity"] = pd.to_numeric(df["quantity"], errors="coerce").fillna(0)
        df = df.sort_values("date")
        df = df.groupby("date", as_index=False)["quantity"].sum()
        return df

    def _fill_missing_dates(self, df: pd.DataFrame) -> pd.DataFrame:
        if df.empty:
            return df
        date_range = pd.date_range(df["date"].min(), df["date"].max(), freq="D")
        dense = (
            df.set_index("date")
            .reindex(date_range, fill_value=0)
            .rename_axis("date")
            .reset_index()
        )
        return dense

    def create_features(self, df: pd.DataFrame) -> pd.DataFrame:
        data = df.copy()
        if data.empty:
            return data

        data["date"] = pd.to_datetime(data["date"])
        data = data.sort_values("date")

        data["day_of_week"] = data["date"].dt.dayofweek
        data["day_of_month"] = data["date"].dt.day
        data["week_of_month"] = (data["day_of_month"] - 1) // 7 + 1
        data["is_weekend"] = data["day_of_week"].isin([5, 6]).astype(int)
        data["is_payday"] = data["day_of_month"].isin(PAYDAY_DAYS).astype(int)

        data["sales_lag_1"] = data["quantity"].shift(1)
        data["sales_lag_7"] = data["quantity"].shift(7)
        data["sales_lag_14"] = data["quantity"].shift(14)

        shifted_qty = data["quantity"].shift(1)
        data["rolling_mean_7"] = shifted_qty.rolling(window=7, min_periods=1).mean()
        data["rolling_mean_14"] = shifted_qty.rolling(window=14, min_periods=1).mean()
        data["rolling_std_7"] = shifted_qty.rolling(window=7, min_periods=1).std()

        data["trend"] = data["rolling_mean_7"] - data["rolling_mean_14"]

        data[self.feature_cols] = data[self.feature_cols].fillna(method="bfill").fillna(
            method="ffill"
        ).fillna(0)
        return data

    def _base_model_params(self) -> Dict:
        return {
            "max_depth": 4,
            "n_estimators": 100,
            "subsample": 0.8,
            "learning_rate": 0.1,
            "random_state": 42,
        }

    def train(
        self, sales_data: Sequence[dict], product_id: str
    ) -> Dict[str, Optional[str]]:
        df = self._normalize_dataframe(sales_data)
        if df.empty:
            raise ValueError("Sales data is empty; cannot train model.")
        if len(df) < MIN_TRAINING_DAYS:
            raise ValueError(
                f"Need at least {MIN_TRAINING_DAYS} days of data; got {len(df)} days."
            )

        dense_df = self._fill_missing_dates(df)
        feature_df = self.create_features(dense_df)

        X = feature_df[self.feature_cols]
        y = feature_df["quantity"]

        X_train, X_val, y_train, y_val = train_test_split(
            X, y, test_size=0.2, shuffle=False
        )

        models: Dict[str, XGBRegressor] = {}

        model_p10 = XGBRegressor(
            objective="reg:quantileerror",
            quantile_alpha=0.1,
            max_depth=4,
            learning_rate=0.1,
            n_estimators=200,
            subsample=0.8,
            colsample_bytree=0.8,
            min_child_weight=3,
            early_stopping_rounds=15,
            random_state=42,
        )
        model_p10.fit(
            X_train,
            y_train,
            eval_set=[(X_val, y_val)],
            verbose=False,
        )
        models["p10"] = model_p10

        model_p50 = XGBRegressor(
            objective="reg:squarederror",
            max_depth=4,
            learning_rate=0.1,
            n_estimators=200,
            subsample=0.8,
            colsample_bytree=0.8,
            min_child_weight=3,
            early_stopping_rounds=15,
            random_state=42,
        )
        model_p50.fit(
            X_train,
            y_train,
            eval_set=[(X_val, y_val)],
            verbose=False,
        )
        models["p50"] = model_p50

        model_p90 = XGBRegressor(
            objective="reg:quantileerror",
            quantile_alpha=0.9,
            max_depth=4,
            learning_rate=0.1,
            n_estimators=200,
            subsample=0.8,
            colsample_bytree=0.8,
            min_child_weight=3,
            early_stopping_rounds=15,
            random_state=42,
        )
        model_p90.fit(
            X_train,
            y_train,
            eval_set=[(X_val, y_val)],
            verbose=False,
        )
        models["p90"] = model_p90

        val_pred_p50 = model_p50.predict(X_val)
        mae_val = np.mean(np.abs(y_val - val_pred_p50))
        rmse_val = np.sqrt(np.mean((y_val - val_pred_p50) ** 2))

        train_pred = model_p50.predict(X)
        mae_train = np.mean(np.abs(y - train_pred))
        rmse_train = np.sqrt(np.mean((y - train_pred) ** 2))

        training_metadata = {
            "product_id": product_id,
            "trained_at": datetime.now().isoformat(),
            "data_points": len(dense_df),
            "train_size": len(X_train),
            "val_size": len(X_val),
            "best_iteration": int(model_p50.best_iteration) if hasattr(model_p50, "best_iteration") else None,
            "metrics": {
                "train": {"mae": float(mae_train), "rmse": float(rmse_train)},
                "validation": {"mae": float(mae_val), "rmse": float(rmse_val)},
            },
            "feature_importance": dict(
                zip(self.feature_cols, [float(x) for x in model_p50.feature_importances_])
            ),
        }

        self.models[product_id] = {
            "models": models,
            "feature_cols": self.feature_cols,
            "last_data": dense_df[["date", "quantity"]].tail(30),
            "metadata": training_metadata,
        }
        self.history_cache[product_id] = dense_df[["date", "quantity"]].copy()
        self.save_model(product_id)

        return {
            "success": True,
            "product_id": product_id,
            "data_points": len(dense_df),
            "train_size": len(X_train),
            "val_size": len(X_val),
            "best_iteration": training_metadata["best_iteration"],
            "metrics": training_metadata["metrics"],
            "feature_importance": training_metadata["feature_importance"],
        }

    def _confidence_from_quantiles(self, lower: float, median: float, upper: float) -> str:
        width = max(upper - lower, 0.0)
        denom = max(abs(median), 1.0)
        ratio = width / denom
        if ratio < 0.2:
            return "HIGH"
        if ratio < 0.4:
            return "MEDIUM"
        return "LOW"

    def predict(
        self, product_id: str, days: int = 7
    ) -> Tuple[List[dict], int]:
        if product_id not in self.models:
            self.load_model(product_id)

        if product_id not in self.models or product_id not in self.history_cache:
            raise ValueError(f"No trained model found for product {product_id}")

        container = self.models[product_id]
        models = container.get("models", {})

        history = self.history_cache[product_id].copy()
        history["date"] = pd.to_datetime(history["date"])
        history = self._fill_missing_dates(history)

        preds: List[dict] = []
        for _ in range(days):
            next_date = history["date"].max() + timedelta(days=1)
            candidate = pd.DataFrame([{"date": next_date, "quantity": np.nan}])
            extended = pd.concat([history, candidate], ignore_index=True)
            features = self.create_features(extended)
            feature_row = features.iloc[-1:][self.feature_cols]

            p10 = float(models["p10"].predict(feature_row)[0])
            p50 = float(models["p50"].predict(feature_row)[0])
            p90 = float(models["p90"].predict(feature_row)[0])

            p10 = max(p10, 0.0)
            p50 = max(p50, 0.0)
            p90 = max(p90, p50)

            preds.append(
                {
                    "date": next_date.date().isoformat(),
                    "lower_bound": p10,
                    "predicted_quantity": p50,
                    "upper_bound": p90,
                    "confidence": self._confidence_from_quantiles(p10, p50, p90),
                }
            )

            history = pd.concat(
                [history, pd.DataFrame([{"date": next_date, "quantity": p50}])],
                ignore_index=True,
            )

        return preds, len(self.history_cache[product_id])

    def save_model(self, product_id: str) -> Path:
        self.models_dir.mkdir(parents=True, exist_ok=True)
        payload = self.models.get(product_id)
        if not payload:
            raise ValueError(f"Model not found for {product_id}")
        model_path = self.models_dir / f"xgboost_{product_id}.pkl"
        joblib.dump(payload, model_path)

        metadata_path = model_path.with_name(f"xgboost_{product_id}_metadata.json")
        metadata = payload.get("metadata", {})
        with open(metadata_path, "w", encoding="utf-8") as f:
            json.dump(metadata, f, indent=2)

        return model_path

    def save_model_with_path(self, product_id: str, filepath: str) -> None:
        """Save trained models with metadata"""
        if product_id not in self.models:
            raise ValueError(f"Model not found for product {product_id}")
        joblib.dump(self.models[product_id], filepath)
        metadata_path = filepath.replace(".pkl", "_metadata.json")
        with open(metadata_path, "w", encoding="utf-8") as f:
            json.dump(self.models[product_id].get("metadata", {}), f, indent=2)

    def load_model(self, product_id: str) -> None:
        model_path = self.models_dir / f"xgboost_{product_id}.pkl"
        if not model_path.exists():
            raise ValueError(f"Model file not found for {product_id}")
        payload = joblib.load(model_path)
        models = payload.get("models")
        history = payload.get("last_data") or payload.get("history")
        if models is None or history is None:
            raise ValueError(f"Corrupted model file for {product_id}")
        self.models[product_id] = payload
        self.history_cache[product_id] = history


forecaster = OptimalXGBoostForecaster()
