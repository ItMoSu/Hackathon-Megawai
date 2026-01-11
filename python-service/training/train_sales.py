"""
Enhanced Training Script for XGBoost Demand Forecasting
Optimized for:
- Target MAE: ~0.1 (normalized)
- Target Improvement: 90%+ over baseline
"""

import os
import sys
import pandas as pd
from typing import List, Dict
import logging
import numpy as np

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from models.xgboost_optimal import HybridBrain

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def filter_quality_datasets(preprocessed_files: List[str]) -> tuple:
    """
    Filter datasets suitable for high-accuracy training
    Returns: (filtered_files, exclusion_reasons)
    """
    filtered_files = []
    excluded_reasons = {
        'too_few_rows': [],
        'flat_data': [],
        'low_variance': [],
        'sparse_dates': [],
        'read_error': []
    }
    
    for file_path in preprocessed_files:
        product_name = os.path.basename(file_path).replace('_cleaned.csv', '')
        
        try:
            df = pd.read_csv(file_path)
            df['date'] = pd.to_datetime(df['date'])
            
            # Check 1: Minimum rows (need at least 30 days)
            if len(df) < 30:
                excluded_reasons['too_few_rows'].append((product_name, len(df)))
                continue
            
            # Check 2: At least 5 unique values
            unique_values = df['quantity'].nunique()
            if unique_values < 5:
                excluded_reasons['flat_data'].append((product_name, unique_values))
                continue
            
            # Check 3: CV > 10% (meaningful variance)
            mean = df['quantity'].mean()
            std = df['quantity'].std()
            cv = std / mean if mean > 0 else 0
            
            if cv < 0.10:
                excluded_reasons['low_variance'].append((product_name, f"{cv:.1%}"))
                continue
            
            # Check 4: Date coverage > 30%
            date_range = (df['date'].max() - df['date'].min()).days + 1
            coverage = len(df) / date_range if date_range > 0 else 0
            
            if coverage < 0.30:
                excluded_reasons['sparse_dates'].append((product_name, f"{coverage:.1%}"))
                continue
            
            # Passed all checks
            filtered_files.append(file_path)
            
        except Exception as e:
            excluded_reasons['read_error'].append((product_name, str(e)[:50]))
            continue
    
    return filtered_files, excluded_reasons


def train_all_models():
    """Train XGBoost models for all preprocessed products"""
    
    print("="*80)
    print("AI MARKET PULSE - ENHANCED MODEL TRAINING v2.0")
    print("Target: MAE ~0.1, Improvement 90%+")
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
    
    # ═══════════════════════════════════════════════════════════
    # QUALITY FILTERING
    # ═══════════════════════════════════════════════════════════
    print("="*80)
    print("QUALITY FILTERING")
    print("="*80)
    print()
    
    filtered_files, excluded_reasons = filter_quality_datasets(preprocessed_files)
    
    total_excluded = sum(len(v) for v in excluded_reasons.values())
    
    print(f"📊 Dataset Quality Summary:")
    print(f"   ✅ Passed:    {len(filtered_files)}/{len(preprocessed_files)}")
    print(f"   ⚠️  Excluded: {total_excluded}")
    
    if total_excluded > 0:
        print("\n   Exclusion breakdown:")
        for reason, items in excluded_reasons.items():
            if items:
                print(f"   • {reason}: {len(items)}")
                if len(items) <= 3:
                    for name, detail in items:
                        print(f"     - {name[:40]}: {detail}")
    
    print()
    
    if not filtered_files:
        print("❌ No datasets passed quality filtering!")
        print("\nSuggestions:")
        print("  • Add more historical data (at least 30 days)")
        print("  • Ensure data has meaningful variance (CV > 10%)")
        print("  • Check for data format issues")
        return
    
    # Use filtered files
    preprocessed_files = filtered_files
    
    # ═══════════════════════════════════════════════════════════
    # TRAINING
    # ═══════════════════════════════════════════════════════════
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
        
        # Truncate long names for display
        display_name = product_name[:50] if len(product_name) > 50 else product_name
        print(f"[{idx}/{len(preprocessed_files)}] Training: {display_name}")
        
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
            train_result = brain.train(df.to_dict('records'))
            
            # Extract metrics
            mae = brain.mae if brain.mae else 0
            val_mae = brain.val_mae if hasattr(brain, 'val_mae') and brain.val_mae else mae
            baseline_mae = brain.baseline_mae if brain.baseline_mae else 0
            val_r2 = brain.val_r2 if hasattr(brain, 'val_r2') and brain.val_r2 is not None else 0
            val_rmse = brain.val_rmse if hasattr(brain, 'val_rmse') and brain.val_rmse is not None else 0
            val_mape = brain.val_mape if hasattr(brain, 'val_mape') and brain.val_mape is not None else 0
            val_accuracy = brain.val_accuracy if hasattr(brain, 'val_accuracy') and brain.val_accuracy is not None else 0
            overfit_ratio = brain.overfit_ratio if hasattr(brain, 'overfit_ratio') and brain.overfit_ratio is not None else 0
            
            # Calculate improvement
            improvement = 0
            if baseline_mae > 0:
                improvement = (1 - val_mae / baseline_mae) * 100
            
            # Normalized MAE (relative to data mean)
            data_mean = df['quantity'].mean()
            normalized_mae = val_mae / data_mean if data_mean > 0 else val_mae
            
            # Save model
            model_path = os.path.join(models_output_dir, f"xgboost_{product_name}.pkl")
            if brain.save_model(product_name, model_path):
                status = "✅"
                
                # Quality indicator
                quality = ""
                if improvement >= 90:
                    quality = "🏆"  # Excellent
                elif improvement >= 70:
                    quality = "✓"   # Good
                elif improvement >= 50:
                    quality = "○"   # Fair
                else:
                    quality = "△"   # Needs improvement
                
                print(
                    f"  {status} Val MAE: {val_mae:.4f} | R2: {val_r2:.3f} | "
                    f"Acc: {val_accuracy:.1f}% | Overfit: {overfit_ratio:.2f} | "
                    f"Rows: {len(df):,} | Baseline: {baseline_mae:.4f} | Imp: {improvement:.1f}% {quality}"
                )
                
                results['successful'].append({
                    'product': product_name,
                    'mae': mae,
                    'val_mae': val_mae,
                    'baseline_mae': baseline_mae,
                    'improvement': improvement,
                    'normalized_mae': normalized_mae,
                    'val_r2': val_r2,
                    'val_rmse': val_rmse,
                    'val_mape': val_mape,
                    'val_accuracy': val_accuracy,
                    'overfit_ratio': overfit_ratio,
                    'rows': len(df)
                })
            else:
                print(f"  ❌ Failed to save model")
                results['failed'].append({
                    'product': product_name,
                    'error': 'Failed to save model'
                })
                
        except Exception as e:
            print(f"  ❌ Error: {str(e)[:60]}")
            results['failed'].append({
                'product': product_name,
                'error': str(e)
            })
        
        print()
    
    # ═══════════════════════════════════════════════════════════
    # SUMMARY
    # ═══════════════════════════════════════════════════════════
    print("="*80)
    print("TRAINING SUMMARY")
    print("="*80)
    print(f"Total datasets:     {results['total']}")
    print(f"✅ Successful:      {len(results['successful'])}")
    print(f"❌ Failed:          {len(results['failed'])}")
    print()
    
    if results['successful']:
        # Calculate aggregate metrics
        val_maes = [m['val_mae'] for m in results['successful']]
        improvements = [m['improvement'] for m in results['successful']]
        normalized_maes = [m['normalized_mae'] for m in results['successful']]
        r2_scores = [m.get('val_r2', 0) for m in results['successful']]
        accuracies = [m.get('val_accuracy', 0) for m in results['successful']]
        rmses = [m.get('val_rmse', 0) for m in results['successful']]
        mapes = [m.get('val_mape', 0) for m in results['successful']]
        overfits = [m.get('overfit_ratio', 0) for m in results['successful']]
        rows_list = [m.get('rows', 0) for m in results['successful']]
        
        avg_val_mae = np.mean(val_maes)
        avg_improvement = np.mean(improvements)
        avg_normalized_mae = np.mean(normalized_maes)
        avg_r2 = np.mean(r2_scores) if r2_scores else 0
        avg_accuracy = np.mean(accuracies) if accuracies else 0
        avg_rmse = np.mean(rmses) if rmses else 0
        avg_mape = np.mean(mapes) if mapes else 0
        avg_overfit = np.mean(overfits) if overfits else 0
        total_rows = int(np.sum(rows_list)) if rows_list else 0
        
        print(f"📊 Aggregate Metrics:")
        print(f"   Average Validation MAE:    {avg_val_mae:.4f}")
        print(f"   Average Normalized MAE:    {avg_normalized_mae:.4f}")
        print(f"   Average Improvement:       {avg_improvement:.1f}%")
        print(f"   Average R2 Score:          {avg_r2:.3f}")
        print(f"   Average Accuracy (1-MAPE): {avg_accuracy:.1f}%")
        print(f"   Average RMSE:              {avg_rmse:.4f}")
        print(f"   Average MAPE:              {avg_mape:.4f}")
        print(f"   Average Overfit Ratio:     {avg_overfit:.2f}")
        print(f"   Total Rows Processed:      {total_rows:,}")
        print()
        
        # Quality assessment
        if avg_normalized_mae <= 0.1:
            print("✅ Target MAE achieved! (Normalized MAE ≤ 0.1)")
        elif avg_normalized_mae <= 0.2:
            print("✓  Good MAE (Normalized MAE ≤ 0.2)")
        else:
            print(f"⚠️  MAE above target (Normalized MAE = {avg_normalized_mae:.2f})")
        
        if avg_improvement >= 90:
            print("✅ Target improvement achieved! (≥90%)")
        elif avg_improvement >= 70:
            print("✓  Good improvement (≥70%)")
        elif avg_improvement >= 50:
            print("○  Moderate improvement (≥50%)")
        else:
            print(f"⚠️  Below target improvement ({avg_improvement:.1f}%)")
        
        print()
        
        # Best models
        best_by_improvement = sorted(results['successful'], key=lambda x: x['improvement'], reverse=True)[:5]
        print("🏆 Top 5 Best Models (by Improvement):")
        for model in best_by_improvement:
            name = model['product'][:45] if len(model['product']) > 45 else model['product']
            print(f"  • {name:45} Imp: {model['improvement']:.1f}%, MAE: {model['val_mae']:.4f}")
        print()
        
        # Best by MAE
        best_by_mae = sorted(results['successful'], key=lambda x: x['val_mae'])[:5]
        print("📈 Top 5 Best Models (by MAE):")
        for model in best_by_mae:
            name = model['product'][:45] if len(model['product']) > 45 else model['product']
            print(f"  • {name:45} MAE: {model['val_mae']:.4f}, Imp: {model['improvement']:.1f}%")
        print()
        
        # Distribution of improvements
        imp_90plus = len([i for i in improvements if i >= 90])
        imp_70plus = len([i for i in improvements if 70 <= i < 90])
        imp_50plus = len([i for i in improvements if 50 <= i < 70])
        imp_below50 = len([i for i in improvements if i < 50])
        
        print("📊 Improvement Distribution:")
        print(f"   🏆 ≥90%:  {imp_90plus} models ({imp_90plus/len(improvements)*100:.0f}%)")
        print(f"   ✓  70-89%: {imp_70plus} models ({imp_70plus/len(improvements)*100:.0f}%)")
        print(f"   ○  50-69%: {imp_50plus} models ({imp_50plus/len(improvements)*100:.0f}%)")
        print(f"   △  <50%:  {imp_below50} models ({imp_below50/len(improvements)*100:.0f}%)")
        print()
    
    if results['failed'] and len(results['failed']) <= 10:
        print("❌ Failed Models:")
        for failed in results['failed']:
            error_msg = failed['error'][:50] if len(failed['error']) > 50 else failed['error']
            print(f"  • {failed['product'][:40]:40} - {error_msg}")
        print()
    elif results['failed']:
        print(f"❌ {len(results['failed'])} models failed to train")
        print()
    
    print("="*80)
    print(f"Models saved to: {models_output_dir}")
    print("="*80)
    
    return results
    

if __name__ == "__main__":
    train_all_models()
