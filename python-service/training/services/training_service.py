'''
Training Service
Orchestrates model training workflow
'''

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

import glob
import pandas as pd
from typing import List
from pathlib import Path
import time

from core.interfaces import IProgressObserver, IModelTrainer
from core.models import TrainingResult, TrainingConfig
from core.exceptions import TrainingError, InsufficientDataError
from models.xgboost_optimal import forecaster
from utils.logger import logger
from utils.validators import SalesDataValidator


class XGBoostModelTrainer(IModelTrainer):
    '''
    XGBoost model trainer (Adapter Pattern)
    Adapts existing forecaster to IModelTrainer interface
    '''

    def train(self, sales_data: List[dict], product_id: str) -> TrainingResult:
        '''Train XGBoost model'''
        start_time = time.time()

        try:
            # Validate data
            validator = SalesDataValidator()
            if not validator.validate_sales_data(sales_data):
                raise InsufficientDataError(
                    f"Invalid data: {validator.get_validation_errors()}"
                )

            # Train
            result = forecaster.train(sales_data, product_id)

            training_time = time.time() - start_time

            return TrainingResult(
                product_id=product_id,
                success=True,
                model_path=None,
                metrics=result['metrics'],
                training_time=training_time
            )

        except Exception as e:
            training_time = time.time() - start_time
            logger.error(f"Training failed for {product_id}: {str(e)}")

            return TrainingResult(
                product_id=product_id,
                success=False,
                error_message=str(e),
                training_time=training_time
            )

    def save_model(self, product_id: str, output_path: str) -> bool:
        '''Save trained model'''
        try:
            forecaster.save_model(product_id, output_path)
            return True
        except Exception as e:
            logger.error(f"Failed to save model {product_id}: {str(e)}")
            return False

    def load_model(self, product_id: str, model_path: str) -> bool:
        '''Load existing model'''
        try:
            forecaster.load_model(product_id, model_path)
            return True
        except Exception as e:
            logger.error(f"Failed to load model {product_id}: {str(e)}")
            return False


class TrainingService:
    '''
    High-level training service
    Coordinates training workflow
    '''

    def __init__(
        self,
        config: TrainingConfig,
        trainer: IModelTrainer = None,
        observer: IProgressObserver = None
    ):
        self.config = config
        self.trainer = trainer or XGBoostModelTrainer()
        self.observer = observer
        self.results: List[TrainingResult] = []

    def discover_datasets(self) -> List[str]:
        '''Find all preprocessed CSV files'''
        pattern = os.path.join(self.config.input_folder, "*_cleaned.csv")
        return sorted(glob.glob(pattern))

    def train_all(self) -> List[TrainingResult]:
        '''Train models for all preprocessed datasets'''

        logger.info("=" * 60)
        logger.info("TRAINING STARTED")
        logger.info("=" * 60)

        print("\n" + "="*60)
        print("MODEL TRAINING")
        print("="*60)

        # Discover datasets
        datasets = self.discover_datasets()

        if not datasets:
            logger.warning(f"No datasets found in {self.config.input_folder}")
            print(f"\n❌ No preprocessed data found in: {self.config.input_folder}")
            print(f"Run preprocessing first: python preprocess.py\n")
            return []

        logger.info(f"Found {len(datasets)} dataset(s)")
        print(f"\nFound {len(datasets)} dataset(s)\n")

        # Ensure output directory exists
        os.makedirs(self.config.output_folder, exist_ok=True)

        # Train each dataset
        self.results = []

        for i, csv_path in enumerate(datasets, 1):
            product_id = Path(csv_path).stem.replace('_cleaned', '')

            if self.observer:
                self.observer.on_training_start(product_id, i, len(datasets))

            try:
                result = self._train_single_dataset(csv_path, product_id)
                self.results.append(result)

                if self.observer:
                    self.observer.on_training_complete(product_id, result)

            except Exception as e:
                logger.error(f"Training failed for {product_id}: {str(e)}")
                result = TrainingResult(
                    product_id=product_id,
                    success=False,
                    error_message=str(e)
                )
                self.results.append(result)

                if self.observer:
                    self.observer.on_training_complete(product_id, result)

        # Summary
        self._print_summary()

        logger.info("=" * 60)
        logger.info("TRAINING COMPLETED")
        logger.info(f"Success: {sum(1 for r in self.results if r.success)}/{len(self.results)}")
        logger.info("=" * 60)

        return self.results

    def _train_single_dataset(self, csv_path: str, product_id: str) -> TrainingResult:
        '''Train model for single dataset'''

        # Load data
        df = pd.read_csv(csv_path)
        sales_data = df.to_dict('records')

        logger.info(f"Training {product_id} with {len(sales_data)} records")

        # Train
        result = self.trainer.train(sales_data, product_id)

        if result.success:
            # Save model
            model_path = os.path.join(
                self.config.output_folder,
                f"xgboost_{product_id}.pkl"
            )

            if self.trainer.save_model(product_id, model_path):
                result.model_path = model_path
                logger.info(f"Model saved: {model_path}")
            else:
                logger.warning(f"Failed to save model for {product_id}")

        return result

    def _print_summary(self):
        '''Print training summary'''
        success_count = sum(1 for r in self.results if r.success)
        failed_count = len(self.results) - success_count

        print("\n" + "="*60)
        print("TRAINING SUMMARY")
        print("="*60)
        print(f"Total datasets:  {len(self.results)}")
        print(f"✅ Success:      {success_count}")
        print(f"❌ Failed:       {failed_count}")

        if success_count > 0:
            print(f"\nSuccessfully trained:")
            for result in self.results:
                if result.success:
                    mae = result.metrics['validation']['mae']
                    print(f"  • {result.product_id} (Val MAE: {mae:.2f})")

        if failed_count > 0:
            print(f"\nFailed:")
            for result in self.results:
                if not result.success:
                    print(f"  • {result.product_id}: {result.error_message}")

        print("\n" + "="*60 + "\n")

    def get_results(self) -> List[TrainingResult]:
        '''Get training results'''
        return self.results
