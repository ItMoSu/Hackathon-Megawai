'''Excel File Processor'''

import pandas as pd
from typing import List, Optional
from .base import BaseFileProcessor


class ExcelProcessor(BaseFileProcessor):
    '''Processes Excel files (XLSX, XLS)'''

    def can_process(self, filepath: str) -> bool:
        return filepath.lower().endswith(('.xlsx', '.xls'))

    def get_supported_extensions(self) -> List[str]:
        return ['.xlsx', '.xls']

    def read_file(self, filepath: str) -> Optional[pd.DataFrame]:
        '''Read Excel file (first sheet)'''
        try:
            df = pd.read_excel(filepath, sheet_name=0, engine='openpyxl')
            return df
        except Exception as e:
            from utils.logger import logger
            logger.error(f"Excel read error: {str(e)}")
            return None
