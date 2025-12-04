#!/usr/bin/env python3
'''
Complete pipeline: preprocess + train
Usage: python pipeline.py
'''

import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(__file__))

from services import PreprocessingService, TrainingService, ConsoleProgressObserver
from training_config import PREPROCESSING_CONFIG, TRAINING_CONFIG
from utils.logger import logger


def main():
    '''Run complete pipeline'''

    print("""
╔══════════════════════════════════════════════════════════════╗
║          AI MARKET PULSE - COMPLETE PIPELINE                 ║
║                                                              ║
║  Step 1: Preprocessing                                       ║
║  Step 2: Training                                            ║
╚══════════════════════════════════════════════════════════════╝
    """)

    try:
        observer = ConsoleProgressObserver()

        # Step 1: Preprocessing
        print("\n" + "="*60)
        print("STEP 1: PREPROCESSING")
        print("="*60 + "\n")

        preprocess_service = PreprocessingService(PREPROCESSING_CONFIG, observer)
        datasets = preprocess_service.process_all()

        if not datasets:
            print("\n❌ No datasets created. Pipeline stopped.\n")
            return 1

        print(f"\n✅ Preprocessing complete: {len(datasets)} datasets ready\n")

        # Step 2: Training
        print("\n" + "="*60)
        print("STEP 2: TRAINING")
        print("="*60 + "\n")

        training_service = TrainingService(TRAINING_CONFIG, observer=observer)
        results = training_service.train_all()

        success_count = sum(1 for r in results if r.success)

        # Final summary
        print("\n" + "="*60)
        print("PIPELINE COMPLETE")
        print("="*60)
        print(f"📊 Datasets processed:  {len(datasets)}")
        print(f"🎯 Models trained:      {success_count}/{len(results)}")
        print(f"📁 Output directory:    {TRAINING_CONFIG.output_folder}")

        if success_count > 0:
            avg_mae = sum(
                r.metrics['validation']['mae']
                for r in results if r.success
            ) / success_count
            print(f"📈 Avg Validation MAE:  {avg_mae:.2f}")

        print("="*60 + "\n")

        logger.info(f"Pipeline complete: {success_count}/{len(results)} models trained")
        return 0 if success_count > 0 else 1

    except KeyboardInterrupt:
        print("\n\n⚠️  Interrupted by user\n")
        logger.warning("Pipeline interrupted by user")
        return 130

    except Exception as e:
        print(f"\n❌ Pipeline error: {str(e)}\n")
        logger.error(f"Pipeline failed: {str(e)}")
        return 1


if __name__ == '__main__':
    sys.exit(main())
