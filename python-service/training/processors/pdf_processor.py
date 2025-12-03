'''PDF File Processor'''

import pandas as pd
from typing import List, Optional
from .base import BaseFileProcessor


class PDFProcessor(BaseFileProcessor):
    '''Processes PDF files (requires tabula-py)'''

    def can_process(self, filepath: str) -> bool:
        return filepath.lower().endswith('.pdf')

    def get_supported_extensions(self) -> List[str]:
        return ['.pdf']

    def read_file(self, filepath: str) -> Optional[pd.DataFrame]:
        '''Extract tables from PDF'''
        try:
            import tabula

            # Extract all tables
            tables = tabula.read_pdf(filepath, pages='all', multiple_tables=True)

            if not tables:
                from utils.logger import logger
                logger.warning("No tables found in PDF")
                return None

            # Return first table with enough columns
            for table in tables:
                if isinstance(table, pd.DataFrame) and len(table.columns) >= 2:
                    return table

            return None

        except ImportError:
            from utils.logger import logger
            logger.error("tabula-py not installed. Run: pip install tabula-py")
            return None
        except Exception as e:
            from utils.logger import logger
            logger.error(f"PDF read error: {str(e)}")
            return None
