"""
COMPREHENSIVE MODEL VALIDATION - Business Realistic
Tests all models with real UMKM business standards
"""

import os
import pandas as pd
import numpy as np
from models.xgboost_optimal import HybridBrain

BASE_DIR = os.path.dirname(__file__)
MODELS_DIR = os.path.join(BASE_DIR, "training", "models_output")
PREPROCESSED_DIR = os.path.join(BASE_DIR, "training", "preprocessed")

print("="*80)
print("AI MARKET PULSE - BUSINESS-REALISTIC VALIDATION")
print("="*80)
print()

def evaluate_business_realism(mae, actual_mean, pred_mean, pred_std, actual_std):
    """Evaluate with CV-adjusted thresholds"""
    
    if actual_mean <= 0:
        return (False, "F", "No actual data")
    
    mae_pct = (mae / actual_mean) * 100
    cv = actual_std / actual_mean  # Coefficient of variation
    
    # Suspicious checks
    if mae < 0.01 and actual_mean > 1.0:
        return (False, "F", "TOO PERFECT - Overfitting")
    
    if pred_std < 0.1 and actual_mean > 5.0:
        return (False, "F", "NO VARIANCE - Flat predictions")
    
    deviation_pct = abs(pred_mean - actual_mean) / actual_mean * 100
    if deviation_pct > 50:
        return (False, "F", f"TOO FAR from actual ({deviation_pct:.0f}% off)")
    
    # ✅ NEW: CV-adjusted thresholds
    # High CV products are harder to predict → More lenient grading
    if cv > 0.5:  # High variance
        # Adjust thresholds +10% for high CV products
        if mae_pct < 15:
            return (True, "A+", f"Excellent (High CV={cv:.0%} product)")
        elif mae_pct < 20:
            return (True, "A", f"Very good (High CV={cv:.0%})")
        elif mae_pct < 25:
            return (True, "B", f"Good (High CV={cv:.0%})")
        elif mae_pct < 30:
            return (True, "C", f"Acceptable (High CV={cv:.0%})")
        elif mae_pct < 40:
            return (False, "D", f"Marginal (High CV={cv:.0%})")
        else:
            return (False, "F", f"Too inaccurate ({mae_pct:.1f}% error)")
    
    # Standard thresholds for normal CV products
    if mae_pct < 5:
        return (True, "A+", "Excellent")
    elif mae_pct < 10:
        return (True, "A", "Very good")
    elif mae_pct < 15:
        return (True, "B", "Good")
    elif mae_pct < 20:
        return (True, "C", "Acceptable")
    elif mae_pct < 30:
        return (False, "D", "Marginal")
    else:
        return (False, "F", f"Too inaccurate ({mae_pct:.1f}%)")

# Results storage
results = {
    'A+': [], 'A': [], 'B': [], 'C': [], 'D': [], 'F': [],
    'total': 0, 'realistic': 0, 'unrealistic': 0, 'failed': 0
}

model_files = [f for f in os.listdir(MODELS_DIR) if f.startswith('xgboost_') and f.endswith('.pkl')]
data_files = [f for f in os.listdir(PREPROCESSED_DIR) if f.endswith('_cleaned.csv')]

print(f"Found {len(model_files)} models, {len(data_files)} data files")
print()
print("Business Grading Criteria:")
print("  🏆 A+: Error <5%    - Excellent")
print("  ✅ A:  Error 5-10%  - Very good")
print("  ✅ B:  Error 10-15% - Good")
print("  🟡 C:  Error 15-20% - Acceptable")
print("  🔴 D:  Error 20-30% - Marginal")
print("  🔴 F:  Error >30% or suspicious")
print()

for i, model_file in enumerate(model_files, 1):
    product_id = model_file.replace('xgboost_', '').replace('.pkl', '')
    
    if i % 30 == 0:
        print(f"Progress: {i}/{len(model_files)} models...")
    
    try:
        # Load model
        model_path = os.path.join(MODELS_DIR, model_file)
        brain = HybridBrain(product_id)
        
        if not brain.load_model(product_id, model_path):
            results['failed'] += 1
            continue
        
        # Find data
        data_path = None
        for data_file in data_files:
            if data_file.replace('_cleaned.csv', '') == product_id:
                data_path = os.path.join(PREPROCESSED_DIR, data_file)
                break
        
        if not data_path:
            results['failed'] += 1
            continue
        
        # Load data
        df = pd.read_csv(data_path)
        df['date'] = pd.to_datetime(df['date'])
        
        actual_mean = float(df['quantity'].mean())
        actual_std = float(df['quantity'].std())
        
        # Predictions
        predictions = brain.predict_next_days(7)
        pred_values = [float(p['predicted_quantity']) for p in predictions]
        pred_mean = float(np.mean(pred_values))
        pred_std = float(np.std(pred_values))
        
        # Evaluate
        is_realistic, grade, reason = evaluate_business_realism(
            float(brain.mae), actual_mean, pred_mean, pred_std, actual_std
        )
        
        results['total'] += 1
        if is_realistic:
            results['realistic'] += 1
        else:
            results['unrealistic'] += 1
        
        mae_pct = (float(brain.mae) / actual_mean * 100) if actual_mean > 0 else 0
        
        results[grade].append({
            'product_id': product_id,
            'mae': round(float(brain.mae), 3),
            'mae_pct': round(mae_pct, 1),
            'actual_mean': round(actual_mean, 1),
            'pred_mean': round(pred_mean, 1),
            'pred_std': round(pred_std, 2),
            'data_points': len(df),
            'reason': reason
        })
        
    except Exception as e:
        results['failed'] += 1
        if i <= 5:
            print(f"Error: {product_id[:40]} - {str(e)[:40]}")

# Print results
print("\n" + "="*80)
print("VALIDATION RESULTS BY GRADE")
print("="*80)
print()

for grade in ['A+', 'A', 'B', 'C', 'D', 'F']:
    models = results[grade]
    if not models:
        continue
    
    count = len(models)
    pct = (count / results['total'] * 100) if results['total'] > 0 else 0
    
    emoji = "🏆" if grade == "A+" else "✅" if grade in ['A', 'B'] else "🟡" if grade == 'C' else "🔴"
    print(f"{emoji} Grade {grade}: {count:3d} models ({pct:5.1f}%)")
    
    # Show top 3 examples for each grade
    if count <= 5:
        for model in models:
            print(f"   • {model['product_id'][:45]:45} MAE: {model['mae']:.3f} ({model['mae_pct']:.1f}%) - {model['reason']}")
    else:
        for model in models[:3]:
            print(f"   • {model['product_id'][:45]:45} MAE: {model['mae']:.3f} ({model['mae_pct']:.1f}%)")
        if grade == 'F':
            print(f"   ... and {count-3} more F-grade models")
    print()

# Summary
print("="*80)
print("BUSINESS READINESS SUMMARY")
print("="*80)

total = results['total']
if total == 0:
    print("❌ No models tested!")
    exit(1)

business_ready = sum(len(results[g]) for g in ['A+', 'A', 'B', 'C'])
not_ready = sum(len(results[g]) for g in ['D', 'F'])

print(f"Total models tested:        {total}")
print(f"✅ Business-ready (A-C):    {business_ready:3d} ({business_ready/total*100:5.1f}%)")
print(f"🔴 Not business-ready (D-F): {not_ready:3d} ({not_ready/total*100:5.1f}%)")
print(f"❌ Failed to test:          {results['failed']}")
print()

# Grade breakdown
print("Grade Distribution:")
for grade in ['A+', 'A', 'B', 'C', 'D', 'F']:
    count = len(results[grade])
    if count > 0:
        pct = (count / total * 100)
        bar = '█' * int(pct / 2)
        print(f"  {grade:2s}: {bar:50s} {count:3d} ({pct:5.1f}%)")

print()

# Recommendations
if business_ready / total >= 0.85:
    print("✅ EXCELLENT: 85%+ models are business-ready!")
    print("   → System is production-ready")
    print("   → F-grade models can be ignored or retrained later")
elif business_ready / total >= 0.70:
    print("🟢 GOOD: 70-85% models are business-ready")
    print("   → Acceptable for production")
    print("   → Consider reviewing F-grade models")
elif business_ready / total >= 0.50:
    print("🟡 FAIR: 50-70% models are business-ready")
    print("   → Usable but needs improvement")
    print("   → Prioritize fixing F-grade models")
else:
    print("🔴 NEEDS WORK: <50% models are business-ready")
    print("   → Review data quality and preprocessing")
    print("   → Consider adjusting model parameters")

print()
print("Next Steps:")
if not_ready > 0:
    f_count = len(results['F'])
    print(f"  1. Review {f_count} F-grade models (see list above)")
    print("  2. Common issues:")
    print("     - TOO PERFECT (MAE ~0): Add regularization or check for data leakage")
    print("     - NO VARIANCE: Check if data is too uniform")
    print("     - TOO INACCURATE: Need more training data or better features")
    print("  3. Decision: Retrain problematic models OR proceed with A-C grade models only")
else:
    print("  ✅ All models are business-ready!")
    print("  → Proceed with README documentation")
    print("  → Prepare demo video showcasing A+ models")

print("\n" + "="*80)