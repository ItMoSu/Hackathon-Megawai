'''
Base Processor (Template Method Pattern)
Defines common preprocessing workflow
'''

from abc import ABC, abstractmethod
from typing import Dict, Optional
from pathlib import Path
import os
import pandas as pd
from core.interfaces import IFileProcessor, IColumnDetector, IDataCleaner, IDataValidator
from core.exceptions import FileProcessingError, ColumnDetectionError
from core.models import ProcessedDataset
from utils.validators import ColumnDetector, DataCleaner, SalesDataValidator
from utils.logger import logger


class BaseFileProcessor(IFileProcessor, ABC):
    '''
    Base class for all file processors (Template Method Pattern)
    Defines the common workflow, subclasses implement file-specific reading
    '''

    def __init__(self):
        self.column_detector: IColumnDetector = ColumnDetector()
        self.data_cleaner: IDataCleaner = DataCleaner()
        self.validator: IDataValidator = SalesDataValidator()

    def process(self, filepath: str) -> Optional[Dict[str, pd.DataFrame]]:
        '''
        Template method: defines the processing workflow
        Subclasses implement read_file()
        '''
        try:
            logger.info(f"Processing: {filepath}")

            # Step 1: Read file (implemented by subclass)
            df = self.read_file(filepath)

            if df is None or df.empty:
                logger.error("Failed to read file or file is empty")
                return None

            # Step 2: Detect columns
            date_col = self.column_detector.detect_date_column(df)
            quantity_col = self.column_detector.detect_quantity_column(df)
            product_col = self.column_detector.detect_product_column(df)

            if not date_col or not quantity_col:
                raise ColumnDetectionError(
                    f"Could not detect required columns. "
                    f"Date: {date_col}, Quantity: {quantity_col}"
                )

            logger.info(f"Detected columns - Date: '{date_col}', Quantity: '{quantity_col}', Product: '{product_col}'")

            # Step 3: Standardize data
            # Fallback product id from filename (sanitized)
            fallback_product = os.path.splitext(os.path.basename(filepath))[0]
            fallback_product = fallback_product.replace(" ", "_").lower()

            standardized = self._standardize_dataframe(
                df, date_col, quantity_col, product_col, fallback_product
            )

            if not standardized:
                logger.error("Failed to standardize data")
                return None

            logger.info(f"Successfully processed {len(standardized)} product(s)")
            return standardized

        except Exception as e:
            logger.error(f"Processing failed: {str(e)}")
            return None

    @abstractmethod
    def read_file(self, filepath: str) -> Optional[pd.DataFrame]:
        '''
        Read file and return DataFrame
        Must be implemented by subclass (Strategy Pattern)
        '''
        pass

    def _standardize_dataframe(
        self,
        df: pd.DataFrame,
        date_col: str,
        quantity_col: str,
        product_col: Optional[str],
        fallback_product: str
    ) -> Optional[Dict[str, pd.DataFrame]]:
        '''Standardize dataframe to common format'''

        cleaned_records = []

        for _, row in df.iterrows():
            date_val = self.data_cleaner.clean_date(row[date_col])
            quantity_val = self.data_cleaner.clean_quantity(row[quantity_col])

            if date_val and quantity_val:
                record = {
                    'date': date_val,
                    'quantity': quantity_val
                }

                if product_col and product_col in row:
                    record['product'] = str(row[product_col]).strip()

                cleaned_records.append(record)

        if not cleaned_records:
            logger.warning("No valid records after cleaning")
            return None

        output_df = pd.DataFrame(cleaned_records)

        # Group by product if multiple products
        if 'product' in output_df.columns:
            products = output_df['product'].unique()
            logger.info(f"Found {len(products)} product(s)")

            results = {}
            warn_limit = 5
            warn_count = 0
            warn_suppressed = 0
            for product in products:
                product_df = output_df[output_df['product'] == product][['date', 'quantity']]
                product_df = product_df.sort_values('date').reset_index(drop=True)

                # Remove outliers
                product_df = self.data_cleaner.remove_outliers(product_df)

                if self.validator.validate_dataframe(product_df):
                    results[product] = product_df
                    logger.info(f"  ✓ {product}: {len(product_df)} days")
                else:
                    if warn_count < warn_limit:
                        logger.warning(f"  Invalid {product}: {self.validator.get_validation_errors()}")
                        warn_count += 1
                    else:
                        warn_suppressed += 1

            if warn_suppressed:
                logger.warning(f"  ...suppressed {warn_suppressed} additional validation warnings")

            return results if results else None

        # Single product fallback uses filename instead of "default"
        output_df = output_df[['date', 'quantity']].sort_values('date').reset_index(drop=True)
        output_df = self.data_cleaner.remove_outliers(output_df)

        if self.validator.validate_dataframe(output_df):
            logger.info(f"✓ Single product: {len(output_df)} days")
            return {fallback_product: output_df}

        logger.warning(f"✗ Validation failed: {self.validator.get_validation_errors()}")
        return None
