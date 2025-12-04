"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MLService = void 0;
const axios_1 = __importDefault(require("axios"));
const ML_API_BASE = process.env.ML_API_URL || 'http://localhost:8000';
class MLService {
    /**
     * Get forecast predictions from ML model
     */
    static async getForecast(productName, days = 7) {
        try {
            const response = await axios_1.default.get(`${ML_API_BASE}/api/ml/forecast`, {
                params: { productId: productName, days },
                timeout: 10000
            });
            return response.data;
        }
        catch (error) {
            console.error('[MLService] Forecast error:', error);
            throw new Error('Failed to get ML forecast');
        }
    }
    /**
     * Get weekly analytics report with rankings
     */
    static async getWeeklyReport(topN = 10, strategy = 'balanced') {
        try {
            const response = await axios_1.default.get(`${ML_API_BASE}/api/ml/report/weekly`, {
                params: { top_n: topN, strategy },
                timeout: 15000
            });
            return response.data;
        }
        catch (error) {
            console.error('[MLService] Weekly report error:', error);
            throw new Error('Failed to get ML weekly report');
        }
    }
    /**
     * Get inventory optimization recommendations
     */
    static async getInventoryOptimization(productName, currentStock, leadTimeDays = 3, serviceLevel = 'medium') {
        try {
            const response = await axios_1.default.post(`${ML_API_BASE}/api/ml/inventory/optimize`, {
                product_id: productName,
                current_stock: currentStock,
                lead_time_days: leadTimeDays,
                service_level: serviceLevel
            }, {
                timeout: 10000
            });
            return response.data;
        }
        catch (error) {
            console.error('[MLService] Inventory optimization error:', error);
            throw new Error('Failed to get inventory optimization');
        }
    }
    /**
     * Get profit forecast
     */
    static async getProfitForecast(productName, costPerUnit, pricePerUnit, fixedCostsWeekly = 0, days = 7) {
        try {
            const response = await axios_1.default.post(`${ML_API_BASE}/api/ml/profit/forecast`, {
                product_id: productName,
                cost_per_unit: costPerUnit,
                price_per_unit: pricePerUnit,
                fixed_costs_weekly: fixedCostsWeekly,
                days
            }, {
                timeout: 10000
            });
            return response.data;
        }
        catch (error) {
            console.error('[MLService] Profit forecast error:', error);
            throw new Error('Failed to get profit forecast');
        }
    }
    /**
     * Get list of all trained models
     */
    static async getAllModels() {
        try {
            const response = await axios_1.default.get(`${ML_API_BASE}/api/ml/models`, {
                timeout: 5000
            });
            return response.data;
        }
        catch (error) {
            console.error('[MLService] Get models error:', error);
            throw new Error('Failed to get ML models list');
        }
    }
    /**
     * Health check for ML service
     */
    static async healthCheck() {
        try {
            const response = await axios_1.default.get(`${ML_API_BASE}/`, { timeout: 3000 });
            return response.status === 200;
        }
        catch (error) {
            return false;
        }
    }
}
exports.MLService = MLService;
