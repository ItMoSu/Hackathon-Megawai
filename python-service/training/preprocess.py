#!/usr/bin/env python3
'''
Enhanced preprocessing script for AI Market Pulse
Optimized for XGBoost model with better data quality and feature extraction
Usage: python preprocess.py
'''

import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(__file__))

from services import PreprocessingService, ConsoleProgressObserver
from training_config import PREPROCESSING_CONFIG
from utils.logger import logger


def validate_preprocessing_output(results):
    """Validate preprocessed data quality for XGBoost training"""
    valid_datasets = []
    invalid_datasets = []
    
    for dataset in results:
        issues = []
        
        # Check 1: Minimum records (need at least 30 days for reliable patterns)
        if dataset.num_records < 30:
            issues.append(f"Only {dataset.num_records} records (need ≥30)")
        
        # Check 2: Date range should cover at least 14 days
        try:
            from datetime import datetime
            import pandas as pd
            
            start_date = pd.to_datetime(dataset.date_range[0])
            end_date = pd.to_datetime(dataset.date_range[1])
            date_span = (end_date - start_date).days
            
            if date_span < 14:
                issues.append(f"Date span only {date_span} days (need ≥14)")
        except Exception as e:
            issues.append(f"Date parsing error: {e}")
        
        # Check 3: Required columns present
        required_cols = {'date', 'quantity'}
        missing_cols = required_cols - set(dataset.columns)
        if missing_cols:
            issues.append(f"Missing columns: {missing_cols}")
        
        if issues:
            invalid_datasets.append({
                'name': dataset.product_name,
                'issues': issues
            })
        else:
            valid_datasets.append(dataset)
    
    return valid_datasets, invalid_datasets


def main():
    '''Main preprocessing entry point with enhanced validation'''

    print("""
╔══════════════════════════════════════════════════════════════╗
║       AI MARKET PULSE - ENHANCED DATA PREPROCESSING          ║
║                                                              ║
║  Features:                                                   ║
║  • Smart column detection (date, quantity, product, price)   ║
║  • Automatic date gap filling                                ║
║  • Outlier removal (Z-score based)                          ║
║  • Daily aggregation for multi-transaction data              ║
║  • Quality validation for XGBoost training                   ║
║                                                              ║
║  Drop your files into: datasets/                             ║
║  Supported formats: CSV, XLSX, TXT, PDF, DOCX                ║
╚══════════════════════════════════════════════════════════════╝
    """)

    try:
        # Create service
        observer = ConsoleProgressObserver()
        service = PreprocessingService(PREPROCESSING_CONFIG, observer)

        # Run preprocessing
        results = service.process_all()

        if not results:
            print("⚠️  No valid datasets created.")
            print("Check your input files and try again.\n")
            logger.warning("Preprocessing completed with no valid outputs")
            return 1

        # Validate output quality
        print("\n" + "="*60)
        print("DATA QUALITY VALIDATION")
        print("="*60)
        
        valid_datasets, invalid_datasets = validate_preprocessing_output(results)
        
        if invalid_datasets:
            print(f"\n⚠️  {len(invalid_datasets)} dataset(s) have quality issues:")
            for ds in invalid_datasets[:10]:  # Show first 10
                print(f"  • {ds['name'][:40]}")
                for issue in ds['issues']:
                    print(f"    - {issue}")
            if len(invalid_datasets) > 10:
                print(f"  ... and {len(invalid_datasets) - 10} more")
        
        print(f"\n✅ {len(valid_datasets)} dataset(s) ready for training")
        
        if valid_datasets:
            print("\n" + "="*60)
            print("PREPROCESSING COMPLETE")
            print("="*60)
            print(f"📁 Cleaned data saved to: {PREPROCESSING_CONFIG.output_folder}")
            print(f"📊 Valid datasets: {len(valid_datasets)}/{len(results)}")
            print(f"\n➡️  Next step: python train_sales.py\n")
            logger.info(f"Preprocessing successful: {len(valid_datasets)} valid datasets")
            return 0
        
        print("\n❌ No datasets passed quality validation.")
        print("Check your data format and try again.\n")
        return 1

    except KeyboardInterrupt:
        print("\n\n⚠️  Interrupted by user\n")
        logger.warning("Preprocessing interrupted by user")
        return 130

    except Exception as e:
        print(f"\n❌ Error: {str(e)}\n")
        logger.error(f"Preprocessing failed: {str(e)}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == '__main__':
    sys.exit(main())
