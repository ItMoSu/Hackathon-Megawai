import { PrismaClient } from '@prisma/client'

// Use flexible types to avoid Prisma Decimal conflicts
export type Dataset = any
export type Product = any
export type Sale = any
export type DailyAnalytics = any

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
  isConnected: boolean
}

// Optimized Prisma client for serverless (Vercel)
const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'production' ? ['error'] : ['error', 'warn'],
})

// Keep prisma instance in global scope to reuse connections across requests
globalForPrisma.prisma = prisma

// Warm up database connection (call once on startup)
export async function warmupConnection(): Promise<boolean> {
  if (globalForPrisma.isConnected) return true
  
  try {
    await prisma.$queryRaw`SELECT 1`
    globalForPrisma.isConnected = true
    console.log('[DB] Connection warmed up successfully')
    return true
  } catch (error) {
    console.error('[DB] Connection warmup failed:', error)
    globalForPrisma.isConnected = false
    return false
  }
}

// Check if database is reachable
export async function checkConnection(): Promise<{ ok: boolean; latency?: number; error?: string }> {
  const start = Date.now()
  try {
    await prisma.$queryRaw`SELECT 1`
    return { ok: true, latency: Date.now() - start }
  } catch (error: any) {
    return { ok: false, error: error.message }
  }
}

export { prisma }
