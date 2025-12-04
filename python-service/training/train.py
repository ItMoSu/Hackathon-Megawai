"""
Training script for XGBoost demand forecasting models
Trains one model per product using preprocessed data
"""

import os
import sys
import pandas as pd
from typing import List, Dict
import logging

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from models.xgboost_optimal import HybridBrain

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def train_all_models():
    """Train XGBoost models for all preprocessed products"""
    
    print("="*80)
    print("AI MARKET PULSE - MODEL TRAINING")
    print("="*80)
    print()
    
    # Setup paths
    script_dir = os.path.dirname(os.path.abspath(__file__))
    preprocessed_dir = os.path.join(script_dir, "preprocessed")
    models_output_dir = os.path.join(script_dir, "models_output")
    
    # Create output directory
    os.makedirs(models_output_dir, exist_ok=True)
    
    # Load all preprocessed files
    if not os.path.exists(preprocessed_dir):
        print(f"❌ Preprocessed directory not found: {preprocessed_dir}")
        return
    
    preprocessed_files = [
        os.path.join(preprocessed_dir, f)
        for f in os.listdir(preprocessed_dir)
        if f.endswith('_cleaned.csv')
    ]
    
    if not preprocessed_files:
        print(f"❌ No preprocessed files found in {preprocessed_dir}")
        return
    
    print(f"Found {len(preprocessed_files)} preprocessed datasets")
    print()
    
    # ✅ FILTERING SECTION - Remove low-quality datasets
    print("="*80)
    print("FILTERING LOW-QUALITY DATASETS")
    print("="*80)
    print()
    
    filtered_files = []
    excluded_reasons = {
        'too_few_rows': [],
        'flat_data': [],
        'no_variance': []
    }
    
    for file_path in preprocessed_files:
        product_name = os.path.basename(file_path).replace('_cleaned.csv', '')
        
        try:
            df = pd.read_csv(file_path)
            
            # Check 1: Minimum rows (need at least 30 days)
            if len(df) < 30:
                excluded_reasons['too_few_rows'].append(product_name)
                print(f"⚠️  Excluding {product_name}: Only {len(df)} rows (need ≥30)")
                continue
            
            # Check 2: Flat data (only 1-2 unique values = no patterns to learn)
            unique_values = df['quantity'].nunique()
            if unique_values <= 2:
                excluded_reasons['flat_data'].append(product_name)
                print(f"⚠️  Excluding {product_name}: Only {unique_values} unique values (flat)")
                continue
            
            # Check 3: No variance (CV < 5% = suspiciously uniform)
            mean = df['quantity'].mean()
            std = df['quantity'].std()
            cv = std / mean if mean > 0 else 0
            
            if cv < 0.05:
                excluded_reasons['no_variance'].append(product_name)
                print(f"⚠️  Excluding {product_name}: CV only {cv:.1%} (too flat)")
                continue
            
            # Passed all checks
            filtered_files.append(file_path)
            
        except Exception as e:
            print(f"❌ Error reading {product_name}: {e}")
            continue
    
    print()
    print("="*80)
    print("FILTERING RESULTS")
    print("="*80)
    print(f"✅ Accepted:  {len(filtered_files)}/{len(preprocessed_files)} datasets")
    print(f"⚠️  Excluded:  {len(preprocessed_files) - len(filtered_files)} datasets")
    
    for reason, products in excluded_reasons.items():
        if products:
            print(f"   - {reason}: {len(products)} products")
    
    print()
    
    # Update to filtered list
    preprocessed_files = filtered_files
    
    if not preprocessed_files:
        print("❌ No datasets passed filtering criteria!")
        return
    
    # Training
    print("="*80)
    print("TRAINING MODELS")
    print("="*80)
    print()
    
    results = {
        'successful': [],
        'failed': [],
        'total': len(preprocessed_files)
    }
    
    for idx, file_path in enumerate(preprocessed_files, 1):
        product_name = os.path.basename(file_path).replace('_cleaned.csv', '')
        
        print(f"[{idx}/{len(preprocessed_files)}] Training: {product_name}")
        
        try:
            # Load data
            df = pd.read_csv(file_path)
            
            if 'date' not in df.columns or 'quantity' not in df.columns:
                print(f"  ❌ Missing required columns")
                results['failed'].append({
                    'product': product_name,
                    'error': 'Missing date or quantity column'
                })
                continue
            
            # Convert date
            df['date'] = pd.to_datetime(df['date'])
            df = df.sort_values('date')
            
            # Initialize and train model
            brain = HybridBrain(product_name)
            brain.train(df)
            
            # Save model
            model_path = os.path.join(models_output_dir, f"xgboost_{product_name}.pkl")
            if brain.save_model(product_name, model_path):
                # Get metrics
                mae = brain.mae if brain.mae else 0
                baseline_mae = brain.baseline_mae if brain.baseline_mae else 0
                improvement = 0
                
                if baseline_mae > 0:
                    improvement = (1 - mae / baseline_mae) * 100
                
                print(f"  ✅ MAE: {mae:.3f} | Baseline: {baseline_mae:.3f} | Improvement: {improvement:.1f}%")
                
                results['successful'].append({
                    'product': product_name,
                    'mae': mae,
                    'baseline_mae': baseline_mae,
                    'improvement': improvement,
                    'rows': len(df)
                })
            else:
                print(f"  ❌ Failed to save model")
                results['failed'].append({
                    'product': product_name,
                    'error': 'Failed to save model'
                })
                
        except Exception as e:
            print(f"  ❌ Error: {str(e)}")
            results['failed'].append({
                'product': product_name,
                'error': str(e)
            })
        
        print()
    
    # Summary
    print("="*80)
    print("TRAINING SUMMARY")
    print("="*80)
    print(f"Total datasets:     {results['total']}")
    print(f"✅ Successful:      {len(results['successful'])}")
    print(f"❌ Failed:          {len(results['failed'])}")
    print()
    
    if results['successful']:
        # Calculate aggregate metrics
        avg_mae = sum(m['mae'] for m in results['successful']) / len(results['successful'])
        avg_improvement = sum(m['improvement'] for m in results['successful']) / len(results['successful'])
        
        print(f"Average Metrics:")
        print(f"  MAE: {avg_mae:.3f}")
        print(f"  Improvement over baseline: {avg_improvement:.1f}%")
        print()
        
        # Best models
        best_models = sorted(results['successful'], key=lambda x: x['mae'])[:5]
        print("🏆 Top 5 Best Models (Lowest MAE):")
        for model in best_models:
            print(f"  • {model['product'][:50]:50} MAE: {model['mae']:.3f}")
        print()
        
        # Worst models (but still successful)
        worst_models = sorted(results['successful'], key=lambda x: x['mae'], reverse=True)[:5]
        print("🔍 Top 5 Models with Highest MAE:")
        for model in worst_models:
            print(f"  • {model['product'][:50]:50} MAE: {model['mae']:.3f}")
        print()
    
    if results['failed']:
        print("❌ Failed Models:")
        for failed in results['failed'][:10]:  # Show first 10
            error_msg = failed['error'][:50] if len(failed['error']) > 50 else failed['error']
            print(f"  • {failed['product'][:40]:40} - {error_msg}")
        if len(results['failed']) > 10:
            print(f"  ... and {len(results['failed']) - 10} more")
        print()
    
    print("="*80)
    print("Models saved to:", models_output_dir)
    print("="*80)
    
    return results
    
if __name__ == "__main__":
    train_all_models()