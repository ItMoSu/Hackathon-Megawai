#!/usr/bin/env python3
"""
Auto-discovery visualization for Hybrid Triple Intelligence models.
Scans models_output for .pkl files, matches preprocessed CSVs, and plots history vs forecast with a bridge.
Supports exporting per-product PNGs or a single combined PDF with one page per product.
"""

import argparse
import glob
import os
import sys
from typing import Optional, Tuple

import joblib
import matplotlib.dates as mdates
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from matplotlib.backends.backend_pdf import PdfPages
from matplotlib.ticker import MaxNLocator

# Style
plt.style.use("bmh")

# Path setup to import HybridBrain
BASE_DIR = os.path.dirname(__file__)
PARENT_DIR = os.path.abspath(os.path.join(BASE_DIR, ".."))
if PARENT_DIR not in sys.path:
    sys.path.append(PARENT_DIR)

try:
    from models.xgboost_optimal import HybridBrain  # noqa: E402
except ImportError:
    HybridBrain = None
    print("HybridBrain is not available. Run this script from python-service/training.")


def find_csv_for_model(model_path: str, preprocessed_dir: str) -> Optional[str]:
    """Find a CSV in preprocessed_dir whose filename contains the product id."""
    base = os.path.basename(model_path)
    product_id = base.replace(".pkl", "")
    # strip known prefix/suffix patterns
    product_id = product_id.replace("xgboost_", "").replace("_default", "")
    for csv_path in glob.glob(os.path.join(preprocessed_dir, "*.csv")):
        if product_id.lower() in os.path.basename(csv_path).lower():
            return csv_path
    return None


def detect_columns(df: pd.DataFrame) -> Tuple[str, str]:
    """Detect date and quantity columns with fallbacks."""
    cols = list(df.columns)
    lower = [c.lower() for c in cols]

    date_col = None
    for c, lc in zip(cols, lower):
        if "date" in lc:
            date_col = c
            break
    if date_col is None:
        date_col = cols[0]

    qty_col = None
    for c, lc in zip(cols, lower):
        if "quantity" == lc or lc.endswith("quantity") or "qty" == lc or lc.endswith("qty"):
            qty_col = c
            break
    if qty_col is None:
        numeric_cols = df.select_dtypes(include=[np.number]).columns
        qty_col = numeric_cols[-1] if len(numeric_cols) else cols[-1]

    return date_col, qty_col


def render_forecast_figure(product_id: str, history_df: pd.DataFrame, pred_df: pd.DataFrame):
    """Render a matplotlib figure for the history and forecast with a bridge between them."""
    fig, ax = plt.subplots(figsize=(12, 6))

    # History
    ax.plot(
        history_df["date"],
        history_df["quantity"],
        color="grey",
        linestyle="--",
        marker="o",
        label="History (last 60d)",
    )

    # Bridge point
    bridge_x = history_df["date"].iloc[-1]
    bridge_y = history_df["quantity"].iloc[-1]

    # Prepend bridge point to forecast arrays
    pred_dates = pd.concat([pd.Series([bridge_x]), pred_df["date"]], ignore_index=True)
    pred_values = pd.concat([pd.Series([bridge_y]), pred_df["predicted_quantity"]], ignore_index=True)
    if {"range_low", "range_high"}.issubset(pred_df.columns):
        pred_low = pd.concat([pd.Series([bridge_y]), pred_df["range_low"]], ignore_index=True)
        pred_high = pd.concat([pd.Series([bridge_y]), pred_df["range_high"]], ignore_index=True)
    else:
        pred_low = pred_values
        pred_high = pred_values

    ax.plot(pred_dates, pred_values, color="blue", linewidth=3, label="Forecast")
    ax.fill_between(pred_dates, pred_low, pred_high, color="blue", alpha=0.2, label="Confidence Interval")
    ax.plot(bridge_x, bridge_y, "o", color="orange", label="Current Date")

    ax.set_title(f"Forecast Analysis: {product_id}")
    ax.set_xlabel("Date")
    ax.set_ylabel("Quantity")
    ax.xaxis.set_major_formatter(mdates.DateFormatter("%d-%b"))
    ax.yaxis.set_major_locator(MaxNLocator(integer=True))
    plt.xticks(rotation=45, ha="right")
    ax.grid(True, linestyle="--", alpha=0.5)
    ax.legend()
    plt.tight_layout()
    return fig


def plot_forecast(product_id: str, history_df: pd.DataFrame, pred_df: pd.DataFrame, out_path: str):
    """Plot history and forecast and save to disk."""
    fig = render_forecast_figure(product_id, history_df, pred_df)
    plt.savefig(out_path, dpi=150)
    plt.close(fig)


def load_history_and_forecast_data(
    model_path: str, preprocessed_dir: str, forecast_days: int = 14
) -> Optional[Tuple[str, pd.DataFrame, pd.DataFrame]]:
    """Load history and forecast data for a model. Returns (product_id, history_df, pred_df) or None."""
    if HybridBrain is None:
        return None

    csv_path = find_csv_for_model(model_path, preprocessed_dir)
    if not csv_path:
        print(f"[WARN] No matching CSV for model {os.path.basename(model_path)}")
        return None

    try:
        df = pd.read_csv(csv_path)
    except Exception as e:
        print(f"[WARN] Failed to read {csv_path}: {e}")
        return None

    date_col, qty_col = detect_columns(df)
    df[date_col] = pd.to_datetime(df[date_col], errors="coerce")
    df[qty_col] = pd.to_numeric(df[qty_col], errors="coerce")
    df = df.dropna(subset=[date_col, qty_col]).sort_values(date_col)
    if df.empty:
        print(f"[WARN] No valid data in {csv_path}")
        return None

    history = df[[date_col, qty_col]].tail(60).rename(columns={date_col: "date", qty_col: "quantity"})

    try:
        brain: HybridBrain = joblib.load(model_path)
    except Exception as e:
        print(f"[WARN] Failed to load model {model_path}: {e}")
        return None

    try:
        preds = brain.predict_next_days(forecast_days)
    except Exception as e:
        print(f"[WARN] Prediction failed for {model_path}: {e}")
        return None

    pred_df = pd.DataFrame(preds)
    pred_df["date"] = pd.to_datetime(pred_df["date"])
    for col in ("predicted_quantity", "range_low", "range_high"):
        if col in pred_df.columns:
            pred_df[col] = pred_df[col].round().astype(int)

    product_id = os.path.basename(model_path).replace(".pkl", "")
    return product_id, history, pred_df


def process_model(model_path: str, preprocessed_dir: str, output_dir: str, forecast_days: int = 14) -> bool:
    """Load model, match CSV, forecast, and chart to a PNG file."""
    data = load_history_and_forecast_data(model_path, preprocessed_dir, forecast_days)
    if not data:
        return False

    product_id, history, pred_df = data
    os.makedirs(output_dir, exist_ok=True)
    out_path = os.path.join(output_dir, f"chart_{product_id}.png")
    plot_forecast(product_id, history, pred_df, out_path)
    print(f"[OK] Saved {out_path}")
    return True


def generate_combined_pdf(model_files, preprocessed_dir: str, output_pdf: str, forecast_days: int = 14) -> int:
    """Generate a single PDF with one page per product forecast."""
    if not model_files:
        print("No model files to process.")
        return 0

    os.makedirs(os.path.dirname(output_pdf), exist_ok=True)
    total = 0

    with PdfPages(output_pdf) as pdf:
        for model_path in model_files:
            data = load_history_and_forecast_data(model_path, preprocessed_dir, forecast_days)
            if not data:
                continue

            product_id, history, pred_df = data
            fig = render_forecast_figure(product_id, history, pred_df)
            pdf.savefig(fig)
            plt.close(fig)
            total += 1

    print(f"[OK] Combined report saved to {output_pdf} with {total} plot(s).")
    return total


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Visualize forecasts for all trained models.")
    parser.add_argument("--days", type=int, default=14, help="Forecast horizon in days.")
    parser.add_argument(
        "--combined",
        action="store_true",
        help="Save all plots into a single PDF instead of per-product PNGs.",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Limit number of models to visualize (for quick tests).",
    )
    return parser.parse_args()


def main():
    args = parse_args()

    models_dir = os.path.join(BASE_DIR, "models_output")
    data_dir = os.path.join(BASE_DIR, "preprocessed")
    output_dir = os.path.join(BASE_DIR, "charts")
    os.makedirs(output_dir, exist_ok=True)

    model_files = sorted(glob.glob(os.path.join(models_dir, "*.pkl")))
    if args.limit:
        model_files = model_files[: args.limit]

    if not model_files:
        print("No model files found in models_output/.")
        return

    if args.combined:
        output_pdf = os.path.join(output_dir, "combined_forecasts.pdf")
        total = generate_combined_pdf(model_files, data_dir, output_pdf, args.days)
        print(f"\nGenerated {total} chart(s) into {output_pdf}.")
        return

    total = 0
    for model_path in model_files:
        if process_model(model_path, data_dir, output_dir, args.days):
            total += 1

    print(f"\nGenerated {total} chart(s).")


if __name__ == "__main__":
    main()
