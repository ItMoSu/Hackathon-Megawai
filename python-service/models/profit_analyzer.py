"""
Profit Analyzer - Revenue and margin forecasting
"""

from typing import Dict, List


class ProfitAnalyzer:
    """
    Analyzes profit potential based on:
    - Forecasted demand
    - Unit costs and prices
    - Fixed costs allocation
    """

    def forecast_profit(
        self,
        predictions: List[Dict],
        cost_per_unit: float,
        price_per_unit: float,
        fixed_costs_weekly: float = 0
    ) -> Dict:
        """
        Calculate profit forecast
        
        Args:
            predictions: List of demand predictions
            cost_per_unit: Variable cost per unit
            price_per_unit: Selling price per unit
            fixed_costs_weekly: Weekly fixed costs (rent, salaries, etc.)
        
        Returns:
            Profit analysis with daily and total breakdown
        """
        
        if not predictions:
            return self._no_prediction_response()

        daily_analysis = []
        total_units = 0
        total_revenue = 0
        total_variable_cost = 0

        # Calculate daily metrics
        for pred in predictions:
            quantity = pred.get('predicted_quantity', 0)
            revenue = quantity * price_per_unit
            variable_cost = quantity * cost_per_unit
            contribution_margin = revenue - variable_cost

            total_units += quantity
            total_revenue += revenue
            total_variable_cost += variable_cost

            daily_analysis.append({
                'date': pred.get('date'),
                'quantity': round(quantity, 1),
                'revenue': round(revenue, 0),
                'variable_cost': round(variable_cost, 0),
                'contribution_margin': round(contribution_margin, 0)
            })

        # Period totals
        total_contribution = total_revenue - total_variable_cost
        
        # Allocate fixed costs
        if fixed_costs_weekly > 0:
            # Distribute fixed costs across forecast period
            days_in_forecast = len(predictions)
            daily_fixed_cost = (fixed_costs_weekly / 7) * days_in_forecast
        else:
            daily_fixed_cost = 0

        total_profit = total_contribution - daily_fixed_cost
        
        # Metrics
        profit_margin = (total_profit / total_revenue * 100) if total_revenue > 0 else 0
        contribution_margin_pct = (total_contribution / total_revenue * 100) if total_revenue > 0 else 0
        
        # Break-even analysis
        contribution_per_unit = price_per_unit - cost_per_unit
        breakeven_units = (daily_fixed_cost / contribution_per_unit) if contribution_per_unit > 0 else 0

        return {
            'period_summary': {
                'total_units': round(total_units, 1),
                'total_revenue': round(total_revenue, 0),
                'total_variable_cost': round(total_variable_cost, 0),
                'total_contribution_margin': round(total_contribution, 0),
                'fixed_costs': round(daily_fixed_cost, 0),
                'total_profit': round(total_profit, 0),
                'profit_margin_pct': round(profit_margin, 2),
                'contribution_margin_pct': round(contribution_margin_pct, 2)
            },
            'daily_breakdown': daily_analysis,
            'breakeven_analysis': {
                'breakeven_units_per_period': round(breakeven_units, 1),
                'current_units_forecast': round(total_units, 1),
                'above_breakeven': total_units > breakeven_units,
                'margin_of_safety_pct': round(((total_units - breakeven_units) / total_units * 100), 2) if total_units > 0 else 0
            },
            'pricing': {
                'cost_per_unit': cost_per_unit,
                'price_per_unit': price_per_unit,
                'contribution_per_unit': round(contribution_per_unit, 2),
                'markup_pct': round(((price_per_unit - cost_per_unit) / cost_per_unit * 100), 2) if cost_per_unit > 0 else 0
            }
        }

    def _no_prediction_response(self) -> Dict:
        """Return response when no predictions"""
        return {
            'error': 'No predictions available',
            'message': 'Lakukan forecast terlebih dahulu'
        }