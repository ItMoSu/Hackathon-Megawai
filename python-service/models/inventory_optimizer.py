"""
Inventory Optimizer - Peak-aware stock recommendations
"""

from typing import Dict, List
import numpy as np


class InventoryOptimizer:
    """
    Calculates optimal inventory levels considering:
    - Demand variability
    - Lead time
    - Service level targets
    - Peak/burst patterns
    """

    SERVICE_LEVEL_Z = {
        'low': 1.28,      # 90%
        'medium': 1.65,   # 95%
        'high': 1.96,     # 97.5%
        'critical': 2.33  # 99%
    }

    def optimize_inventory(
        self,
        forecast: List[float],
        current_stock: float,
        lead_time_days: int,
        service_level: str = 'medium'
    ) -> Dict:
        """
        Calculate optimal inventory parameters
        
        Args:
            forecast: List of forecasted demand
            current_stock: Current inventory level
            lead_time_days: Supplier lead time in days
            service_level: Target service level (low/medium/high/critical)
        
        Returns:
            Inventory recommendations
        """
        
        if not forecast or len(forecast) < lead_time_days:
            return self._insufficient_data_response()

        # Calculate metrics
        avg_daily_demand = np.mean(forecast)
        std_demand = np.std(forecast)
        
        # Lead time demand
        lead_time_demand = avg_daily_demand * lead_time_days
        
        # Safety stock with service level
        z_score = self.SERVICE_LEVEL_Z.get(service_level, 1.65)
        safety_stock = z_score * std_demand * np.sqrt(lead_time_days)
        
        # Reorder point
        reorder_point = lead_time_demand + safety_stock
        
        # Order quantity (EOQ simplified - weekly demand)
        order_quantity = avg_daily_demand * 7
        
        # Max inventory level
        max_inventory = reorder_point + order_quantity
        
        # Current status
        days_of_stock = current_stock / avg_daily_demand if avg_daily_demand > 0 else 0
        
        # Recommendation
        if current_stock < reorder_point:
            action = 'ORDER_NOW'
            urgency = 'HIGH' if current_stock < safety_stock else 'MEDIUM'
            order_qty = max(0, order_quantity - (current_stock - reorder_point))
        elif current_stock > max_inventory:
            action = 'REDUCE_STOCK'
            urgency = 'LOW'
            order_qty = 0
        else:
            action = 'MAINTAIN'
            urgency = 'LOW'
            order_qty = 0

        return {
            'current_stock': round(current_stock, 1),
            'days_of_stock': round(days_of_stock, 1),
            'avg_daily_demand': round(avg_daily_demand, 1),
            'safety_stock': round(safety_stock, 1),
            'reorder_point': round(reorder_point, 1),
            'order_quantity': round(order_quantity, 1),
            'max_inventory': round(max_inventory, 1),
            'recommendation': {
                'action': action,
                'urgency': urgency,
                'order_qty': round(order_qty, 1),
                'message': self._get_recommendation_message(action, urgency, order_qty)
            },
            'service_level': service_level,
            'lead_time_days': lead_time_days
        }

    def _insufficient_data_response(self) -> Dict:
        """Return response when insufficient data"""
        return {
            'error': 'Insufficient forecast data',
            'recommendation': {
                'action': 'INSUFFICIENT_DATA',
                'message': 'Tambahkan lebih banyak data penjualan untuk rekomendasi stok'
            }
        }

    def _get_recommendation_message(self, action: str, urgency: str, order_qty: float) -> str:
        """Generate human-readable recommendation"""
        
        messages = {
            'ORDER_NOW': f'Pesan stok sekarang! Quantity: {order_qty:.0f} unit',
            'REDUCE_STOCK': 'Stok berlebih. Kurangi pemesanan berikutnya.',
            'MAINTAIN': 'Stok aman. Pertahankan level saat ini.',
            'INSUFFICIENT_DATA': 'Data tidak cukup untuk rekomendasi'
        }
        
        return messages.get(action, 'Status stok tidak diketahui')