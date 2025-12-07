"""
Weekly Report Ranking Module - Business Intelligence
Smart ranking with 4 strategies, portfolio health scoring
"""

import numpy as np
from typing import Dict, List, Literal
import logging

from config.runtime_config import get_runtime_config

logger = logging.getLogger(__name__)
runtime_config = get_runtime_config()

RankingStrategy = Literal["volume_only", "momentum_weighted", "opportunity_score", "balanced"]


class WeeklyReportRanker:
    def __init__(self, default_strategy: RankingStrategy = "balanced"):
        self.default_strategy = default_strategy
        self.momentum_status_multipliers = runtime_config.ranking.momentum_status_multipliers
        self.burst_level_multipliers = runtime_config.ranking.burst_level_multipliers
        self.priority_weights = runtime_config.ranking.priority_weights
        self.urgency_scores = runtime_config.ranking.urgency_scores

    def _calculate_volume_score(self, forecast: float) -> float:
        return forecast

    def _calculate_momentum_weighted_score(self, forecast: float, momentum_status: str) -> float:
        multiplier = self.momentum_status_multipliers.get(momentum_status, 1.0)
        return forecast * multiplier

    def _calculate_opportunity_score(self, forecast: float, momentum_status: str, burst_level: str) -> float:
        momentum_mult = self.momentum_status_multipliers.get(momentum_status, 1.0)
        burst_mult = self.burst_level_multipliers.get(burst_level, 1.0)
        return forecast * momentum_mult * burst_mult

    def _calculate_balanced_score(self, forecast: float, momentum_status: str, burst_level: str, priority: str) -> float:
        volume_score = forecast
        momentum_mult = self.momentum_status_multipliers.get(momentum_status, 1.0)
        burst_mult = self.burst_level_multipliers.get(burst_level, 1.0)
        priority_weight = self.priority_weights.get(priority, 1)

        if priority == "CRITICAL":
            score = priority_weight + (volume_score * momentum_mult * burst_mult)
        else:
            score = volume_score * momentum_mult * burst_mult + priority_weight

        return score

    def rank_products(self, products: List[Dict], strategy: RankingStrategy = None, top_n: int = None) -> List[Dict]:
        """Rank products using specified strategy"""
        if strategy is None:
            strategy = self.default_strategy

        logger.info(f"Ranking {len(products)} products using '{strategy}' strategy")

        for product in products:
            forecast = product.get("next_week_forecast", 0)
            momentum_status = product.get("momentum", {}).get("status", "STABLE")
            burst_level = product.get("burst", {}).get("level", "LOW")
            priority = product.get("recommendation", {}).get("priority", "LOW")

            if strategy == "volume_only":
                score = self._calculate_volume_score(forecast)
            elif strategy == "momentum_weighted":
                score = self._calculate_momentum_weighted_score(forecast, momentum_status)
            elif strategy == "opportunity_score":
                score = self._calculate_opportunity_score(forecast, momentum_status, burst_level)
            elif strategy == "balanced":
                score = self._calculate_balanced_score(forecast, momentum_status, burst_level, priority)
            else:
                score = self._calculate_volume_score(forecast)

            product["_rank_score"] = score

        sorted_products = sorted(products, key=lambda x: x["_rank_score"], reverse=True)

        for idx, product in enumerate(sorted_products, start=1):
            product["_rank_position"] = idx

        return sorted_products[:top_n] if top_n is not None else sorted_products

    def identify_needs_attention(self, products: List[Dict], top_n: int = 10) -> List[Dict]:
        """Identify products needing attention"""
        attention_products = []

        for product in products:
            priority = product.get("recommendation", {}).get("priority", "LOW")
            momentum_status = product.get("momentum", {}).get("status", "STABLE")
            burst_level = product.get("burst", {}).get("level", "LOW")
            forecast = product.get("next_week_forecast", 0)

            needs_attention = False
            urgency_score = 0

            if priority == "CRITICAL":
                needs_attention = True
                urgency_score = self.urgency_scores.get("priority_critical", 1000)
            elif priority == "HIGH":
                needs_attention = True
                urgency_score = self.urgency_scores.get("priority_high", 500)
            elif forecast > 50 and momentum_status in ["FALLING", "DECLINING"]:
                needs_attention = True
                urgency_score = self.urgency_scores.get("declining_falling", 300)
            elif burst_level == "CRITICAL" and momentum_status not in ["TRENDING_UP", "GROWING"]:
                needs_attention = True
                urgency_score = self.urgency_scores.get("burst_attention", 400)

            if needs_attention:
                product["_attention_urgency"] = urgency_score
                attention_products.append(product)

        sorted_attention = sorted(attention_products, key=lambda x: x["_attention_urgency"], reverse=True)
        return sorted_attention[:top_n]

    def generate_insights(self, products: List[Dict], top_performers: List[Dict], needs_attention: List[Dict]) -> Dict:
        """Generate business intelligence insights"""
        total = len(products)

        trending_up = sum(1 for p in products if p.get("momentum", {}).get("status") == "TRENDING_UP")
        growing = sum(1 for p in products if p.get("momentum", {}).get("status") == "GROWING")
        stable = sum(1 for p in products if p.get("momentum", {}).get("status") == "STABLE")
        falling = sum(1 for p in products if p.get("momentum", {}).get("status") == "FALLING")
        declining = sum(1 for p in products if p.get("momentum", {}).get("status") == "DECLINING")

        critical_bursts = sum(1 for p in products if p.get("burst", {}).get("level") == "CRITICAL")
        high_bursts = sum(1 for p in products if p.get("burst", {}).get("level") == "HIGH")

        # Avoid division by zero - if no products, set default neutral score
        if total == 0:
            health_score = 50.0
        else:
            health_score = ((trending_up + growing) * 2 + stable * 1 - (falling + declining) * 1) / total * 50 + 50

        if health_score >= 80:
            health_status = "EXCELLENT"
            health_message = "Portfolio sangat sehat! Mayoritas produk growing."
        elif health_score >= 60:
            health_status = "GOOD"
            health_message = "Portfolio sehat. Beberapa produk perlu perhatian."
        elif health_score >= 40:
            health_status = "FAIR"
            health_message = "Portfolio mixed. Perlu strategi untuk produk declining."
        else:
            health_status = "POOR"
            health_message = "Portfolio butuh intervensi. Banyak produk declining."

        strategic_recs = []

        if critical_bursts > 0:
            strategic_recs.append(f"🚀 {critical_bursts} produk experiencing VIRAL BURST - scale up produksi!")

        if total > 0:
            if declining > total * 0.3:
                strategic_recs.append(f"⚠️ {declining} produk ({declining/total*100:.0f}%) declining - butuh analisis kompetitor dan strategi retention.")

            if trending_up > total * 0.3:
                strategic_recs.append(f"📈 {trending_up} produk ({trending_up/total*100:.0f}%) trending up - capitalize momentum dengan marketing push!")

        return {
            "portfolio_health": {
                "score": round(health_score, 1),
                "status": health_status,
                "message": health_message
            },
            "momentum_distribution": {
                "trending_up": trending_up,
                "growing": growing,
                "stable": stable,
                "falling": falling,
                "declining": declining
            },
            "burst_activity": {
                "critical": critical_bursts,
                "high": high_bursts
            },
            "strategic_recommendations": strategic_recs
        }
