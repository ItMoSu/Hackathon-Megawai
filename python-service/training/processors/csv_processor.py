'''CSV File Processor (Strategy Pattern)'''

import pandas as pd
from typing import List, Optional
from .base import BaseFileProcessor


class CSVProcessor(BaseFileProcessor):
    '''Processes CSV files'''

    def can_process(self, filepath: str) -> bool:
        return filepath.lower().endswith('.csv')

    def get_supported_extensions(self) -> List[str]:
        return ['.csv']

    def read_file(self, filepath: str) -> Optional[pd.DataFrame]:
        '''Read CSV with multiple encoding attempts'''
        from utils.logger import logger

        for encoding in ['utf-8', 'latin-1', 'cp1252', 'iso-8859-1']:
            try:
                df = pd.read_csv(filepath, encoding=encoding)
                return df
            except UnicodeDecodeError:
                continue
            except Exception as e:
                logger.error(f"CSV read error: {str(e)}")
                return None

        logger.error("Failed to read CSV with any encoding")
        return None
