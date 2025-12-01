import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'

import productRoutes from './routes/productRoutes';
import salesRoutes from './routes/salesRoutes';

dotenv.config()

const app = express()
const PORT = process.env.PORT || 5000

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));

app.use(express.json());

app.use('/api/products', productRoutes); 
app.use('/api/sales', salesRoutes);

app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Backend is running!',
    timestamp: new Date().toISOString()
  })
})

app.listen(PORT, () => {
  console.log(`🚀 Backend running on http://localhost:${PORT}`)
})