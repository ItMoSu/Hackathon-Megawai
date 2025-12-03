'''Processor Factory (Factory Pattern)'''

from typing import Optional
from core.interfaces import IFileProcessor
from .csv_processor import CSVProcessor
from .excel_processor import ExcelProcessor
from .text_processor import TextProcessor
from .pdf_processor import PDFProcessor
from .docx_processor import DOCXProcessor


class ProcessorFactory:
    '''Factory for creating appropriate file processor'''

    _processors = [
        CSVProcessor(),
        ExcelProcessor(),
        TextProcessor(),
        PDFProcessor(),
        DOCXProcessor()
    ]

    @classmethod
    def get_processor(cls, filepath: str) -> Optional[IFileProcessor]:
        '''Get appropriate processor for file'''
        for processor in cls._processors:
            if processor.can_process(filepath):
                return processor
        return None

    @classmethod
    def get_supported_extensions(cls) -> list:
        '''Get all supported file extensions'''
        extensions = []
        for processor in cls._processors:
            extensions.extend(processor.get_supported_extensions())
        return extensions
