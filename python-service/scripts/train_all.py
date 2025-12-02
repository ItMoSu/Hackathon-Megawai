#!/usr/bin/env python3
import os
import sys
import json
from datetime import datetime

import requests

sys.path.append(os.path.dirname(os.path.dirname(__file__)))

BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:5000")
ML_SERVICE_URL = os.getenv("ML_SERVICE_URL", "http://localhost:8000")


def fetch_all_products():
  """Get all products from backend."""
  try:
    response = requests.get(f"{BACKEND_URL}/api/products")
    if response.ok:
      body = response.json()
      # backend current shape: { success, data: [...] }
      if isinstance(body, dict):
        return body.get("data") or body.get("products") or []
  except Exception as exc:
    print(f"   Error fetching products: {exc}")
  return []


def fetch_sales_data(product_id: str, days: int = 90):
  """Get sales data for product; falls back to empty list on error."""
  try:
    response = requests.get(f"{BACKEND_URL}/api/products/{product_id}/sales", params={"days": days})
    if response.ok:
      body = response.json()
      return body.get("sales") or body.get("data") or []
  except Exception as exc:
    print(f"   Error fetching sales for {product_id}: {exc}")
  return []


def train_product(product_id: str, sales_data: list):
  """Train ML model for a single product."""
  response = requests.post(
    f"{ML_SERVICE_URL}/api/ml/train",
    json={
      "productId": product_id,
      "salesData": [{"date": s["date"], "quantity": s.get("quantity", s.get("qty", 0))} for s in sales_data],
    },
    timeout=30,
  )
  return response.json()


def main():
  print("=" * 60)
  print("AI MARKET PULSE - OFFLINE BATCH TRAINING")
  print("=" * 60)
  print(f"Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")

  products = fetch_all_products()
  if not products:
    print("❌ No products found or backend unavailable\n")
    return

  print(f"Found {len(products)} products\n")

  results = {"success": [], "skipped": [], "failed": []}

  for i, product in enumerate(products, 1):
    product_id = product.get("id")
    product_name = product.get("name", "Unknown")

    print(f"[{i}/{len(products)}] {product_name}")
    print(f"  ID: {product_id}")

    sales = fetch_sales_data(product_id, 90)
    print(f"  Data: {len(sales)} days")

    if len(sales) < 30:
      print(f"  ⚠️  SKIPPED: Need 30+ days\n")
      results["skipped"].append(
        {"product_id": product_id, "name": product_name, "reason": f"Only {len(sales)} days"}
      )
      continue

    try:
      result = train_product(product_id, sales)

      if result.get("success"):
        metrics = result.get("metrics", {}) or result.get("model", {}).get("metrics", {})
        val_mae = (
          metrics.get("validation", {}).get("mae")
          if isinstance(metrics, dict)
          else None
        )
        best_iter = result.get("best_iteration") or result.get("model", {}).get("best_iteration", "N/A")
        print("  ✅ SUCCESS")
        if val_mae is not None:
          print(f"     Val MAE: {val_mae:.2f}")
        print(f"     Best iter: {best_iter}\n")

        results["success"].append({"product_id": product_id, "name": product_name, "val_mae": val_mae})
      else:
        error = result.get("error", "Unknown")
        print(f"  ❌ FAILED: {error}\n")
        results["failed"].append({"product_id": product_id, "name": product_name, "error": error})

    except Exception as exc:
      print(f"  ❌ ERROR: {exc}\n")
      results["failed"].append({"product_id": product_id, "name": product_name, "error": str(exc)})

  print("=" * 60)
  print("SUMMARY")
  print("=" * 60)
  print(f"Total products: {len(products)}")
  print(f"✅ Success: {len(results['success'])}")
  print(f"⚠️  Skipped: {len(results['skipped'])}")
  print(f"❌ Failed: {len(results['failed'])}")

  if results["success"]:
    vals = [r["val_mae"] for r in results["success"] if r.get("val_mae") is not None]
    if vals:
      avg_mae = sum(vals) / len(vals)
      print(f"\nAverage Validation MAE: {avg_mae:.2f}")

  print(f"\nCompleted: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
  print("=" * 60)

  os.makedirs("logs", exist_ok=True)
  log_file = f"logs/training_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
  with open(log_file, "w", encoding="utf-8") as f:
    json.dump(results, f, indent=2)
  print(f"\n📝 Results saved: {log_file}")


if __name__ == "__main__":
  main()
