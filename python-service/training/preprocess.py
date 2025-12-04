#!/usr/bin/env python3
'''
Main preprocessing script
Usage: python preprocess.py
'''

import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(__file__))

from services import PreprocessingService, ConsoleProgressObserver
from training_config import PREPROCESSING_CONFIG
from utils.logger import logger


def main():
    '''Main preprocessing entry point'''

    print("""
╔══════════════════════════════════════════════════════════════╗
║          AI MARKET PULSE - DATA PREPROCESSING                ║
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

        # Success message
        if results:
            print("✅ Preprocessing complete!")
            print(f"📁 Cleaned data saved to: {PREPROCESSING_CONFIG.output_folder}")
            print(f"\n➡️  Next step: python train.py\n")
            logger.info(f"Preprocessing successful: {len(results)} datasets created")
            return 0

        print("⚠️  No valid datasets created.")
        print("Check your input files and try again.\n")
        logger.warning("Preprocessing completed with no valid outputs")
        return 1

    except KeyboardInterrupt:
        print("\n\n⚠️  Interrupted by user\n")
        logger.warning("Preprocessing interrupted by user")
        return 130

    except Exception as e:
        print(f"\n❌ Error: {str(e)}\n")
        logger.error(f"Preprocessing failed: {str(e)}")
        return 1


if __name__ == '__main__':
    sys.exit(main())
