import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const PYTHON_URL = process.env.PYTHON_SERVICE_URL || 'http://localhost:8000';

export const analyzeSales = async (data: any) => {
  try {
    console.log(`Mengirim data ke AI: ${PYTHON_URL}/analyze`); 
    const response = await axios.post(`${PYTHON_URL}/analyze`, data);
    return response.data;
  } catch (error) {
    console.error("AI Service Error:", error);
    return { 
        burst_score: 0, 
        status: "NORMAL (AI Offline)", 
        recommendation: "Cek koneksi AI" 
    };
  }
};