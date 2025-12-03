'''
Preprocessing Service (Facade Pattern)
Orchestrates file processing workflow
'''

import os
import glob
import re
from typing import List, Dict
from pathlib import Path
from datetime import datetime

from core.interfaces import IProgressObserver
from core.models import ProcessedDataset, ProcessingConfig
from core.exceptions import PreprocessingError
from processors import ProcessorFactory
from utils.logger import logger


class ConsoleProgressObserver(IProgressObserver):
    '''Console-based progress reporter (Observer Pattern)'''

    def on_file_start(self, filename: str, index: int, total: int):
        print(f"\n[{index}/{total}] {filename}")
        logger.info(f"Processing file {index}/{total}: {filename}")

    def on_file_complete(self, filename: str, success: bool, message: str):
        status = "✅" if success else "❌"
        print(f"  {status} {message}")
        logger.info(f"File complete: {filename} - {message}")

    def on_training_start(self, product_id: str, index: int, total: int):
        print(f"\n[{index}/{total}] Training: {product_id}")
        logger.info(f"Training {index}/{total}: {product_id}")

    def on_training_complete(self, product_id: str, result):
        status = "✅" if result.success else "❌"
        msg = f"Val MAE: {result.metrics['validation']['mae']:.2f}" if result.success else result.error_message
        print(f"  {status} {msg}")
        logger.info(f"Training complete: {product_id} - {msg}")


class PreprocessingService:
    '''
    High-level preprocessing service (Facade Pattern)
    Coordinates file discovery, processing, and output
    '''

    def __init__(self, config: ProcessingConfig, observer: IProgressObserver = None):
        self.config = config
        self.observer = observer or ConsoleProgressObserver()
        self.results: List[ProcessedDataset] = []

    def discover_files(self) -> List[str]:
        '''Find all processable files in input folder'''
        supported_exts = ProcessorFactory.get_supported_extensions()
        all_files = []

        for ext in supported_exts:
            pattern = os.path.join(self.config.input_folder, f"*{ext}")
            all_files.extend(glob.glob(pattern))

        return sorted(all_files)

    def process_all(self) -> List[ProcessedDataset]:
        '''
        Process all files in input folder
        Returns list of successfully processed datasets
        '''
        logger.info("=" * 60)
        logger.info("PREPROCESSING STARTED")
        logger.info("=" * 60)

        print("\n" + "="*60)
        print("DATA PREPROCESSING")
        print("="*60)

        # Discover files
        files = self.discover_files()

        if not files:
            logger.warning(f"No files found in {self.config.input_folder}")
            print(f"\n❌ No data files found in: {self.config.input_folder}")
            print(f"Supported formats: {', '.join(ProcessorFactory.get_supported_extensions())}\n")
            return []

        logger.info(f"Found {len(files)} file(s)")
        print(f"\nFound {len(files)} file(s):")
        for f in files:
            print(f"  • {os.path.basename(f)}")

        print("\n" + "="*60)

        # Process each file
        self.results = []

        for i, filepath in enumerate(files, 1):
            self.observer.on_file_start(os.path.basename(filepath), i, len(files))

            try:
                datasets = self._process_single_file(filepath)

                if datasets:
                    self.results.extend(datasets)
                    message = f"Created {len(datasets)} dataset(s)"
                    self.observer.on_file_complete(os.path.basename(filepath), True, message)
                else:
                    message = "No valid data extracted"
                    self.observer.on_file_complete(os.path.basename(filepath), False, message)

            except Exception as e:
                message = f"Error: {str(e)}"
                self.observer.on_file_complete(os.path.basename(filepath), False, message)
                logger.error(f"Failed to process {filepath}: {str(e)}")

        # Summary
        self._print_summary()

        logger.info("=" * 60)
        logger.info("PREPROCESSING COMPLETED")
        logger.info(f"Successfully processed: {len(self.results)} datasets")
        logger.info("=" * 60)

        return self.results

    def _process_single_file(self, filepath: str) -> List[ProcessedDataset]:
        '''Process a single file and return datasets'''

        # Get appropriate processor
        processor = ProcessorFactory.get_processor(filepath)

        if not processor:
            logger.warning(f"No processor available for {filepath}")
            return []

        # Process file
        processed_data = processor.process(filepath)

        if not processed_data:
            return []

        # Save each product's data
        datasets = []
        base_name = Path(filepath).stem

        for product_name, df in processed_data.items():
            # Create clean filename
            clean_product = re.sub(r'[^a-zA-Z0-9_-]', '_', product_name)
            output_name = f"{base_name}_{clean_product}_cleaned.csv"
            output_path = os.path.join(self.config.output_folder, output_name)

            # Save cleaned data
            df.to_csv(output_path, index=False)

            # Create dataset metadata
            dataset = ProcessedDataset(
                product_name=product_name,
                filepath=output_path,
                num_records=len(df),
                date_range=(df['date'].min(), df['date'].max()),
                columns=list(df.columns)
            )

            datasets.append(dataset)
            logger.info(f"Saved: {output_name} ({len(df)} records)")

        return datasets

    def _print_summary(self):
        '''Print processing summary'''
        print("\n" + "="*60)
        print("PREPROCESSING SUMMARY")
        print("="*60)
        print(f"Datasets created: {len(self.results)}")

        if self.results:
            print(f"\nReady for training:")
            for dataset in self.results:
                status = "✅" if dataset.is_valid_for_training() else "⚠️"
                print(f"  {status} {dataset.product_name} ({dataset.num_records} days)")

        print("\n" + "="*60 + "\n")

    def get_results(self) -> List[ProcessedDataset]:
        '''Get preprocessing results'''
        return self.results
