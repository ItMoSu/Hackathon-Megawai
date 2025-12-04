"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyzeSales = void 0;
const axios_1 = __importDefault(require("axios"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const PYTHON_URL = process.env.PYTHON_SERVICE_URL || 'http://localhost:8000';
const analyzeSales = async (data) => {
    try {
        console.log(`Mengirim data ke AI: ${PYTHON_URL}/analyze`);
        const response = await axios_1.default.post(`${PYTHON_URL}/analyze`, data);
        return response.data;
    }
    catch (error) {
        console.error("AI Service Error:", error);
        return {
            burst_score: 0,
            status: "NORMAL (AI Offline)",
            recommendation: "Cek koneksi AI"
        };
    }
};
exports.analyzeSales = analyzeSales;
