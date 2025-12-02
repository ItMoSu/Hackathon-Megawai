import json
import random
from datetime import date, timedelta
from typing import List
from urllib import request, parse, error

BASE_URL = "http://localhost:8000"


def generate_test_data(days: int = 60) -> List[dict]:
    today = date.today()
    data = []
    for i in range(days):
        d = today - timedelta(days=days - i)
        seasonality = 1.2 if d.weekday() in (4, 5) else 0.9
        qty = int(max(10, random.gauss(80, 10) * seasonality))
        data.append({"date": d.isoformat(), "quantity": qty})
    return data


def _post_json(path: str, payload: dict) -> dict:
    body = json.dumps(payload).encode("utf-8")
    req = request.Request(
        f"{BASE_URL}{path}",
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with request.urlopen(req) as resp:
        return json.loads(resp.read().decode("utf-8"))


def _get_json(path: str, params: dict) -> dict:
    query = parse.urlencode(params)
    with request.urlopen(f"{BASE_URL}{path}?{query}") as resp:
        return json.loads(resp.read().decode("utf-8"))


def test_train():
    print("==> Training model with synthetic data")
    data = generate_test_data()
    payload = {"productId": "demo-product", "salesData": data}
    try:
        res = _post_json("/api/ml/train", payload)
        print("Train response:", res)
    except error.HTTPError as exc:
        print("Train failed:", exc.read().decode("utf-8"))


def test_forecast():
    print("==> Fetching forecast")
    try:
        res = _get_json("/api/ml/forecast", {"productId": "demo-product", "days": 7})
        print("Forecast response:", res)
    except error.HTTPError as exc:
        print("Forecast failed:", exc.read().decode("utf-8"))


if __name__ == "__main__":
    test_train()
    test_forecast()
