'''Word Document Processor'''

import pandas as pd
from typing import List, Optional
from .base import BaseFileProcessor


class DOCXProcessor(BaseFileProcessor):
    '''Processes DOCX files (requires python-docx)'''

    def can_process(self, filepath: str) -> bool:
        return filepath.lower().endswith('.docx')

    def get_supported_extensions(self) -> List[str]:
        return ['.docx']

    def read_file(self, filepath: str) -> Optional[pd.DataFrame]:
        '''Extract tables from Word document'''
        try:
            from docx import Document

            doc = Document(filepath)

            # Extract first valid table
            for table in doc.tables:
                data = []
                for row in table.rows:
                    data.append([cell.text.strip() for cell in row.cells])

                if len(data) > 1:
                    df = pd.DataFrame(data[1:], columns=data[0])
                    if len(df.columns) >= 2:
                        return df

            from utils.logger import logger
            logger.warning("No valid tables found in DOCX")
            return None

        except ImportError:
            from utils.logger import logger
            logger.error("python-docx not installed. Run: pip install python-docx")
            return None
        except Exception as e:
            from utils.logger import logger
            logger.error(f"DOCX read error: {str(e)}")
            return None
