'''
Abstract Base Classes (Interface Segregation Principle)
Defines contracts for all components
'''

from abc import ABC, abstractmethod
from typing import Dict, List, Optional
import pandas as pd
from .models import ProcessedDataset, TrainingResult


class IFileProcessor(ABC):
    '''
    Interface for file processors (Strategy Pattern)
    Each file type implements this interface
    '''

    @abstractmethod
    def can_process(self, filepath: str) -> bool:
        '''Check if this processor can handle the file'''
        pass

    @abstractmethod
    def process(self, filepath: str) -> Optional[Dict[str, pd.DataFrame]]:
        '''
        Process file and return cleaned data
        Returns: Dict[product_name, DataFrame] or None if failed
        '''
        pass

    @abstractmethod
    def get_supported_extensions(self) -> List[str]:
        '''Return list of supported file extensions'''
        pass


class IDataValidator(ABC):
    '''
    Interface for data validation (Single Responsibility)
    '''

    @abstractmethod
    def validate_dataframe(self, df: pd.DataFrame) -> bool:
        '''Validate if dataframe has required columns and data'''
        pass

    @abstractmethod
    def validate_sales_data(self, sales_data: List[Dict]) -> bool:
        '''Validate sales data format'''
        pass

    @abstractmethod
    def get_validation_errors(self) -> List[str]:
        '''Return list of validation errors'''
        pass


class IColumnDetector(ABC):
    '''
    Interface for column detection (Single Responsibility)
    '''

    @abstractmethod
    def detect_date_column(self, df: pd.DataFrame) -> Optional[str]:
        '''Auto-detect date column'''
        pass

    @abstractmethod
    def detect_quantity_column(self, df: pd.DataFrame) -> Optional[str]:
        '''Auto-detect quantity column'''
        pass

    @abstractmethod
    def detect_product_column(self, df: pd.DataFrame) -> Optional[str]:
        '''Auto-detect product name column'''
        pass


class IDataCleaner(ABC):
    '''
    Interface for data cleaning (Single Responsibility)
    '''

    @abstractmethod
    def clean_date(self, date_str: str) -> Optional[str]:
        '''Clean and standardize date format'''
        pass

    @abstractmethod
    def clean_quantity(self, quantity_val) -> Optional[float]:
        '''Clean and validate quantity value'''
        pass

    @abstractmethod
    def remove_outliers(self, df: pd.DataFrame) -> pd.DataFrame:
        '''Remove outlier data points'''
        pass


class IModelTrainer(ABC):
    '''
    Interface for model training (Dependency Inversion)
    '''

    @abstractmethod
    def train(self, sales_data: List[Dict], product_id: str) -> TrainingResult:
        '''Train model and return results'''
        pass

    @abstractmethod
    def save_model(self, product_id: str, output_path: str) -> bool:
        '''Save trained model'''
        pass

    @abstractmethod
    def load_model(self, product_id: str, model_path: str) -> bool:
        '''Load existing model'''
        pass


class IProgressObserver(ABC):
    '''
    Interface for progress tracking (Observer Pattern)
    '''

    @abstractmethod
    def on_file_start(self, filename: str, index: int, total: int):
        '''Called when file processing starts'''
        pass

    @abstractmethod
    def on_file_complete(self, filename: str, success: bool, message: str):
        '''Called when file processing completes'''
        pass

    @abstractmethod
    def on_training_start(self, product_id: str, index: int, total: int):
        '''Called when training starts'''
        pass

    @abstractmethod
    def on_training_complete(self, product_id: str, result: TrainingResult):
        '''Called when training completes'''
        pass
