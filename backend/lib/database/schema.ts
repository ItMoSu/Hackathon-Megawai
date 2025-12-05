import { PrismaClient, Prisma } from '@prisma/client'

// Use Prisma's Decimal type
type Decimal = Prisma.Decimal

// Simple types matching Prisma schema
export type Dataset = {
  id: string
  user_id: string
  name: string
  source_file_name: string
  source_file_type: string
  storage_path: string
  status: string
  rows_count: number | null
  error_message: string | null
  created_at: Date
  updated_at: Date
}

export type Product = {
  id: string
  user_id: string
  dataset_id: string | null
  name: string
  unit: string
  price: Decimal | null
  is_active: boolean
  created_at: Date
}

export type Sale = {
  id: string
  user_id: string
  dataset_id: string | null
  product_id: string
  sale_date: Date
  quantity: Decimal
  revenue: Decimal | null
  has_promo: boolean
  source: string
  created_at: Date
}

export type DailyAnalytics = {
  id: string
  user_id: string
  dataset_id: string | null
  product_id: string
  metric_date: Date
  actual_quantity: Decimal
  baseline_quantity: Decimal | null
  expected_quantity: Decimal | null
  forecast_quantity: Decimal | null
  dow_factor: Decimal | null
  payday_factor: Decimal | null
  special_factor: Decimal | null
  ema_7: Decimal | null
  ema_14: Decimal | null
  ema_30: Decimal | null
  momentum_7: Decimal | null
  momentum_14: Decimal | null
  momentum_30: Decimal | null
  momentum_combined: Decimal | null
  momentum_label: string | null
  burst_score: Decimal | null
  burst_level: string | null
  burst_type: string | null
  priority_score: Decimal | null
  priority_rank: number | null
  ai_insight: any
  created_at: Date
  updated_at: Date
}

export type DateRange = { startDate: Date; endDate: Date }

export type UpsertSalesRow = {
  productName: string
  date: Date
  quantity: number
  hasPromo?: boolean
  source?: string
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

const prisma = globalForPrisma.prisma ?? new PrismaClient({ log: ['error'] })

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

export { prisma, Prisma }
