'''Text File Processor'''

import pandas as pd
from typing import List, Optional
from .base import BaseFileProcessor


class TextProcessor(BaseFileProcessor):
    '''Processes TXT files (assumes CSV-like format)'''

    def can_process(self, filepath: str) -> bool:
        return filepath.lower().endswith('.txt')

    def get_supported_extensions(self) -> List[str]:
        return ['.txt']

    def read_file(self, filepath: str) -> Optional[pd.DataFrame]:
        '''Read text file with multiple separator attempts'''
        from utils.logger import logger

        for sep in [',', '\t', ';', '|']:
            try:
                df = pd.read_csv(filepath, sep=sep, encoding='utf-8')
                if len(df.columns) > 1:
                    return df
            except Exception:
                continue

        logger.error("Failed to parse TXT file with any separator")
        return None
