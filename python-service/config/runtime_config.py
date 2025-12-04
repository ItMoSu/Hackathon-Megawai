"""
Runtime configuration for AI Market Pulse.

Defaults target Indonesian UMKM context (weekend = Sat/Sun, payday awal/akhir bulan)
but everything can be overridden via JSON config pointed by the
MARKET_PULSE_RUNTIME_CONFIG_PATH environment variable.
"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass, field, is_dataclass
from typing import Dict, List, Tuple, Optional, Any


@dataclass
class RuntimeCalendarConfig:
    weekend_dows: List[int] = field(default_factory=lambda: [5, 6])
    payday_ranges: List[Tuple[int, int]] = field(default_factory=lambda: [(1, 5), (25, 31)])
    payday_multiplier: float = 1.15
    special_boost_dates: Dict[str, float] = field(default_factory=dict)


@dataclass
class RuntimeDemandConfig:
    ema_spans: Dict[str, int] = field(default_factory=lambda: {"short": 7, "medium": 14, "long": 30})
    ema_weights: Dict[str, float] = field(default_factory=lambda: {"short": 0.5, "medium": 0.3, "long": 0.2})
    momentum_thresholds: Dict[str, float] = field(
        default_factory=lambda: {
            "up_strong": 0.05,
            "up_mild": 0.02,
            "down_strong": -0.05,
            "down_mild": -0.02,
        }
    )
    baseline_window_days: int = 30
    burst_thresholds: Dict[str, float] = field(
        default_factory=lambda: {"critical": 3.0, "significant": 2.0, "mild": 1.0}
    )
    burst_viral_threshold: float = 4.0
    burst_seasonal_window_days: int = 28
    weekend_seasonal_ratio: float = 1.2
    residual_fallback_ratio: float = 0.1  # fallback sigma as % of mean quantity
    trend_factor_scale: float = 0.1
    smoothing_max_change_fraction: float = 0.3
    min_prediction_quantity: float = 1.0
    forecast_uncertainty_z: float = 1.64
    priority_momentum_weight: float = 0.7
    priority_burst_weight: float = 0.3
    priority_burst_divisor: float = 3.0
    priority_m_clamp_min: float = -1.0
    priority_m_clamp_max: float = 1.0
    ensemble_ml_weight_default: float = 0.8
    ensemble_ml_weight_min: float = 0.5
    ensemble_ml_weight_max: float = 0.9
    ensemble_high_conf_threshold: float = 0.7


@dataclass
class RuntimeRankingConfig:
    momentum_status_multipliers: Dict[str, float] = field(
        default_factory=lambda: {
            "TRENDING_UP": 1.30,
            "GROWING": 1.15,
            "STABLE": 1.00,
            "FALLING": 0.85,
            "DECLINING": 0.70,
        }
    )
    burst_level_multipliers: Dict[str, float] = field(
        default_factory=lambda: {
            "CRITICAL": 1.50,
            "HIGH": 1.25,
            "MEDIUM": 1.10,
            "LOW": 1.00,
        }
    )
    priority_weights: Dict[str, float] = field(
        default_factory=lambda: {"CRITICAL": 1000, "HIGH": 100, "MEDIUM": 10, "LOW": 1}
    )
    urgency_scores: Dict[str, float] = field(
        default_factory=lambda: {
            "priority_critical": 1000,
            "priority_high": 500,
            "declining_falling": 300,
            "burst_attention": 400,
        }
    )


@dataclass
class RuntimeInventoryConfig:
    service_level_config: Dict[str, Dict[str, float]] = field(
        default_factory=lambda: {
            "low": {"z_score": 1.04, "confidence": 85, "description": "Basic"},
            "medium": {"z_score": 1.65, "confidence": 95, "description": "Standard"},
            "high": {"z_score": 2.05, "confidence": 98, "description": "Premium"},
            "critical": {"z_score": 2.58, "confidence": 99.5, "description": "Mission-Critical"},
        }
    )


@dataclass
class RuntimeConfig:
    calendar: RuntimeCalendarConfig = field(default_factory=RuntimeCalendarConfig)
    demand: RuntimeDemandConfig = field(default_factory=RuntimeDemandConfig)
    ranking: RuntimeRankingConfig = field(default_factory=RuntimeRankingConfig)
    inventory: RuntimeInventoryConfig = field(default_factory=RuntimeInventoryConfig)


def _apply_overrides(target: Any, overrides: Dict[str, Any]) -> None:
    """Shallow merge overrides into dataclass/fields."""
    for key, value in overrides.items():
        if not hasattr(target, key):
            continue

        current = getattr(target, key)
        if is_dataclass(current) and isinstance(value, dict):
            _apply_overrides(current, value)
        elif isinstance(current, dict) and isinstance(value, dict):
            current.update(value)
        else:
            setattr(target, key, value)


_RUNTIME_CONFIG: Optional[RuntimeConfig] = None


def get_runtime_config() -> RuntimeConfig:
    """Return singleton runtime config with optional JSON overrides."""
    global _RUNTIME_CONFIG
    if _RUNTIME_CONFIG is not None:
        return _RUNTIME_CONFIG

    config = RuntimeConfig()
    config_path = os.getenv("MARKET_PULSE_RUNTIME_CONFIG_PATH")
    if config_path and os.path.exists(config_path):
        try:
            with open(config_path, "r", encoding="utf-8") as f:
                overrides = json.load(f)
            if isinstance(overrides, dict):
                _apply_overrides(config, overrides)
        except Exception:
            # Ignore bad config to keep service running with defaults
            pass

    _RUNTIME_CONFIG = config
    return config


__all__ = [
    "RuntimeConfig",
    "RuntimeCalendarConfig",
    "RuntimeDemandConfig",
    "RuntimeRankingConfig",
    "RuntimeInventoryConfig",
    "get_runtime_config",
]
