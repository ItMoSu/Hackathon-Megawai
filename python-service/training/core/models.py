'''
Data Models (Single Responsibility)
Clean data structures with validation
'''

from dataclasses import dataclass, field
from typing import List, Dict, Optional
from datetime import datetime


@dataclass
class ProcessedDataset:
    '''Represents a cleaned dataset'''
    product_name: str
    filepath: str
    num_records: int
    date_range: tuple
    columns: List[str]
    created_at: datetime = field(default_factory=datetime.now)

    def is_valid_for_training(self) -> bool:
        '''Check if dataset has enough data for training'''
        return self.num_records >= 30

    def to_dict(self) -> Dict:
        '''Convert to dictionary'''
        return {
            'product_name': self.product_name,
            'filepath': self.filepath,
            'num_records': self.num_records,
            'date_range': self.date_range,
            'columns': self.columns,
            'created_at': self.created_at.isoformat()
        }


@dataclass
class TrainingResult:
    '''Represents training outcome'''
    product_id: str
    success: bool
    model_path: Optional[str] = None
    metrics: Optional[Dict] = None
    error_message: Optional[str] = None
    training_time: float = 0.0

    def to_dict(self) -> Dict:
        '''Convert to dictionary'''
        return {
            'product_id': self.product_id,
            'success': self.success,
            'model_path': self.model_path,
            'metrics': self.metrics,
            'error': self.error_message,
            'training_time': self.training_time
        }


@dataclass
class ProcessingConfig:
    '''Configuration for preprocessing'''
    input_folder: str = 'datasets'
    output_folder: str = 'preprocessed'
    min_records: int = 30
    remove_outliers: bool = True
    outlier_std: float = 3.0
    date_formats: List[str] = field(default_factory=lambda: [
        '%Y-%m-%d', '%d/%m/%Y', '%m/%d/%Y',
        '%Y/%m/%d', '%d-%m-%Y', '%Y%m%d'
    ])


@dataclass
class TrainingConfig:
    '''Configuration for training'''
    input_folder: str = 'preprocessed'
    output_folder: str = 'models_output'
    model_type: str = 'xgboost'
    validation_split: float = 0.2
    early_stopping: bool = True
    n_estimators: int = 200
