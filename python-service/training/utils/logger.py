'''
Logging utility (Singleton Pattern)
'''

import logging
import sys
from pathlib import Path
from typing import Optional


def _sanitize(message: str) -> str:
    """
    Best-effort sanitization to avoid UnicodeEncodeError on narrow consoles.
    Drops non-ASCII characters to keep console/file logging safe.
    """
    return message.encode('ascii', 'ignore').decode('ascii')


class Logger:
    '''Singleton logger'''
    _instance: Optional['Logger'] = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if self._initialized:
            return

        self._initialized = True
        self.logger = logging.getLogger('MLPipeline')
        self.logger.setLevel(logging.INFO)

        # Try to force stdout to UTF-8 to avoid encoding issues with symbols
        if hasattr(sys.stdout, "reconfigure"):
            try:
                sys.stdout.reconfigure(encoding='utf-8', errors='replace')
            except Exception:
                pass

        # Console handler
        console_handler = logging.StreamHandler(sys.stdout)
        console_handler.setLevel(logging.INFO)
        console_format = logging.Formatter(
            '%(levelname)s - %(message)s'
        )
        console_handler.setFormatter(console_format)

        # File handler
        file_handler = logging.FileHandler('logs/training.log', encoding='utf-8')
        file_handler.setLevel(logging.DEBUG)
        file_format = logging.Formatter(
            '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )
        file_handler.setFormatter(file_format)

        self.logger.addHandler(console_handler)
        self.logger.addHandler(file_handler)

    def _log(self, level: int, message: str):
        safe_msg = _sanitize(message)
        self.logger.log(level, safe_msg)

    def info(self, message: str):
        self._log(logging.INFO, message)

    def error(self, message: str):
        self._log(logging.ERROR, message)

    def warning(self, message: str):
        self._log(logging.WARNING, message)

    def debug(self, message: str):
        self._log(logging.DEBUG, message)


# Global logger instance
logger = Logger()
