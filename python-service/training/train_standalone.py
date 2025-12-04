'''
Standalone ML Training Script
Trains XGBoost models for all products with sales data
'''

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(__file__)))

from models.xgboost_optimal import forecaster
import json
from datetime import datetime, timedelta
import random


def generate_sample_data(product_id: str, days: int = 60):
    '''Generate realistic sample sales data for testing'''
    data = []
    base = 50

    for i in range(days):
        date = (datetime.now() - timedelta(days=days - i)).strftime('%Y-%m-%d')

        # Add patterns
        day_of_week = (datetime.now() - timedelta(days=days - i)).weekday()
        is_weekend = day_of_week >= 5
        is_payday = i % 30 in [25, 26, 27, 28, 29, 0, 1, 2, 3, 4]

        quantity = base
        quantity += 10 if is_weekend else 0
        quantity += 15 if is_payday else 0
        quantity += random.randint(-5, 10)  # Random variation
        quantity += i * 0.3  # Slight upward trend

        data.append({
            'date': date,
            'quantity': max(1, quantity)
        })

    return data


def train_single_product(product_id: str, product_name: str, sales_data: list):
    '''Train models for one product'''
    print(f"\n{'='*60}")
    print(f"Training: {product_name}")
    print(f"Product ID: {product_id}")
    print(f"Data points: {len(sales_data)} days")
    print(f"{'='*60}")

    try:
        # Train
        result = forecaster.train(sales_data, product_id)

        # Save
        os.makedirs('../models', exist_ok=True)
        model_path = f'../models/xgboost_{product_id}.pkl'
        forecaster.save_model(product_id, model_path)

        # Print results
        print(f"\n✅ SUCCESS!")
        print(f"   Train MAE:      {result['metrics']['train']['mae']:.2f}")
        print(f"   Validation MAE: {result['metrics']['validation']['mae']:.2f}")
        print(f"   Best iteration: {result['best_iteration']}")
        print(f"   Model saved:    {model_path}")

        # Test forecast
        predictions = forecaster.predict(product_id, 7)
        print(f"\n📊 7-Day Forecast:")
        for pred in predictions[:3]:  # Show first 3 days
            print(f"   {pred['date']}: {pred['predicted_quantity']:.0f} units (confidence: {pred['confidence']})")
        print(f"   ... (+ 4 more days)")

        return True

    except Exception as e:
        print(f"\n❌ FAILED: {str(e)}")
        return False


def main():
    '''Main training function'''
    print("\n" + "="*60)
    print("AI MARKET PULSE - STANDALONE MODEL TRAINING")
    print("="*60)
    print(f"Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")

    # Define products to train
    products = [
        {'id': 'sambal-bawang', 'name': 'Sambal Bawang Kemasan'},
        {'id': 'keripik-singkong', 'name': 'Keripik Singkong Balado'},
        {'id': 'nasi-goreng', 'name': 'Nasi Goreng Spesial'},
        {'id': 'es-kopi', 'name': 'Es Kopi Susu Aren'},
        {'id': 'roti-cokelat', 'name': 'Roti Isi Cokelat Keju'},
    ]

    results = {'success': [], 'failed': []}

    for i, product in enumerate(products, 1):
        print(f"\n[{i}/{len(products)}] Processing...")

        # Generate sample data (in production, fetch from DB)
        sales_data = generate_sample_data(product['id'], days=60)

        # Train
        success = train_single_product(
            product['id'],
            product['name'],
            sales_data
        )

        if success:
            results['success'].append(product['name'])
        else:
            results['failed'].append(product['name'])

    # Summary
    print("\n" + "="*60)
    print("TRAINING SUMMARY")
    print("="*60)
    print(f"Total products:  {len(products)}")
    print(f"✅ Success:      {len(results['success'])}")
    print(f"❌ Failed:       {len(results['failed'])}")

    if results['success']:
        print(f"\nSuccessfully trained:")
        for name in results['success']:
            print(f"  • {name}")

    if results['failed']:
        print(f"\nFailed to train:")
        for name in results['failed']:
            print(f"  • {name}")

    print(f"\nCompleted: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("="*60 + "\n")

    # Save summary
    summary_file = f'training_summary_{datetime.now().strftime("%Y%m%d_%H%M%S")}.json'
    with open(summary_file, 'w') as f:
        json.dump(results, f, indent=2)
    print(f"📝 Summary saved: {summary_file}\n")


if __name__ == '__main__':
    main()
