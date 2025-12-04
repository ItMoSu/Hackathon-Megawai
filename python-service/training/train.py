#!/usr/bin/env python3
'''
Main training script
Usage: python train.py
'''

import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(__file__))

from services import TrainingService, ConsoleProgressObserver
from config import TRAINING_CONFIG
from utils.logger import logger


def main():
    '''Main training entry point'''

    print("""
╔══════════════════════════════════════════════════════════════╗
║          AI MARKET PULSE - MODEL TRAINING                    ║
║                                                              ║
║  Training XGBoost models with quantile regression            ║
║  Output: models_output/                                      ║
╚══════════════════════════════════════════════════════════════╝
    """)

    try:
        # Create service
        observer = ConsoleProgressObserver()
        service = TrainingService(TRAINING_CONFIG, observer=observer)

        # Run training
        results = service.train_all()

        if not results:
            return 1

        # Success message
        success_count = sum(1 for r in results if r.success)

        if success_count > 0:
            print("✅ Training complete!")
            print(f"📁 Models saved to: {TRAINING_CONFIG.output_folder}")
            print(f"\n🎯 Successfully trained: {success_count}/{len(results)} models\n")

            # Show average metrics
            avg_mae = sum(
                r.metrics['validation']['mae']
                for r in results if r.success
            ) / success_count

            print(f"📊 Average Validation MAE: {avg_mae:.2f}\n")
            logger.info(f"Training successful: {success_count}/{len(results)} models")
            return 0

        print("❌ All training attempts failed.\n")
        logger.error("Training completed with no successful models")
        return 1

    except KeyboardInterrupt:
        print("\n\n⚠️  Interrupted by user\n")
        logger.warning("Training interrupted by user")
        return 130

    except Exception as e:
        print(f"\n❌ Error: {str(e)}\n")
        logger.error(f"Training failed: {str(e)}")
        return 1


if __name__ == '__main__':
    sys.exit(main())
