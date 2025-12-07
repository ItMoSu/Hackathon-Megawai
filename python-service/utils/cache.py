"""
Simple LRU cache for ML models to avoid repeated loading
"""

from collections import OrderedDict
from typing import Any, Optional
import threading
import time
import logging

logger = logging.getLogger(__name__)

class ModelCache:
    """
    Thread-safe LRU cache for ML models
    """
    def __init__(self, max_size: int = 50, ttl_seconds: int = 3600):
        self._cache: OrderedDict[str, tuple[Any, float]] = OrderedDict()
        self._max_size = max_size
        self._ttl = ttl_seconds
        self._lock = threading.Lock()
        self._hits = 0
        self._misses = 0
    
    def get(self, key: str) -> Optional[Any]:
        """Get item from cache if exists and not expired"""
        with self._lock:
            if key not in self._cache:
                self._misses += 1
                return None
            
            value, timestamp = self._cache[key]
            
            # Check if expired
            if time.time() - timestamp > self._ttl:
                del self._cache[key]
                self._misses += 1
                return None
            
            # Move to end (most recently used)
            self._cache.move_to_end(key)
            self._hits += 1
            return value
    
    def set(self, key: str, value: Any) -> None:
        """Add item to cache"""
        with self._lock:
            # Remove oldest if at capacity
            while len(self._cache) >= self._max_size:
                oldest_key = next(iter(self._cache))
                del self._cache[oldest_key]
                logger.debug(f"Evicted cache key: {oldest_key}")
            
            self._cache[key] = (value, time.time())
    
    def remove(self, key: str) -> bool:
        """Remove item from cache"""
        with self._lock:
            if key in self._cache:
                del self._cache[key]
                return True
            return False
    
    def clear(self) -> None:
        """Clear all items"""
        with self._lock:
            self._cache.clear()
            self._hits = 0
            self._misses = 0
    
    def stats(self) -> dict:
        """Get cache statistics"""
        with self._lock:
            total = self._hits + self._misses
            hit_rate = (self._hits / total * 100) if total > 0 else 0
            return {
                "size": len(self._cache),
                "max_size": self._max_size,
                "hits": self._hits,
                "misses": self._misses,
                "hit_rate": f"{hit_rate:.1f}%"
            }

# Global model cache instance
model_cache = ModelCache(max_size=50, ttl_seconds=3600)
