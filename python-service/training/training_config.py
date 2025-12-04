'''
Central Configuration (Single point of configuration)
'''

import os
from pathlib import Path
from core.models import ProcessingConfig, TrainingConfig

# Base paths
BASE_DIR = Path(__file__).parent
DATASETS_DIR = BASE_DIR / 'datasets'
PREPROCESSED_DIR = BASE_DIR / 'preprocessed'
MODELS_DIR = BASE_DIR / 'models_output'
LOGS_DIR = BASE_DIR / 'logs'

# Create directories
for dir_path in [DATASETS_DIR, PREPROCESSED_DIR, MODELS_DIR, LOGS_DIR]:
    dir_path.mkdir(exist_ok=True)

# Configurations
PREPROCESSING_CONFIG = ProcessingConfig(
    input_folder=str(DATASETS_DIR),
    output_folder=str(PREPROCESSED_DIR),
    min_records=30,
    remove_outliers=True,
    outlier_std=3.0
)

TRAINING_CONFIG = TrainingConfig(
    input_folder=str(PREPROCESSED_DIR),
    output_folder=str(MODELS_DIR),
    validation_split=0.2,
    early_stopping=True,
    n_estimators=200
)

# Logging configuration
LOG_FORMAT = '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
LOG_LEVEL = 'INFO'
LOG_FILE = LOGS_DIR / 'training.log'
